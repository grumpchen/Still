import {test} from 'node:test';
import assert from 'node:assert/strict';

function installStorage(){
 const data=new Map();
 globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}

test('AI Command destructive approval is remembered for that exact command and workspace',async()=>{
 installStorage();
 const {hasAssistantCommandApproval,rememberAssistantCommandApproval}=await import('../src/domain/assistantCommandPermissions.ts');
 assert.equal(hasAssistantCommandApproval('workspace-1','command-1','delete all widgets'),false);
 assert.equal(rememberAssistantCommandApproval('workspace-1','command-1',' Delete   all widgets '),true);
 assert.equal(hasAssistantCommandApproval('workspace-1','command-1','delete all widgets'),true,'whitespace and letter case do not create a new command identity');
 assert.equal(hasAssistantCommandApproval('workspace-2','command-1','delete all widgets'),false,'approval does not cross workspaces');
 assert.equal(hasAssistantCommandApproval('workspace-1','command-2','delete all widgets'),false,'approval does not cross AI Command widgets');
 assert.equal(hasAssistantCommandApproval('workspace-1','command-1','delete all Focus widgets'),false,'editing the command requires a new confirmation');
});

test('malformed stored AI Command approvals fail closed',async()=>{
 installStorage();
 localStorage.setItem('still-ai-command-destructive-approvals-v1','not-json');
 const {hasAssistantCommandApproval,rememberAssistantCommandApproval}=await import('../src/domain/assistantCommandPermissions.ts');
 assert.equal(hasAssistantCommandApproval('workspace-1','command-1','delete all widgets'),false);
 assert.equal(rememberAssistantCommandApproval('workspace-1','command-1','delete all widgets'),true);
 assert.equal(hasAssistantCommandApproval('workspace-1','command-1','delete all widgets'),true);
});
