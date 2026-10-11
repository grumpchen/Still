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

test('preview file references survive while a widget or preset uses them and are pruned after removal',()=>{
 const files=[{name:'first.pdf',size:10},{name:'second.pdf',size:20}];
 const {entries}=previewFileDrop(files);
 const retained=new Set([entries[0].sourceId]);

 localDocuments.retain(retained);

 assert.equal(previewDocument(entries[0].sourceId),files[0]);
 assert.equal(previewDocument(entries[1].sourceId),undefined);
});
