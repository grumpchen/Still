# General assistant with reliable widget actions

The user wants normal AI conversation and ordinary language such as “make notes widget,” with access to useful Still controls. Keep the requested limits of 10 add/open items per request and 100 cards per workspace. Do not require the user to know action names or IDs.

Use local handlers for unambiguous gallery commands and the model for richer or indirect requests. The model receives the complete widget and action catalogue, supports names and initial Notes content, and can ask follow-up questions normally. A valid action response does not need separate prose because the application supplies the real completion receipt.

Model interpretations that differ from the local classifier become reviewable proposals. Confirmation authorizes those exact validated actions; removal and saved application launch remain confirmed operations. Validate IDs, supported fields, payload sizes and batch/workspace limits before mutation. Preserve ordinary general chat, writing and explanation requests.

Pure model execution makes every basic command depend on network/model output. A fixed phrase gate rejects natural language and was the cause of the reported “make” failure. The chosen hybrid keeps simple commands responsive while letting the model interpret other wording without discarding useful responses.

Tests cover the original command in the rendered chat with a deliberately failing provider stub, frontend/backend action catalogue agreement, valid action-only replies, indirect proposals, follow-up replies, creation fields and existing robustness limits. No real provider keys or requests are needed for this verification.
