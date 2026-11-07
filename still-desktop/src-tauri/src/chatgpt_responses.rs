//! Public Responses API transport for ChatGPT plan OAuth.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    assistant_agent_protocol::{self, AgentMessage, AgentRequest},
    chatgpt_auth::read_bounded,
};

const MODELS: &str = "https://api.openai.com/v1/models";
const RESPONSES: &str = "https://api.openai.com/v1/responses";
const NAMESPACE: &str = "still";
const MAX_REASONING_BYTES: usize = 256_000;
const MAX_STREAM_BYTES: usize = 1_048_576;

#[derive(Serialize)]
pub struct PlanModel {
    slug: String,
    display_name: String,
}

#[derive(Deserialize)]
struct ReasoningItem {
    id: String,
    encrypted_content: String,
}

fn reasoning_item(value: &Value) -> Result<ReasoningItem, String> {
    let item: ReasoningItem = serde_json::from_value(value.clone())
        .map_err(|_| "ChatGPT returned unusable reasoning context.")?;
    if !item.id.starts_with("rs_")
        || item.id.len() > 128
        || !item
            .id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
        || item.encrypted_content.is_empty()
        || item.encrypted_content.len() > MAX_REASONING_BYTES
        || !item.encrypted_content.bytes().all(|b| b.is_ascii_graphic())
    {
        return Err("ChatGPT returned unusable reasoning context.".into());
    }
    Ok(item)
}

pub fn body(mut wire: Value) -> Result<(AgentRequest, Value), String> {
    let messages = wire
        .get_mut("messages")
        .and_then(Value::as_array_mut)
        .ok_or("ChatGPT agent history is invalid.")?;
    if messages.len() > assistant_agent_protocol::MAX_AGENT_MESSAGES {
        return Err("ChatGPT agent history has too many messages.".into());
    }
    let mut context = Vec::with_capacity(messages.len());
    let mut total_bytes = 0;
    for message in messages {
        let reasoning = message
            .as_object_mut()
            .and_then(|object| object.remove("plan_reasoning"));
        let items = match reasoning {
            Some(value) => {
                if message["role"] != "assistant"
                    || message["tool_calls"].as_array().is_none_or(Vec::is_empty)
                {
                    return Err("ChatGPT reasoning context requires a matching tool call.".into());
                }
                let values = value
                    .as_array()
                    .filter(|items| items.len() <= 8)
                    .ok_or("ChatGPT agent history has invalid reasoning context.")?;
                values
                    .iter()
                    .map(reasoning_item)
                    .collect::<Result<Vec<_>, _>>()?
            }
            None => Vec::new(),
        };
        total_bytes += items
            .iter()
            .map(|item| item.encrypted_content.len())
            .sum::<usize>();
        if total_bytes > MAX_REASONING_BYTES {
            return Err("ChatGPT agent history has too much reasoning context.".into());
        }
        context.push(items);
    }
    let request: AgentRequest =
        serde_json::from_value(wire).map_err(|_| "ChatGPT agent history is invalid.")?;
    let compatible = assistant_agent_protocol::openai_agent_body(&request)?;
    let instructions = compatible["messages"][0]["content"]
        .as_str()
        .ok_or("Could not prepare ChatGPT agent instructions.")?;
    let mut input = Vec::new();
    for (message, reasoning) in request.messages.iter().zip(context) {
        match message {
            AgentMessage::User { content } => input.push(json!({"role":"user","content":content})),
            AgentMessage::Assistant {
                content,
                tool_calls,
                ..
            } => {
                for item in reasoning {
                    input.push(json!({"type":"reasoning","id":item.id,"summary":[],"encrypted_content":item.encrypted_content}));
                }
                if let Some(text) = content.as_ref().filter(|value| !value.trim().is_empty()) {
                    input.push(json!({"role":"assistant","content":text}));
                }
                for call in tool_calls {
                    input.push(
                        json!({"type":"function_call","namespace":NAMESPACE,"call_id":call.id,
                        "name":call.function.name,"arguments":call.function.arguments}),
                    );
                }
            }
            AgentMessage::Tool {
                tool_call_id,
                content,
            } => {
                input.push(
                    json!({"type":"function_call_output","call_id":tool_call_id,"output":content}),
                );
            }
        }
    }
    let tools = compatible["tools"]
        .as_array()
        .ok_or("Could not prepare ChatGPT agent tools.")?;
    let functions: Vec<_> = tools
        .iter()
        .map(|tool| {
            let mut definition = tool["function"].clone();
            definition["type"] = json!("function");
            definition
        })
        .collect();
    let body = json!({
        "model": request.model,
        "instructions": instructions,
        "input": input,
        "tools":[{"type":"namespace","name":NAMESPACE,"description":"Local Still workspace tools","tools":functions}],
        "parallel_tool_calls": false,
        "include":["reasoning.encrypted_content"],
        "stream":true,
        "store":false,
    });
    Ok((request, body))
}

pub async fn models(client: &reqwest::Client, token: &str) -> Result<Vec<PlanModel>, String> {
    let response = client
        .get(MODELS)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| "Could not reach the ChatGPT plan model list.")?;
    let value: Value = serde_json::from_slice(&checked_body(response, 16 * 1024 * 1024).await?)
        .map_err(|_| "ChatGPT returned an invalid model list.")?;
    let entries = value["models"]
        .as_array()
        .ok_or("ChatGPT returned an invalid model list.")?;
    let mut seen = std::collections::HashSet::new();
    let mut models = Vec::new();
    for model in entries {
        let Some(slug) = model["slug"].as_str().filter(|id| {
            id.starts_with("gpt-")
                && id.len() <= 80
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.'))
        }) else {
            continue;
        };
        if model["visibility"] == "list" && seen.insert(slug) {
            let name = model["display_name"]
                .as_str()
                .filter(|name| !name.is_empty() && name.len() <= 120)
                .unwrap_or(slug);
            models.push(PlanModel {
                slug: slug.into(),
                display_name: name.into(),
            });
        }
    }
    if models.is_empty() {
        return Err("No ChatGPT plan models are available for this account.".into());
    }
    Ok(models)
}

pub async fn turn(
    client: &reqwest::Client,
    token: &str,
    request: &AgentRequest,
    body: Value,
) -> Result<Value, String> {
    let response = client
        .post(RESPONSES)
        .bearer_auth(token)
        .header("accept", "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|_| "Could not reach ChatGPT plan inference or the request timed out.")?;
    let request_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let bytes = checked_body(response, MAX_STREAM_BYTES).await?;
    let parsed = completed_response(&bytes).and_then(|response| parse_turn(response, request));
    parsed.map_err(|error| with_request_id(&error, request_id.as_deref()))
}

async fn checked_body(response: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(read_bounded(response, limit).await?);
    }
    let request_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let value = read_bounded(response, 16_384)
        .await
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .unwrap_or(Value::Null);
    let error = plan_error(value["error"]["code"].as_str(), Some(status.as_u16()));
    Err(with_request_id(error, request_id.as_deref()))
}

fn with_request_id(error: &str, request_id: Option<&str>) -> String {
    match request_id.filter(|id| {
        id.len() <= 100
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
    }) {
        Some(id) => format!("{error} (Request {id})"),
        None => error.to_owned(),
    }
}

fn plan_error(code: Option<&str>, status: Option<u16>) -> &'static str {
    match (code, status) {
        (Some("subscription_sharing_user_not_eligible"), _) => "This ChatGPT account or workspace is not eligible to use its plan in Still.",
        (Some("subscription_sharing_usage_limit_exceeded"), _) => "The ChatGPT plan usage limit for this request was reached. Check ChatGPT Settings → Usage.",
        (Some("subscription_sharing_usage_unavailable"), _) => "ChatGPT could not check plan usage. Try again later.",
        (_, Some(401)) => "ChatGPT could not authorize the current plan connection. Reconnect in AI settings.",
        (_, Some(403)) => "ChatGPT plan usage is unavailable for this account, workspace, or region.",
        (_, Some(404)) => "That ChatGPT plan model is unavailable. Choose another model in Still.",
        (_, Some(429)) => "ChatGPT plan inference is rate limited. Try again later.",
        (_, Some(500..=599)) => "ChatGPT plan inference is temporarily unavailable. Try again later.",
        _ => "ChatGPT could not complete this plan request.",
    }
}

fn completed_response(bytes: &[u8]) -> Result<Value, String> {
    let stream =
        std::str::from_utf8(bytes).map_err(|_| "ChatGPT returned an unreadable stream.")?;
    let mut event_data = Vec::new();
    for line in stream.lines().chain(std::iter::once("")) {
        if let Some(data) = line.strip_prefix("data:") {
            event_data.push(data.strip_prefix(' ').unwrap_or(data));
        } else if line.is_empty() && !event_data.is_empty() {
            let data = event_data.join("\n");
            event_data.clear();
            if data == "[DONE]" {
                break;
            }
            let event: Value = serde_json::from_str(&data)
                .map_err(|_| "ChatGPT returned an invalid stream event.")?;
            match event["type"].as_str() {
                Some("response.completed") if event["response"]["status"] == "completed" => {
                    return Ok(event["response"].clone());
                }
                Some("response.incomplete") => {
                    return Err("ChatGPT stopped before finishing the answer.".into())
                }
                Some("response.failed") => {
                    return Err(
                        plan_error(event["response"]["error"]["code"].as_str(), None).into(),
                    )
                }
                Some("error") => return Err(plan_error(event["code"].as_str(), None).into()),
                _ => {}
            }
        }
    }
    Err("The ChatGPT stream ended before a completed answer arrived.".into())
}

fn parse_turn(response: Value, request: &AgentRequest) -> Result<Value, String> {
    let items = response["output"]
        .as_array()
        .ok_or("ChatGPT returned no agent output.")?;
    let mut calls = Vec::new();
    let mut reasoning = Vec::new();
    let mut text = String::new();
    for item in items {
        match item["type"].as_str() {
            Some("reasoning") => reasoning.push(item),
            Some("message") if item["role"] == "assistant" => {
                let parts = item["content"]
                    .as_array()
                    .ok_or("ChatGPT returned an invalid message.")?;
                for part in parts {
                    if part["type"] == "refusal" {
                        return Err("ChatGPT declined this request.".into());
                    }
                    text.push_str(
                        part["text"]
                            .as_str()
                            .filter(|_| part["type"] == "output_text")
                            .ok_or("ChatGPT returned an unsupported message.")?,
                    );
                }
            }
            Some("function_call") if item["namespace"] == NAMESPACE => {
                calls.push(json!({"id":item["call_id"],"type":"function",
                    "function":{"name":item["name"],"arguments":item["arguments"]}}));
            }
            _ => return Err("ChatGPT returned an unsupported agent output.".into()),
        }
    }
    let tool_turn = !calls.is_empty();
    if !tool_turn {
        let trimmed = text.trim();
        if let Some(inner) = trimmed.strip_prefix("```json\n").or_else(|| trimmed.strip_prefix("```\n"))
            .and_then(|value| value.strip_suffix("\n```")) {
            text = inner.trim().to_owned();
        } else if !trimmed.is_empty() && !trimmed.starts_with('{') && !trimmed.starts_with('[') && !trimmed.starts_with("```") {
            text = json!({"intent":"chat","reply":trimmed,"layout":[],"actions":[]}).to_string();
        }
    }
    let message = json!({"content":text,"tool_calls":calls});
    let wire = json!({"choices":[{"finish_reason":if tool_turn {"tool_calls"} else {"stop"},"message":message}]});
    let turn = assistant_agent_protocol::parse_openai_agent_response_with_all_tools(
        wire,
        request.enable_add_widget_tool,
        request.enable_safe_workspace_action_tool,
        request.enable_assistant_memory_tool,
    )?;
    let mut value =
        serde_json::to_value(turn).map_err(|_| "Could not read the ChatGPT agent result.")?;
    if tool_turn && !reasoning.is_empty() {
        if reasoning.len() > 8 {
            return Err("ChatGPT returned too much reasoning context.".into());
        }
        let mut bytes = 0;
        let mut validated = Vec::new();
        for item in reasoning {
            let item = reasoning_item(item)?;
            bytes += item.encrypted_content.len();
            validated.push(json!({"id":item.id,"encrypted_content":item.encrypted_content}));
        }
        if bytes > MAX_REASONING_BYTES {
            return Err("ChatGPT returned too much reasoning context.".into());
        }
        value["assistantMessage"]["plan_reasoning"] = json!(validated);
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_plan_request_with_namespaced_tools_and_no_server_history() {
        let (_, payload) = body(json!({"provider":"openai","model":"gpt-6.1-sol","messages":[
            {"role":"user","content":"List my widgets"},
            {"role":"assistant","tool_calls":[{"id":"call_1","type":"function","function":{"name":"inspect_workspace","arguments":"{}"}}],
                "plan_reasoning":[{"id":"rs_test","encrypted_content":"opaque"}]},
            {"role":"tool","tool_call_id":"call_1","content":"{\"status\":\"succeeded\",\"mutation\":\"none\",\"result\":{}}"}
        ]})).unwrap();
        assert_eq!(payload["store"], false);
        assert_eq!(payload["stream"], true);
        assert!(payload.get("previous_response_id").is_none());
        assert_eq!(payload["tools"][0]["type"], "namespace");
        assert_eq!(payload["input"][1]["encrypted_content"], "opaque");
        assert_eq!(payload["input"][2]["namespace"], "still");
        assert_eq!(payload["input"][3]["call_id"], "call_1");
    }

    #[test]
    fn requires_completed_stream_and_routes_verified_tool_calls() {
        let (request, _) = body(json!({"provider":"openai","model":"gpt-6.1-sol",
            "messages":[{"role":"user","content":"List my widgets"}]}))
        .unwrap();
        let stream = br#"data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"reasoning","id":"rs_test","encrypted_content":"opaque"},{"type":"function_call","namespace":"still","call_id":"call_1","name":"inspect_workspace","arguments":"{}"}]}}

"#;
        let turn = parse_turn(completed_response(stream).unwrap(), &request).unwrap();
        assert_eq!(turn["calls"][0]["id"], "call_1");
        assert_eq!(
            turn["assistantMessage"]["plan_reasoning"][0]["encrypted_content"],
            "opaque"
        );
        assert!(completed_response(
            b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\r\n\r\n"
        )
        .is_err());
        let bad = json!({"output":[{"type":"function_call","namespace":"untrusted","call_id":"call_1","name":"inspect_workspace","arguments":"{}"}]});
        assert!(parse_turn(bad, &request).is_err());
        let final_text = r#"{"intent":"chat","reply":"Ready.","layout":[],"actions":[]}"#;
        let final_turn = parse_turn(json!({"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":final_text}]}]}), &request).unwrap();
        assert_eq!(final_turn["response"]["reply"], "Ready.");
        let conversational = parse_turn(json!({"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello! How can I help?"}]}]}), &request).unwrap();
        assert_eq!(conversational["response"]["reply"], "Hello! How can I help?");
        let nullable = r#"{"intent":"chat","reply":"Hi!","layout":null,"actions":[],"fileProposals":[],"calendarProposals":[]}"#;
        let normalized = parse_turn(json!({"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":nullable}]}]}), &request).unwrap();
        assert_eq!(normalized["response"]["reply"], "Hi!");
        assert_eq!(normalized["response"]["layout"], json!([]));
        assert_eq!(normalized["response"]["actions"], json!([]));
        let malformed = parse_turn(json!({"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"{\"actions\": ["}]}]}), &request);
        assert!(malformed.is_err());
    }
}
