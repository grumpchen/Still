import test from 'node:test';
import {readFileSync} from 'node:fs';
const cases=JSON.parse(readFileSync(new URL('./library-protocol-cases.json',import.meta.url),'utf8'));
for(const c of cases)test(c.name,()=>{if(c.valid)assert.ok(parseAssistantReply(c.reply).libraryProposal);else assert.throws(()=>parseAssistantReply(c.reply));});
import assert from 'node:assert/strict';
import {parseAssistantReply} from '../src/domain/assistant.ts';
const operation={version:1,id:'create-1',type:'create_folder',parentId:'root:1',name:'Courses',reason:'Group course materials.'};
const proposal=()=>({version:1,rootId:'root:1',operations:[{...operation},{version:1,id:'move-1',type:'move',entryId:'entry:2',expectedRevision:'rev:1',destinationFolderId:'create-1',reason:'Course notes.'}]});
const response=p=>({intent:'chat',reply:'Review these changes.',layout:[],actions:[],libraryProposal:p});
test('Library proposals survive chat parsing without becoming actions',()=>{
  const p=proposal(),result=parseAssistantReply(response(p));
  assert.deepEqual(result.libraryProposal,p); assert.deepEqual(result.actions,[]);
  assert.equal(parseAssistantReply({...response(p),reply:''}).reply,'Review the proposed Library changes before applying them.');
  assert.equal(parseAssistantReply({...response(p),intent:'clarification'}).libraryProposal,undefined);
});
