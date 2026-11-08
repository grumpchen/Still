import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeFileMoves,reviewInboxMoves} from '../src/domain/assistantInbox.ts';

const entry=(path,directory=false)=>({path,name:path,directory,blocked:false,size:10,revision:directory?null:'10:1'});
const inspection={id:'inbox-1',rootPath:'D:/private',entries:[entry('a.md'),entry('b.md'),entry('c.md'),entry('Filed',true)],truncated:false};
const move=sourcePath=>({sourceWidgetId:'inbox-1',sourcePath,destinationFolder:'Filed',reason:'Requested.'});

test('a reviewed batch rejects unknown, stale, blocked, duplicate, or unchanged paths',()=>{
 const valid={fileProposals:[move('a.md'),move('b.md')]};
 const approved=reviewInboxMoves(valid,inspection);
 assert(Object.isFrozen(approved.moves[0]));
 assert.equal(approved.moves[0].sourceRevision,'10:1');
 assert.throws(()=>reviewInboxMoves(valid,null),/inspect the inbox/i);
 assert.throws(()=>reviewInboxMoves({fileProposals:[move('unknown.md')]},inspection),/available file/i);
 assert.throws(()=>reviewInboxMoves({fileProposals:[move('a.md'),move('a.md')]},inspection),/duplicate/i);
 assert.throws(()=>reviewInboxMoves({fileProposals:[{...move('a.md'),destinationFolder:''}]},inspection),/different folder/i);
 assert.throws(()=>reviewInboxMoves(valid,{...inspection,entries:[entry('Filed',true),{...entry('a.md'),blocked:true}]}),/available file/i);
});

test('a later stale file preserves the verified first move and never attempts the remainder',async()=>{
 const reviewed=reviewInboxMoves({fileProposals:['a.md','b.md','c.md'].map(move)},inspection);
 const attempted=[];
 const receipt=await executeFileMoves(reviewed.moves,async item=>{
  if(item.sourcePath==='b.md')throw new Error('File changed.');
 },async item=>{attempted.push(item.sourcePath);return 'Filed/'+item.sourcePath});
 assert.equal(receipt.completed,1);
 assert.equal(receipt.execution.status,'failed');
 assert.equal(receipt.execution.mutation,'partial');
 assert.match(receipt.execution.error,/1 of 3 file moves verified/);
 assert.match(receipt.execution.error,/a\.md → Filed\/a\.md/);
 assert.deepEqual(attempted,['a.md']);
});

test('a move that fails after dispatch is reported as unverified',async()=>{
 const reviewed=reviewInboxMoves({fileProposals:[move('a.md')]},inspection);
 const {execution}=await executeFileMoves(reviewed.moves,async()=>{},async()=>{throw new Error('IPC interrupted.')});
 assert.equal(execution.status,'failed');
 assert.equal(execution.mutation,'unknown');
 assert.match(execution.error,/Check the failed file before retrying/);
});
