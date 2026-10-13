import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteAssistantChat,readAssistantChat,saveAssistantChat,SAVED_CHAT_MESSAGE_LIMIT} from '../src/domain/assistantChat.ts';

function store(){
 const values=new Map();
 return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};
}

test('assistant chat is saved separately for each workspace and can be cleared',()=>{
 const storage=store(),study=[{role:'user',text:'Remember my note'},{role:'model',text:'I will'}],design=[{role:'user',text:'Design workspace'}];
 saveAssistantChat('study',study,storage);saveAssistantChat('design',design,storage);
 assert.deepEqual(readAssistantChat('study',storage),study);assert.deepEqual(readAssistantChat('design',storage),design);
 deleteAssistantChat('study',storage);assert.deepEqual(readAssistantChat('study',storage),[]);assert.deepEqual(readAssistantChat('design',storage),design);
});

test('assistant chat storage rejects malformed records and retains a bounded recent history',()=>{
 const storage=store(),messages=Array.from({length:SAVED_CHAT_MESSAGE_LIMIT+4},(_,index)=>({role:index%2?'model':'user',text:`turn ${index}`}));
 saveAssistantChat('study',messages,storage);
 const restored=readAssistantChat('study',storage);
 assert.equal(restored.length,SAVED_CHAT_MESSAGE_LIMIT);assert.equal(restored[0].text,'turn 4');assert.equal(restored.at(-1).text,`turn ${messages.length-1}`);
 storage.setItem('still-assistant-chat-v1:broken','not json');assert.deepEqual(readAssistantChat('broken',storage),[]);
 storage.setItem('still-assistant-chat-v1:shape',JSON.stringify([{role:'system',text:'discard'},{role:'user',text:5},{role:'model',text:'keep'}]));
 assert.deepEqual(readAssistantChat('shape',storage),[{role:'model',text:'keep'}]);
});
