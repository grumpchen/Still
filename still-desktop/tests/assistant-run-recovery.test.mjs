import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantRunRecoveryMessage,clearAssistantRunRecovery,readAssistantRunRecovery,writeAssistantRunRecovery} from '../src/domain/assistantRunRecovery.ts';

function store(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values}}

test('recovery metadata is isolated by workspace and contains no proposal content',()=>{
 const storage=store();
 assert.equal(writeAssistantRunRecovery({workspaceId:'study',runId:'run-1',stage:'awaiting_review',kind:'workspace_action'},storage,123),true);
 assert.deepEqual(readAssistantRunRecovery('study',storage),{version:1,workspaceId:'study',runId:'run-1',stage:'awaiting_review',kind:'workspace_action',updatedAt:123});
 assert.equal(readAssistantRunRecovery('other',storage),null);
 assert.doesNotMatch([...storage.values.values()][0],/prompt|proposal|path|secret/i);
 assert.match(assistantRunRecoveryMessage(readAssistantRunRecovery('study',storage)),/approval expired/i);
});

test('applying recovery warns about uncertainty and never retries',()=>{
 const storage=store();writeAssistantRunRecovery({workspaceId:'study',runId:'run-2',stage:'applying',kind:'add_widget'},storage);
 const message=assistantRunRecoveryMessage(readAssistantRunRecovery('study',storage));
 assert.match(message,/uncertain/i);assert.match(message,/did not repeat/i);
});

test('saved execution receipts are described as complete without replay',()=>{
 const storage=store();writeAssistantRunRecovery({workspaceId:'study',runId:'run-3',stage:'receipt_saved',kind:'workspace_action'},storage);
 const message=assistantRunRecoveryMessage(readAssistantRunRecovery('study',storage));
 assert.match(message,/saved execution receipt/i);assert.match(message,/did not repeat/i);
});

test('ordinary Still review cards use the same metadata-only interrupted-review recovery',()=>{
 const storage=store();assert.equal(writeAssistantRunRecovery({workspaceId:'study',runId:'review-1',stage:'awaiting_review',kind:'assistant_review'},storage),true);
 const record=readAssistantRunRecovery('study',storage),message=assistantRunRecoveryMessage(record);
 assert.equal(record.kind,'assistant_review');assert.match(message,/Still change/i);assert.match(message,/approval expired/i);
 assert.doesNotMatch([...storage.values.values()][0],/layout|widget|prompt|proposal|coordinates/i);
});

test('stale run completion cannot clear a newer review',()=>{
 const storage=store();writeAssistantRunRecovery({workspaceId:'study',runId:'old',stage:'applying',kind:'workspace_action'},storage);
 writeAssistantRunRecovery({workspaceId:'study',runId:'new',stage:'awaiting_review',kind:'add_widget'},storage);
 assert.equal(clearAssistantRunRecovery('study','old',storage),false);
 assert.equal(readAssistantRunRecovery('study',storage)?.runId,'new');
 assert.equal(clearAssistantRunRecovery('study','new',storage),true);
 assert.equal(readAssistantRunRecovery('study',storage),null);
});

test('malformed recovery records fail closed and storage failures are reported',()=>{
 const storage=store();storage.setItem('still-assistant-run-recovery-v1:study',JSON.stringify({version:1,workspaceId:'other',runId:'run',stage:'applying',kind:'workspace_action',updatedAt:1}));
 assert.equal(readAssistantRunRecovery('study',storage),null);
 const full={getItem:()=>null,setItem:()=>{throw new Error('full')},removeItem:()=>{}};
 assert.equal(writeAssistantRunRecovery({workspaceId:'study',runId:'run',stage:'awaiting_review',kind:'workspace_action'},full),false);
});

test('Library folder proposals are valid recoverable review records',()=>{
 const storage=store();
 assert.equal(writeAssistantRunRecovery({workspaceId:'study',runId:'folder-1',stage:'awaiting_review',kind:'library_create_folder'},storage),true);
 assert.equal(readAssistantRunRecovery('study',storage)?.kind,'library_create_folder');
});
