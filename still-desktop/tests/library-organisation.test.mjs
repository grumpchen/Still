import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewLibraryProposal,executeLibraryProposal,remapLibraryPath} from '../src/domain/libraryOrganisation.ts';
const snapshot={version:1,rootId:'root-1',rootName:'Course',truncated:false,entries:[{id:'file-1',name:'week.md',path:'week.md',directory:false,size:8,revision:'rev-1'},{id:'folder-1',name:'Old',path:'Old',directory:true,size:0,revision:'dir-1'},{id:'file-2',name:'notes.txt',path:'Old/notes.txt',directory:false,size:9,revision:'rev-2'}]};
const create={version:1,id:'new-folder',type:'create_folder',parentId:'root-1',name:'Lectures',reason:'Group lectures'};
const move={version:1,id:'move-1',type:'move',entryId:'file-1',expectedRevision:'rev-1',destinationFolderId:'new-folder',reason:'File by topic'};
const proposal=operations=>({version:1,rootId:'root-1',operations});
test('review resolves created-folder dependencies and shows relative before/after without executing',()=>{
 const rows=reviewLibraryProposal(snapshot,proposal([create,move]));
 assert.equal(rows[0].destinationPath,'Lectures');assert.equal(rows[1].sourcePath,'week.md');assert.equal(rows[1].destinationPath,'Lectures/week.md');
});
test('review rejects outside roots, missing dependencies, collisions, extension changes and overlapping folder sources',()=>{
 assert.throws(()=>reviewLibraryProposal(snapshot,{...proposal([create]),rootId:'outside'}));
 assert.throws(()=>reviewLibraryProposal(snapshot,proposal([move])));
 for(const name of ['../bad','NUL.txt','safe:bad','trail.'])assert.throws(()=>reviewLibraryProposal(snapshot,proposal([{...create,name}])));
 assert.throws(()=>reviewLibraryProposal(snapshot,proposal([{...create,name:'old'}])));
 assert.throws(()=>reviewLibraryProposal(snapshot,proposal([{version:1,id:'rename',type:'rename',entryId:'file-1',expectedRevision:'rev-1',name:'week.exe',reason:'Rename'}])));
 assert.throws(()=>reviewLibraryProposal(snapshot,proposal([{version:1,id:'rename',type:'rename',entryId:'folder-1',expectedRevision:'dir-1',name:'New',reason:'Rename folder'},{...move,entryId:'file-2',expectedRevision:'rev-2',destinationFolderId:'root-1'}])));
});
test('executor resolves opaque created IDs, stops on partial failure and preserves actual receipts',async()=>{
 const calls=[],receipts=[];
 const result=await executeLibraryProposal(snapshot,proposal([create,move]),async operation=>{
  calls.push(operation);if(operation.type==='move')throw new Error('Locked source');
  return {id:operation.id,rootId:'root-1',type:operation.type,sourcePath:null,destinationPath:'Lectures',entryId:'created-native',revision:'new-rev',undoToken:'undo-1',affectedCount:1};
 },async receipt=>{receipts.push(receipt)});
 assert.equal(calls[1].destinationFolderId,'created-native');assert.equal(result.receipts.length,1);assert.equal(receipts.length,1);assert.match(result.error,/Locked source/);assert.equal(result.remaining,1);
});
test('folder path migration preserves descendants without matching same-name prefixes',()=>{
 assert.equal(remapLibraryPath('Old/notes.txt','Old','New'),'New/notes.txt');assert.equal(remapLibraryPath('Older/notes.txt','Old','New'),'Older/notes.txt');
});
