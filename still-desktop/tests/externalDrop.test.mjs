import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewFileDrop,presetForDroppedResource,previewDocument} from '../src/platform/resourceDrop.ts';

test('dropping a PDF keeps the original file and gives a reusable typed shortcut without a typed path',()=>{
 const file=new File(['synthetic PDF fixture'],'CHEM111 Formula Sheet.pdf',{type:'application/pdf'});
 const result=previewFileDrop([file]);assert.equal(result.errors.length,0);assert.equal(result.entries.length,1);
 const entry=result.entries[0];assert.equal(entry.name,'CHEM111 Formula Sheet.pdf');assert.equal(entry.kind,'pdf');
 assert.equal(previewDocument(entry.sourceId),file);
 const preset=presetForDroppedResource(entry);assert.equal(preset.type,'files');assert.equal(preset.resourceKind,'document');
 assert.equal(preset.name,file.name);assert.equal(preset.fileKind,'pdf');assert.equal(preset.fileSourceId,entry.sourceId);
 assert.equal('path' in preset,false);
});

test('a mixed file drop accepts documents and reports blocked programs without launching them',()=>{
 const result=previewFileDrop([new File(['notes'],'notes.txt'),new File(['blocked'],'launch.cmd')]);
 assert.equal(result.entries.length,1);assert.equal(result.entries[0].kind,'document');
 assert.equal(result.errors.length,1);assert.match(result.errors[0],/launch.cmd/);
 assert.throws(()=>presetForDroppedResource({sourceId:'invalid',name:'Unsafe',kind:'website',url:'javascript:alert(1)',extension:'url'}));
});

test('folder and Internet shortcuts retain their resource types and do not invent paths',()=>{
 const folder=presetForDroppedResource({sourceId:'selected-folder',name:'CHEM111',kind:'folder',extension:''});
 assert.equal(folder.folderSourceId,'selected-folder');assert.equal(folder.folderName,'CHEM111');
 const website=presetForDroppedResource({sourceId:'',name:'ChatGPT',kind:'website',url:'https://chatgpt.com/',extension:'url'});
 assert.equal(website.type,'browser');assert.equal(website.url,'https://chatgpt.com/');
});
