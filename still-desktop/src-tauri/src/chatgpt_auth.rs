//! Sign in with ChatGPT protocol and token verification.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{
    decode, decode_header,
    jwk::{AlgorithmParameters, JwkSet, PublicKeyUse},
    Algorithm, DecodingKey, Validation,
};
use ring::{
    digest,
    rand::{SecureRandom, SystemRandom},
};
use serde::{Deserialize, Serialize};
use url::Url;

const AUTHORIZE_ENDPOINT: &str = "https://auth.openai.com/oauth/authorize";
pub(crate) const CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_ENDPOINT: &str = "https://auth.openai.com/oauth/token";
const JWKS_ENDPOINT: &str = "https://auth.openai.com/.well-known/jwks.json";
const EXPECTED_ISSUER: &str = "https://auth.openai.com";
const SCOPE: &str = "openid profile email offline_access api.connectors.read api.connectors.invoke";
const ORIGINATOR: &str = "still_desktop";
const CALLBACK_PATH: &str = "/auth/callback";

pub struct AuthorizationAttempt {
    redirect_uri: String,
    state: String,
    nonce: String,
    code_verifier: String,
    callback_consumed: bool,
}

impl std::fmt::Debug for AuthorizationAttempt {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuthorizationAttempt")
            .field("redirect_uri", &self.redirect_uri)
            .field("state", &"[redacted]")
            .field("nonce", &"[redacted]")
            .field("code_verifier", &"[redacted]")
            .finish()
    }
}

#[derive(PartialEq, Eq)]
pub struct AuthorizationCode {
    code: String,
    client_id: String,
    scope: Option<String>,
}

impl std::fmt::Debug for AuthorizationCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuthorizationCode")
            .field("code", &"[redacted]")
            .field("client_id", &self.client_id)
            .field("scope", &self.scope)
            .finish()
    }
}

impl AuthorizationAttempt {
    /// Creates an authorization transaction for an already-bound native
    /// loopback URI. The caller must bind its listener before opening the URL.
    /// This method does not perform either action itself.
    pub fn new(redirect_uri: &str) -> Result<Self, &'static str> {
        validate_loopback_redirect(redirect_uri)?;
        let rng = SystemRandom::new();
        let state = random_url_token(&rng)?;
        let nonce = random_url_token(&rng)?;
        let code_verifier = random_url_token(&rng)?;
        Ok(Self {
            redirect_uri: redirect_uri.to_owned(),
            state,
            nonce,
            code_verifier,
            callback_consumed: false,
        })
    }

    pub fn authorization_url(&self) -> Result<Url, &'static str> {
        let challenge = URL_SAFE_NO_PAD
            .encode(digest::digest(&digest::SHA256, self.code_verifier.as_bytes()).as_ref());
        let mut url =
            Url::parse(AUTHORIZE_ENDPOINT).map_err(|_| "Invalid authorization endpoint.")?;
        let mut query = url.query_pairs_mut();
        query
            .append_pair("client_id", CLIENT_ID)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", &self.redirect_uri)
            .append_pair("scope", SCOPE)
            .append_pair("id_token_add_organizations", "true")
            .append_pair("codex_cli_simplified_flow", "true")
            .append_pair("originator", ORIGINATOR)
            .append_pair("state", &self.state)
            .append_pair("nonce", &self.nonce)
            .append_pair("code_challenge_method", "S256")
            .append_pair("code_challenge", &challenge);
        drop(query);
        Ok(url)
    }

    /// Validates callback origin/path and attempt state before exposing the
    /// short-lived code to a future exchange implementation.
    pub fn validate_callback(&mut self, callback: &str) -> Result<AuthorizationCode, &'static str> {
        if self.callback_consumed {
            return Err("This sign-in callback has already been handled.");
        }
        let url = Url::parse(callback).map_err(|_| "Invalid authorization callback.")?;
        if url.scheme() != "http"
            || !matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
            || url.port().is_none()
            || url.path() != CALLBACK_PATH
            || url.fragment().is_some()
        {
            return Err("Authorization callback does not match the loopback redirect.");
        }
        let redirect = Url::parse(&self.redirect_uri).map_err(|_| "Invalid pending redirect.")?;
        if url.port() != redirect.port() {
            return Err("Authorization callback used a different loopback port.");
        }

        let mut state = None;
        let mut code = None;
        let mut client_id = None;
        let mut scope = None;
        let mut error = None;
        let mut duplicate = false;
        for (key, value) in url.query_pairs() {
            let slot = match key.as_ref() {
                "state" => &mut state,
                "code" => &mut code,
                "client_id" => &mut client_id,
                "scope" => &mut scope,
                "error" => &mut error,
                _ => continue,
            };
            if slot.replace(value.into_owned()).is_some() {
                duplicate = true;
            }
        }
        if duplicate {
            return Err("Authorization callback contains duplicate parameters.");
        }
        if state.as_deref() != Some(self.state.as_str()) {
            return Err("Authorization callback state did not match this sign-in attempt.");
        }
        if error.is_some() {
            self.callback_consumed = true;
            return Err("ChatGPT sign-in was not authorized.");
        }
        let code = code
            .filter(|value| !value.is_empty())
            .ok_or("Authorization callback did not include a code.")?;
        if client_id.as_deref().is_some_and(|returned| returned != CLIENT_ID) {
            return Err("ChatGPT returned a different OAuth client.");
        }
        self.callback_consumed = true;
        Ok(AuthorizationCode {
            code,
            client_id: CLIENT_ID.to_owned(),
            scope,
        })
    }

    pub(crate) fn callback_consumed(&self) -> bool {
        self.callback_consumed
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    id_token: String,
    token_type: String,
    expires_in: u64,
    scope: String,
}

impl std::fmt::Debug for TokenResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenResponse")
            .field("access_token", &"[redacted]")
            .field("refresh_token", &"[redacted]")
            .field("id_token", &"[redacted]")
            .field("token_type", &self.token_type)
            .field("expires_in", &self.expires_in)
            .field("scope", &self.scope)
            .finish()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct VerifiedIdentity {
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    #[serde(default)]
    pub(crate) account_id: Option<String>,
}

#[derive(Deserialize)]
struct IdTokenClaims {
    iss: String,
    sub: String,
    aud: Audience,
    exp: u64,
    iat: u64,
    nonce: Option<String>,
    email: Option<String>,
    #[serde(rename = "https://api.openai.com/auth")]
    auth: Option<IdTokenAuthClaims>,
}

#[derive(Deserialize)]
struct IdTokenAuthClaims {
    chatgpt_account_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Audience {
    One(String),
    Many(Vec<String>),
}

fn verify_id_token(
    token: &str,
    jwks: &JwkSet,
    client_id: &str,
    expected_nonce: Option<&str>,
    expected_subject: Option<&str>,
) -> Result<VerifiedIdentity, &'static str> {
    let header = decode_header(token).map_err(|_| "ChatGPT returned an invalid ID token.")?;
    if header.alg != Algorithm::RS256 {
        return Err("ChatGPT ID token used an unsupported signing algorithm.");
    }
    let kid = header
        .kid
        .as_deref()
        .ok_or("ChatGPT ID token did not identify its signing key.")?;
    let jwk = jwks
        .find(kid)
        .ok_or("ChatGPT ID token signing key was not found in OpenAI JWKS.")?;
    if jwk.common.public_key_use != Some(PublicKeyUse::Signature)
        || jwk.common.key_algorithm != Some(jsonwebtoken::jwk::KeyAlgorithm::RS256)
        || !matches!(jwk.algorithm, AlgorithmParameters::RSA(_))
    {
        return Err("OpenAI JWKS key is not an RS256 signing key.");
    }
    let key = DecodingKey::from_jwk(jwk).map_err(|_| "OpenAI JWKS signing key is invalid.")?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.leeway = 5;
    validation.set_issuer(&[EXPECTED_ISSUER]);
    validation.set_audience(&[client_id]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    let claims = decode::<IdTokenClaims>(token, &key, &validation)
        .map_err(|_| "ChatGPT ID token signature or required claims were invalid.")?
        .claims;
    if claims.iss != EXPECTED_ISSUER
        || claims.sub.trim().is_empty()
        || claims.iat == 0
        || claims.exp <= claims.iat
        || claims.exp.saturating_sub(claims.iat) > 86_400
    {
        return Err("ChatGPT ID token claims were invalid.");
    }
    let has_client_audience = match &claims.aud {
        Audience::One(aud) => aud == client_id,
        Audience::Many(auds) => auds.iter().any(|aud| aud == client_id),
    };
    if !has_client_audience {
        return Err("ChatGPT ID token audience did not match this registration.");
    }
    if let Some(nonce) = expected_nonce {
        if claims.nonce.as_deref() != Some(nonce) {
            return Err("ChatGPT ID token nonce did not match this sign-in attempt.");
        }
    }
    if expected_subject.is_some_and(|subject| subject != claims.sub) {
        return Err("ChatGPT account identity changed during reauthorization.");
    }
    Ok(VerifiedIdentity {
        subject: claims.sub,
        email: claims.email,
        account_id: claims
            .auth
            .and_then(|auth| auth.chatgpt_account_id)
            .filter(|id| valid_account_id(id)),
    })
}

fn valid_account_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn validate_token_response(
    response: TokenResponse,
    client_id: &str,
    jwks: &JwkSet,
    expected_nonce: Option<&str>,
    expected_subject: Option<&str>,
) -> Result<VerifiedSession, &'static str> {
    if response.access_token.is_empty()
        || response.refresh_token.is_empty()
        || response.id_token.is_empty()
        || !response.token_type.eq_ignore_ascii_case("bearer")
        || !(1..=86_400).contains(&response.expires_in)
    {
        return Err("ChatGPT token response was incomplete or invalid.");
    }
    let scopes: Vec<String> = response
        .scope
        .split_ascii_whitespace()
        .map(str::to_owned)
        .collect();
    for required in ["openid", "offline_access", "api.connectors.read", "api.connectors.invoke"] {
        if !scopes.iter().any(|scope| scope == required) {
            return Err("ChatGPT did not grant all scopes required for plan usage.");
        }
    }
    let identity = verify_id_token(
        &response.id_token,
        jwks,
        client_id,
        expected_nonce,
        expected_subject,
    )?;
    Ok(VerifiedSession {
        client_id: client_id.to_owned(),
        identity,
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        id_token: response.id_token,
        expires_in: response.expires_in,
        scopes,
        saved_at: jsonwebtoken::get_current_timestamp(),
    })
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct VerifiedSession {
    pub(crate) client_id: String,
    pub(crate) identity: VerifiedIdentity,
    pub(crate) access_token: String,
    pub(crate) refresh_token: String,
    id_token: String,
    expires_in: u64,
    scopes: Vec<String>,
    saved_at: u64,
}

impl VerifiedSession {
    pub(crate) fn needs_refresh(&self) -> bool {
        jsonwebtoken::get_current_timestamp().saturating_add(60)
            >= self.saved_at.saturating_add(self.expires_in)
    }
}

pub(crate) fn verified_account_id(
    session: &VerifiedSession,
    jwks: &JwkSet,
) -> Result<String, &'static str> {
    let identity = verify_id_token(
        &session.id_token,
        jwks,
        &session.client_id,
        None,
        Some(&session.identity.subject),
    )
    .map_err(|_| "Codex account identity could not be verified. Reconnect in AI settings.")?;
    identity
        .account_id
        .ok_or("The signed-in account has no Codex subscription identity. Reconnect in AI settings.")
}

impl std::fmt::Debug for VerifiedSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("VerifiedSession")
            .field("client_id", &self.client_id)
            .field("subject", &self.identity.subject)
            .field("access_token", &"[redacted]")
            .field("refresh_token", &"[redacted]")
            .field("id_token", &"[redacted]")
            .field("expires_in", &self.expires_in)
            .field("scopes", &self.scopes)
            .finish()
    }
}

fn code_exchange_form(
    code: &AuthorizationCode,
    verifier: &str,
    redirect_uri: &str,
) -> Vec<(&'static str, String)> {
    vec![
        ("grant_type", "authorization_code".into()),
        ("client_id", code.client_id.clone()),
        ("code", code.code.clone()),
        ("code_verifier", verifier.to_owned()),
        ("redirect_uri", redirect_uri.to_owned()),
    ]
}

fn refresh_form(client_id: &str, refresh_token: &str) -> Vec<(&'static str, String)> {
    vec![
        ("grant_type", "refresh_token".into()),
        ("client_id", client_id.to_owned()),
        ("refresh_token", refresh_token.to_owned()),
    ]
}

async fn exchange_code_request(
    client: &reqwest::Client,
    code: &AuthorizationCode,
    verifier: &str,
    redirect_uri: &str,
) -> Result<TokenResponse, &'static str> {
    post_token_form(
        client,
        TOKEN_ENDPOINT,
        &code_exchange_form(code, verifier, redirect_uri),
    )
    .await
}

async fn refresh_request(
    client: &reqwest::Client,
    client_id: &str,
    refresh_token: &str,
) -> Result<TokenResponse, &'static str> {
    post_token_form(
        client,
        TOKEN_ENDPOINT,
        &refresh_form(client_id, refresh_token),
    )
    .await
}

async fn post_token_form(
    client: &reqwest::Client,
    endpoint: &str,
    fields: &[(&str, String)],
) -> Result<TokenResponse, &'static str> {
    let response = client
        .post(endpoint)
        .form(fields)
        .send()
        .await
        .map_err(|_| "Could not reach ChatGPT sign-in. Check the connection and retry.")?;
    if !response.status().is_success() {
        return Err("ChatGPT sign-in or token refresh was rejected.");
    }
    let body = read_bounded(response, 64 * 1024).await?;
    serde_json::from_slice(&body).map_err(|_| "ChatGPT token response was invalid.")
}

pub(crate) async fn fetch_openai_jwks(client: &reqwest::Client) -> Result<JwkSet, &'static str> {
    let response = client
        .get(JWKS_ENDPOINT)
        .send()
        .await
        .map_err(|_| "Could not retrieve OpenAI signing keys.")?;
    if !response.status().is_success() {
        return Err("OpenAI signing keys could not be retrieved.");
    }
    let body = read_bounded(response, 256 * 1024).await?;
    serde_json::from_slice(&body).map_err(|_| "OpenAI signing key response was invalid.")
}

pub(crate) async fn read_bounded(
    mut response: reqwest::Response,
    max: usize,
) -> Result<Vec<u8>, &'static str> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "ChatGPT response could not be read.")?
    {
        if bytes.len() + chunk.len() > max {
            return Err("ChatGPT returned an oversized response.");
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

pub(crate) fn bounded_openai_http_client() -> Result<reqwest::Client, &'static str> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(90))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Could not initialize secure ChatGPT transport.")
}

pub(crate) async fn refresh_verified_session(
    client: &reqwest::Client,
    jwks: &JwkSet,
    previous: &VerifiedSession,
) -> Result<VerifiedSession, &'static str> {
    let response = refresh_request(client, &previous.client_id, &previous.refresh_token).await?;
    validate_token_response(
        response,
        &previous.client_id,
        jwks,
        None,
        Some(&previous.identity.subject),
    )
}

/// Cancellation is provided by dropping the returned future. Callers must do
/// so when the user cancels; `reqwest` then drops the in-flight operation.
/// The function only returns a new session after validating token scopes and
/// the ID token; callers must persist its rotating refresh token before swap.
pub(crate) async fn exchange_and_validate(
    client: &reqwest::Client,
    attempt: AuthorizationAttempt,
    code: AuthorizationCode,
    jwks: &JwkSet,
    expected_subject: Option<&str>,
) -> Result<VerifiedSession, &'static str> {
    if !attempt.callback_consumed {
        return Err("Authorization callback was not validated.");
    }
    let response =
        exchange_code_request(client, &code, &attempt.code_verifier, &attempt.redirect_uri).await?;
    validate_token_response(
        response,
        &code.client_id,
        jwks,
        Some(&attempt.nonce),
        expected_subject,
    )
}

fn random_url_token(rng: &SystemRandom) -> Result<String, &'static str> {
    let mut bytes = [0u8; 32];
    rng.fill(&mut bytes)
        .map_err(|_| "Could not generate secure sign-in randomness.")?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn validate_loopback_redirect(value: &str) -> Result<(), &'static str> {
    let url = Url::parse(value).map_err(|_| "Invalid loopback redirect URI.")?;
    if url.scheme() != "http"
        || !matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
        || url.port().is_none()
        || url.path() != CALLBACK_PATH
        || url.query().is_some()
        || url.fragment().is_some()
        || url.username() != ""
        || url.password().is_some()
    {
        return Err("Redirect URI must be an HTTP localhost loopback callback.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn attempt() -> AuthorizationAttempt {
        AuthorizationAttempt::new("http://127.0.0.1:1455/auth/callback").unwrap()
    }

    #[test]
    fn uses_the_codex_subscription_oauth_client_and_scopes() {
        assert_eq!(AUTHORIZE_ENDPOINT, "https://auth.openai.com/oauth/authorize");
        assert_eq!(TOKEN_ENDPOINT, "https://auth.openai.com/oauth/token");
        assert_eq!(
            SCOPE,
            "openid profile email offline_access api.connectors.read api.connectors.invoke"
        );
        let url = attempt().authorization_url().unwrap();
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(query["client_id"], "app_EMoamEEZ73f0CkXaXp7hrann");
    }

    #[test]
    fn creates_distinct_pkce_state_nonce_and_correct_s256_challenge() {
        let first = attempt();
        let second = attempt();
        assert_ne!(first.state, second.state);
        assert_ne!(first.nonce, second.nonce);
        assert_ne!(first.code_verifier, second.code_verifier);
        assert_eq!(first.code_verifier.len(), 43);

        let url = first.authorization_url().unwrap();
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(
            url.origin().ascii_serialization(),
            "https://auth.openai.com"
        );
        assert_eq!(query["client_id"], CLIENT_ID);
        assert_eq!(query["redirect_uri"], "http://127.0.0.1:1455/auth/callback");
        assert!(!query.contains_key("resource"));
        assert!(!query.contains_key("ext_agent_host_id"));
        assert_eq!(query["id_token_add_organizations"], "true");
        assert_eq!(query["codex_cli_simplified_flow"], "true");
        assert_eq!(query["originator"], ORIGINATOR);
        assert_eq!(query["code_challenge_method"], "S256");
        let expected = URL_SAFE_NO_PAD
            .encode(digest::digest(&digest::SHA256, first.code_verifier.as_bytes()).as_ref());
        assert_eq!(query["code_challenge"], expected);
        assert_eq!(query["nonce"], first.nonce);
        assert_eq!(query["state"], first.state);
    }

    #[test]
    fn callback_requires_matching_loopback_and_state_and_issued_client_id() {
        let mut auth = attempt();
        let ok = format!("http://127.0.0.1:1455/auth/callback?code=one&state={}&client_id={CLIENT_ID}&scope=openid", auth.state);
        assert_eq!(
            auth.validate_callback(&ok).unwrap(),
            AuthorizationCode {
                code: "one".into(),
                client_id: CLIENT_ID.into(),
                scope: Some("openid".into())
            }
        );
        let mut wrong_state_auth = attempt();
        assert!(wrong_state_auth
            .validate_callback(&format!(
                "http://127.0.0.1:1455/auth/callback?code=one&state=wrong&client_id={CLIENT_ID}"
            ))
            .is_err());
        let mut wrong_port_auth = attempt();
        assert!(wrong_port_auth
            .validate_callback(&ok.replace("1455", "1456"))
            .is_err());
        let mut localhost_auth = AuthorizationAttempt::new("http://localhost:1455/auth/callback").unwrap();
        let localhost_callback = format!("http://localhost:1455/auth/callback?code=one&state={}&client_id={CLIENT_ID}", localhost_auth.state);
        assert!(localhost_auth.validate_callback(&localhost_callback).is_ok());
        let mut wrong_client_auth = attempt();
        assert!(wrong_client_auth
            .validate_callback(&format!(
                "http://127.0.0.1:1455/auth/callback?code=one&state={}&client_id=another-client",
                wrong_client_auth.state
            ))
            .is_err());
    }

    #[test]
    fn rejects_duplicate_parameters_and_denial_and_accepts_missing_client_id() {
        let mut auth = attempt();
        assert!(auth
            .validate_callback("http://127.0.0.1:1455/auth/callback?code=x&code=y&state=z")
            .is_err());
        assert!(auth
            .validate_callback(&format!(
                "http://127.0.0.1:1455/auth/callback?error=access_denied&state={}",
                auth.state
            ))
            .is_err());
        let mut no_client = attempt();
        assert!(no_client
            .validate_callback(&format!(
                "http://127.0.0.1:1455/auth/callback?code=x&state={}",
                no_client.state
            ))
            .is_ok());
        assert!(AuthorizationAttempt::new("http://localhost:1455/auth/callback").is_ok());
        assert!(AuthorizationAttempt::new("http://127.0.0.1:1455/callback").is_err());
        assert!(AuthorizationAttempt::new("https://127.0.0.1:1455/auth/callback").is_err());
    }

    #[test]
    fn debug_redacts_attempt_secrets() {
        let auth = attempt();
        let debug = format!("{auth:?}");
        assert!(!debug.contains(&auth.state));
        assert!(!debug.contains(&auth.nonce));
        assert!(!debug.contains(&auth.code_verifier));
    }

    #[test]
    fn callback_accepts_codex_loopback_host_and_optional_client_id() {
        let mut auth = AuthorizationAttempt::new("http://localhost:1455/auth/callback").unwrap();
        let url = auth.authorization_url().unwrap();
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(query["client_id"], CLIENT_ID);
        let callback = format!("{}?code=one&state={}", auth.redirect_uri, auth.state);
        assert_eq!(auth.validate_callback(&callback).unwrap().client_id, CLIENT_ID);
    }

    fn test_jwks() -> JwkSet {
        serde_json::from_value(serde_json::json!({"keys": [{
            "kty": "RSA", "kid": "test-rsa", "use": "sig", "alg": "RS256",
            "n": "yRE6rHuNR0QbHO3H3Kt2pOKGVhQqGZXInOduQNxXzuKlvQTLUTv4l4sggh5_CYYi_cvI-SXVT9kPWSKXxJXBXd_4LkvcPuUakBoAkfh-eiFVMh2VrUyWyj3MFl0HTVF9KwRXLAcwkREiS3npThHRyIxuy0ZMeZfxVL5arMhw1SRELB8HoGfG_AtH89BIE9jDBHZ9dLelK9a184zAf8LwoPLxvJb3Il5nncqPcSfKDDodMFBIMc4lQzDKL5gvmiXLXB1AGLm8KBjfE8s3L5xqi-yUod-j8MtvIj812dkS4QMiRVN_by2h3ZY8LYVGrqZXZTcgn2ujn8uKjXLZVD5TdQ",
            "e": "AQAB"
        }] })).unwrap()
    }

    fn signed_id_token(overrides: serde_json::Value) -> String {
        let now = jsonwebtoken::get_current_timestamp();
        let mut claims = serde_json::json!({
            "iss": EXPECTED_ISSUER,
            "sub": "stable-user-subject",
            "aud": "app_EMoamEEZ73f0CkXaXp7hrann",
            "nonce": "test-nonce",
            "iat": now,
            "exp": now + 600,
            "email": "test@example.invalid"
        });
        for (key, value) in overrides.as_object().unwrap() {
            claims[key] = value.clone();
        }
        let mut header = jsonwebtoken::Header::new(Algorithm::RS256);
        header.kid = Some("test-rsa".into());
        let private_key = include_bytes!("../tests/fixtures/chatgpt_test_private.pem");
        jsonwebtoken::encode(
            &header,
            &claims,
            &jsonwebtoken::EncodingKey::from_rsa_pem(private_key).unwrap(),
        )
        .unwrap()
    }

    #[test]
    fn verifies_signed_id_token_and_all_required_identity_claims() {
        let token = signed_id_token(serde_json::json!({}));
        let identity = verify_id_token(
            &token,
            &test_jwks(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            Some("test-nonce"),
            None,
        )
        .unwrap();
        assert_eq!(identity.subject, "stable-user-subject");
        assert_eq!(identity.email.as_deref(), Some("test@example.invalid"));
        assert_eq!(identity.account_id, None);
        assert!(verify_id_token(
            &token,
            &test_jwks(),
            "other-client",
            Some("test-nonce"),
            None
        )
        .is_err());
        assert!(verify_id_token(
            &token,
            &test_jwks(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            Some("wrong-nonce"),
            None
        )
        .is_err());
        assert!(verify_id_token(
            &token,
            &test_jwks(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            None,
            Some("different-subject")
        )
        .is_err());
    }

    #[test]
    fn extracts_codex_account_id_only_from_the_verified_identity_token() {
        let token = signed_id_token(serde_json::json!({
            "https://api.openai.com/auth":{"chatgpt_account_id":"acct-0123_abcd"}
        }));
        let identity = verify_id_token(
            &token,
            &test_jwks(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            Some("test-nonce"),
            None,
        )
        .unwrap();
        assert_eq!(identity.account_id.as_deref(), Some("acct-0123_abcd"));
        let old_identity: VerifiedIdentity =
            serde_json::from_str(r#"{"subject":"old","email":null}"#).unwrap();
        assert_eq!(old_identity.account_id, None);
        assert!(!valid_account_id("acct/invalid"));
        assert!(!valid_account_id(""));
    }

    #[test]
    fn rejects_wrong_issuer_expiry_signature_algorithm_and_unknown_kid() {
        let jwks = test_jwks();
        for invalid in [
            signed_id_token(serde_json::json!({"iss":"https://attacker.invalid"})),
            signed_id_token(serde_json::json!({"exp":1})),
            signed_id_token(serde_json::json!({"aud":"other-client"})),
        ] {
            assert!(verify_id_token(
                &invalid,
                &jwks,
                "app_EMoamEEZ73f0CkXaXp7hrann",
                Some("test-nonce"),
                None
            )
            .is_err());
        }
        let mut wrong_kid_header = jsonwebtoken::Header::new(Algorithm::RS256);
        wrong_kid_header.kid = Some("unknown-key".into());
        let now = jsonwebtoken::get_current_timestamp();
        let claims = serde_json::json!({"iss": EXPECTED_ISSUER, "sub":"s", "aud":"app_EMoamEEZ73f0CkXaXp7hrann", "iat":now, "exp":now+600, "nonce":"test-nonce"});
        let token = jsonwebtoken::encode(
            &wrong_kid_header,
            &claims,
            &jsonwebtoken::EncodingKey::from_rsa_pem(include_bytes!(
                "../tests/fixtures/chatgpt_test_private.pem"
            ))
            .unwrap(),
        )
        .unwrap();
        assert!(verify_id_token(
            &token,
            &jwks,
            "app_EMoamEEZ73f0CkXaXp7hrann",
            Some("test-nonce"),
            None
        )
        .is_err());
    }

    #[test]
    fn token_response_requires_codex_scopes_and_same_account_on_refresh() {
        let jwks = test_jwks();
        let response = || TokenResponse {
            access_token: "access-secret".into(),
            refresh_token: "refresh-secret".into(),
            id_token: signed_id_token(serde_json::json!({})),
            token_type: "Bearer".into(),
            expires_in: 3600,
            scope: "openid profile email offline_access api.connectors.read api.connectors.invoke"
                .into(),
        };
        let session = validate_token_response(
            response(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            &jwks,
            Some("test-nonce"),
            None,
        )
        .unwrap();
        assert!(validate_token_response(
            response(),
            "app_EMoamEEZ73f0CkXaXp7hrann",
            &jwks,
            None,
            Some("different-account")
        )
        .is_err());
        let mut missing_scope = response();
        missing_scope.scope = "openid profile".into();
        assert!(validate_token_response(
            missing_scope,
            "app_EMoamEEZ73f0CkXaXp7hrann",
            &jwks,
            Some("test-nonce"),
            None
        )
        .is_err());
        let display = format!("{session:?}");
        assert!(!display.contains("access-secret"));
        assert!(!display.contains("refresh-secret"));
        assert!(!format!("{:?}", response()).contains("access-secret"));
    }

    #[test]
    fn token_grant_forms_use_codex_client_id_and_omit_resource_and_refresh_scope() {
        let code = AuthorizationCode {
            code: "code-secret".into(),
            client_id: CLIENT_ID.into(),
            scope: None,
        };
        let exchange = code_exchange_form(
            &code,
            "verifier-secret",
            "http://localhost:1455/auth/callback",
        );
        assert!(exchange
            .iter()
            .any(|(key, value)| *key == "grant_type" && value == "authorization_code"));
        assert!(exchange
            .iter()
            .any(|(key, value)| *key == "client_id" && value == CLIENT_ID));
        assert!(exchange
            .iter()
            .any(|(key, value)| *key == "code_verifier" && value == "verifier-secret"));
        let refresh = refresh_form(CLIENT_ID, "refresh-secret");
        assert!(refresh
            .iter()
            .any(|(key, value)| *key == "grant_type" && value == "refresh_token"));
        assert!(!exchange.iter().any(|(key, _)| *key == "resource"));
        assert!(!refresh.iter().any(|(key, _)| *key == "resource"));
        assert!(!refresh.iter().any(|(key, _)| *key == "scope"));
    }
}
