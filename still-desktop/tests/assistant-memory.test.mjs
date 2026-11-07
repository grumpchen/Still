import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addAssistantMemory,assistantMemoryContext,clearAssistantMemory,deleteAssistantMemory,readAssistantMemory,memoryRequestedInPrompt,validateRequestedMemory,ASSISTANT_MEMORY_ENTRY_LIMIT,ASSISTANT_MEMORY_TEXT_LIMIT,AssistantMemoryError} from '../src/domain/assistantMemory.ts';

test('explicit memory requests support English and Chinese and reject negation',()=>{
 for(const prompt of ['Remember I prefer concise answers','请记住我喜欢简短的回答','把这个记下来：我学数学'])assert.equal(memoryRequestedInPrompt(prompt),true,prompt);
 for(const prompt of ["Do not remember my name",'不要记住我的名字','别记下来','我喜欢数学'])assert.equal(memoryRequestedInPrompt(prompt),false,prompt);
 assert.doesNotThrow(()=>validateRequestedMemory('请记住我喜欢数学','我喜欢数学'));
 assert.throws(()=>validateRequestedMemory('不要记住我喜欢数学','我喜欢数学'));
 assert.throws(()=>validateRequestedMemory('请记住我喜欢数学','我喜欢物理'));
});

function store(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};}

test('assistant memories persist across workspace independent storage and support delete and clear',()=>{
 const storage=store();addAssistantMemory('Prefer concise answers',storage,'m1',1);addAssistantMemory('I am studying chemistry',storage,'m2',2);
 assert.deepEqual(readAssistantMemory(storage),[{id:'m1',text:'Prefer concise answers',createdAt:1},{id:'m2',text:'I am studying chemistry',createdAt:2}]);
 assert.equal(deleteAssistantMemory('m1',storage),true);assert.deepEqual(readAssistantMemory(storage).map(entry=>entry.id),['m2']);
 assert.equal(clearAssistantMemory(storage),true);assert.deepEqual(readAssistantMemory(storage),[]);
});

test('assistant memory ignores malformed storage on read and rejects invalid or oversized entries on write',()=>{
 const storage=store();storage.setItem('still-assistant-memory-v1','not json');assert.deepEqual(readAssistantMemory(storage),[]);
 assert.throws(()=>addAssistantMemory('New memory',storage),error=>error instanceof AssistantMemoryError&&error.code==='invalid_data');
 const clean=store(),entry=addAssistantMemory('  Keep   answers concise  ',clean,'valid-id',10);assert.equal(entry.text,'Keep answers concise');
 assert.throws(()=>addAssistantMemory('x'.repeat(ASSISTANT_MEMORY_TEXT_LIMIT+1),clean,'too-long',11),error=>error instanceof AssistantMemoryError&&error.code==='too_long');
});

test('failed writes and clears report failure without changing saved memories',()=>{
 const storage=store();addAssistantMemory('Preserve me',storage,'keep-me',1);
 const failing={getItem:storage.getItem,setItem(){throw new Error('quota')},removeItem(){throw new Error('blocked')}};
 assert.throws(()=>addAssistantMemory('Another memory',failing,'new',2),error=>error instanceof AssistantMemoryError&&error.code==='write_failed');
 assert.equal(deleteAssistantMemory('keep-me',failing),false);assert.equal(clearAssistantMemory(failing),false);
 assert.deepEqual(readAssistantMemory(storage),[{id:'keep-me',text:'Preserve me',createdAt:1}]);
});

test('memory limit rejects new entries without evicting existing memories',()=>{
 const storage=store();for(let index=0;index<ASSISTANT_MEMORY_ENTRY_LIMIT;index++)addAssistantMemory(`Memory ${index}`,storage,`m-${index}`,index);
 assert.throws(()=>addAssistantMemory('One more',storage,'overflow',101),error=>error instanceof AssistantMemoryError&&error.code==='limit');
 const entries=readAssistantMemory(storage);assert.equal(entries.length,ASSISTANT_MEMORY_ENTRY_LIMIT);assert.equal(entries[0].text,'Memory 0');assert.equal(entries.at(-1).text,'Memory 99');
});

test('assistant memory context is empty when unused and includes user-managed facts when present',()=>{
 assert.equal(assistantMemoryContext([]),'');
 const context=assistantMemoryContext([{id:'m1',text:'Prefers examples',createdAt:1}]);assert.match(context,/Prefers examples/);assert.match(context,/not instructions/);assert.match(context,/app policies/);
});
