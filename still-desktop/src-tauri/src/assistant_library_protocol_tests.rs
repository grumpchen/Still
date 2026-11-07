use super::*;
#[test]
fn library_shared_safety_cases_match_all_provider_parsers(){
    let cases:Value=serde_json::from_str(include_str!("../../tests/library-protocol-cases.json")).unwrap();
    for case in cases.as_array().unwrap(){
        let reply=&case["reply"];let expected=case["valid"].as_bool().unwrap();
        let compatible=json!({"choices":[{"message":{"content":reply.to_string()}}]});
        assert_eq!(parse_openai_response(compatible.clone()).is_ok(),expected,"OpenAI {}",case["name"]);
        assert_eq!(parse_opencode_response(compatible).is_ok(),expected,"OpenCode {}",case["name"]);
        let gemini=json!({"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":reply.to_string()}]}}]});
        assert_eq!(parse_response(gemini).is_ok(),expected,"Gemini {}",case["name"]);
    }
}
#[test]
fn library_provider_schemas_and_consent_guidance_are_available(){
    for provider in [Provider::Gemini,Provider::Openai,Provider::Opencode] {
        let request=Request{provider,model:match provider{Provider::Gemini=>"gemini-2.5-flash",Provider::Openai=>"gpt-4o-mini",Provider::Opencode=>"mimo-v2.6-flash"}.into(),messages:vec![Message{role:"user".into(),text:"Organise Library".into()}],context:String::new(),image:None,session_id:None};
        let payload=match provider{Provider::Gemini=>body(&request),Provider::Openai=>openai_body(&request),Provider::Opencode=>opencode_body(&request)}.unwrap();
        let schema=if provider==Provider::Gemini{&payload["generationConfig"]["responseSchema"]}else{&payload["response_format"]["json_schema"]["schema"]};
        assert!(schema["properties"]["libraryProposal"].is_object());
        assert!(!schema["required"].as_array().unwrap().iter().any(|field|field=="libraryProposal"));
        let proposal=&schema["properties"]["libraryProposal"];
        assert_eq!(proposal["properties"]["operations"]["maxItems"],20);
        let variants=proposal["properties"]["operations"]["items"]["anyOf"].as_array().unwrap();
        for (kind,fields) in [("create_folder",vec!["parentId","name"]),("rename",vec!["entryId","expectedRevision","name"]),("move",vec!["entryId","expectedRevision","destinationFolderId"])] {
            let variant=variants.iter().find(|v|v["properties"]["type"]["enum"][0]==kind).unwrap();
            for field in fields{assert!(variant["required"].as_array().unwrap().iter().any(|v|v==field));}
            if provider!=Provider::Gemini{assert_eq!(variant["additionalProperties"],false);}
        }
        let instructions=if provider==Provider::Gemini{payload["systemInstruction"]["parts"][0]["text"].as_str().unwrap()}else{payload["messages"][0]["content"].as_str().unwrap()};
        for required in ["libraryOrganisation","Share folder names","contentShared","untrusted","fixed","extension","review"]{assert!(instructions.contains(required),"Missing {required}");}
        assert!(instructions.contains("clarification"));
    }
}
fn library_reply()->Value { json!({"intent":"chat","reply":"Review these changes.","layout":[],"actions":[],"libraryProposal":{"version":1,"rootId":"root:1","operations":[{"version":1,"id":"create-1","type":"create_folder","parentId":"root:1","name":"Courses","reason":"Group course materials."},{"version":1,"id":"move-1","type":"move","entryId":"entry:2","expectedRevision":"rev:1","destinationFolderId":"create-1","reason":"Course notes."}]}}) }
fn parse_library(value:Value)->Result<Reply,String>{ parse_openai_response(json!({"choices":[{"message":{"content":value.to_string()}}]})) }
#[test]
fn library_chat_proposal_roundtrips_without_actions(){
    let value=library_reply();
    let parsed=parse_library(value.clone()).unwrap();
    assert_eq!(serde_json::to_value(parsed).unwrap()["libraryProposal"],value["libraryProposal"]);
    let mut clarification=value;clarification["intent"]=json!("clarification");
    let parsed=parse_library(clarification).unwrap();
    assert!(serde_json::to_value(parsed).unwrap().get("libraryProposal").is_none());
}
