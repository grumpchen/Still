use crate::assistant_protocol::Provider;

fn target_name(provider: Provider) -> &'static str {
    match provider {
        Provider::Gemini => "Still.AI.Gemini.v1",
        Provider::Openai => "Still.AI.OpenAI.v1",
        Provider::Opencode => "Still.AI.OpenCode.v1",
    }
}

#[cfg(windows)]
pub fn load(provider: Provider) -> Result<Option<String>, String> {
    use std::{ptr, slice};
    use windows::{
        core::PCWSTR,
        Win32::Security::Credentials::{
            CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
        },
    };

    let name = target_name(provider).encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut credential: *mut CREDENTIALW = ptr::null_mut();
    let read = unsafe { CredReadW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None, &mut credential) };
    if let Err(error) = read {
        if error.code().0 as u32 == 1168 { return Ok(None); }
        return Err("Could not read the saved AI key from Windows Credential Manager.".into());
    }
    if credential.is_null() { return Err("Windows returned an invalid saved AI key.".into()); }

    let result = unsafe {
        let value = &*credential;
        let size = value.CredentialBlobSize as usize;
        if size == 0 { Ok(None) }
        else if size > 256 || value.CredentialBlob.is_null() {
            Err("The saved AI key is invalid. Forget it and connect again.".into())
        } else {
            String::from_utf8(slice::from_raw_parts(value.CredentialBlob, size).to_vec())
                .map(Some)
                .map_err(|_| "The saved AI key is unreadable. Forget it and connect again.".into())
        }
    };
    unsafe { CredFree(credential.cast()); }
    result
}

#[cfg(windows)]
pub fn save(provider: Provider, key: &str) -> Result<(), String> {
    use windows::{
        core::PWSTR,
        Win32::Security::Credentials::{
            CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
        },
    };

    let mut name = target_name(provider).encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut username = format!("Still AI {}", match provider { Provider::Gemini => "Gemini", Provider::Openai => "OpenAI", Provider::Opencode => "OpenCode" })
        .encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut credential = CREDENTIALW::default();
    credential.Type = CRED_TYPE_GENERIC;
    credential.TargetName = PWSTR(name.as_mut_ptr());
    credential.UserName = PWSTR(username.as_mut_ptr());
    credential.CredentialBlobSize = key.len() as u32;
    credential.CredentialBlob = key.as_bytes().as_ptr() as *mut u8;
    credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
    unsafe { CredWriteW(&credential, 0) }
        .map_err(|_| "Could not securely save the AI key in Windows Credential Manager.".to_string())
}

#[cfg(windows)]
pub fn delete(provider: Provider) -> Result<(), String> {
    use windows::{core::PCWSTR, Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC}};

    let name = target_name(provider).encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    match unsafe { CredDeleteW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None) } {
        Ok(()) => Ok(()),
        Err(error) if error.code().0 as u32 == 1168 => Ok(()),
        Err(_) => Err("Could not remove the saved AI key from Windows Credential Manager.".into()),
    }
}

// Keep other platform builds usable with session-only keys.
#[cfg(not(windows))]
pub fn load(_: Provider) -> Result<Option<String>, String> { Ok(None) }
#[cfg(not(windows))]
pub fn save(_: Provider, _: &str) -> Result<(), String> { Ok(()) }
#[cfg(not(windows))]
pub fn delete(_: Provider) -> Result<(), String> { Ok(()) }

#[cfg(test)]
mod tests {
    use super::target_name;
    use crate::assistant_protocol::Provider;

    #[test]
    fn gives_each_ai_provider_a_separate_credential_entry() {
        assert_ne!(target_name(Provider::Gemini), target_name(Provider::Openai));
        assert!(target_name(Provider::Gemini).starts_with("Still.AI."));
        assert!(target_name(Provider::Openai).starts_with("Still.AI."));
        assert_ne!(target_name(Provider::Gemini), target_name(Provider::Opencode));
        assert_ne!(target_name(Provider::Openai), target_name(Provider::Opencode));
        assert!(target_name(Provider::Opencode).starts_with("Still.AI."));
    }
}
