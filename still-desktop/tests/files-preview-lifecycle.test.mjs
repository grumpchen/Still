import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localFiles} from '../src/platform/files.ts';
import {localDocuments,previewDocument,previewFileDrop} from '../src/platform/resourceDrop.ts';

test('closing a preview Files widget releases only its selected File references',()=>{
 const file=(name)=>({name,webkitRelativePath:'Course/'+name,size:12});
 localFiles.select('files-one',[file('one.pdf')]);
 localFiles.select('files-two',[file('two.pdf')]);

 localFiles.release('files-one');

 assert.throws(()=>localFiles.browserList('files-one',''),/Choose a folder/);
 assert.deepEqual(localFiles.browserList('files-two','').entries.map(entry=>entry.name),['two.pdf']);
 localFiles.release('files-two');
});

test('selected Files and document files produce local typed previews and block program shortcuts',async()=>{
 const file=new File(['week 1'], 'week1.txt',{type:''});Object.defineProperty(file,'webkitRelativePath',{value:'Course/week1.txt'});
 localFiles.select('preview-files',[file]);
 const preview=await localFiles.preview('preview-files','week1.txt');
 assert.equal(preview.type,'text/plain');assert.equal(await preview.text(),'week 1');
 const program=new File(['not launched'],'setup.exe',{type:'application/octet-stream'});Object.defineProperty(program,'webkitRelativePath',{value:'Course/setup.exe'});
 localFiles.select('blocked-files',[program]);await assert.rejects(localFiles.preview('blocked-files','setup.exe'),/Programs and shortcuts/);
 localFiles.release('preview-files');localFiles.release('blocked-files');
});

test('browser Files previews enforce the same 20 MB bound as native previews',async()=>{
 const file={name:'large.pdf',size:20*1024*1024+1,type:'application/pdf',webkitRelativePath:'Course/large.pdf',slice(){throw new Error('oversized files must be rejected before reading')}};
 localFiles.select('large-files',[file]);
 await assert.rejects(localFiles.preview('large-files','large.pdf'),/20 MB preview limit/);
 localFiles.release('large-files');
});

test('a dropped PDF is available to the in-panel preview without opening or uploading it',async()=>{
 const pdf=new File(['%PDF-1.4 local'], 'lecture.pdf',{type:'application/pdf'}),{entries} = previewFileDrop([pdf]);
 const blob=await localDocuments.preview(entries[0].sourceId);
 assert.equal(blob.type,'application/pdf');assert.equal(await blob.text(),'%PDF-1.4 local');
 localDocuments.retain(new Set());
});

test('preview file references survive while a widget or preset uses them and are pruned after removal',()=>{
 const files=[{name:'first.pdf',size:10},{name:'second.pdf',size:20}];
 const {entries}=previewFileDrop(files);
 const retained=new Set([entries[0].sourceId]);

 localDocuments.retain(retained);

 assert.equal(previewDocument(entries[0].sourceId),files[0]);
 assert.equal(previewDocument(entries[1].sourceId),undefined);
});
