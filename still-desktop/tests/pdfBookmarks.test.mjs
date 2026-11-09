import assert from 'node:assert/strict';
import test from 'node:test';
import {checkedPdfPageReference,pdfBookmarkStorageKey,readPdfBookmarks,writePdfBookmarks} from '../src/domain/pdfBookmarks.ts';

test('PDF page bookmarks are isolated by document, bounded, sorted and locally persistent',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const key=pdfBookmarkStorageKey('files-widget','lectures/week 1.pdf','revision-a');
 assert.notEqual(key,pdfBookmarkStorageKey('files-widget','lectures/week 1.pdf','revision-b'));
 assert.notEqual(key,pdfBookmarkStorageKey('other-widget','lectures/week 1.pdf','revision-a'));
 writePdfBookmarks(storage,key,[3,1,3],4);assert.deepEqual(readPdfBookmarks(storage,key,4),[1,3]);
 assert.deepEqual(readPdfBookmarks(storage,key,2),[],'stale out-of-range pages are ignored');
 values.set(key,'not json');assert.deepEqual(readPdfBookmarks(storage,key,4),[]);
 assert.throws(()=>writePdfBookmarks(storage,key,[0],4),/invalid/);
 assert.throws(()=>writePdfBookmarks(storage,key,[5],4),/invalid/);
 writePdfBookmarks(storage,key,[],4);assert.deepEqual(readPdfBookmarks(storage,key,4),[]);
});

test('PDF page references accept only bounded workspace-relative PDF locations',()=>{
 const valid={widgetId:'files-widget-1',path:'Lectures/week 1.pdf',name:'week 1.pdf',page:12};
 assert.deepEqual(checkedPdfPageReference(valid),valid);
 for(const candidate of [
  {...valid,path:'../secret.pdf'}, {...valid,path:'C:/secret.pdf'}, {...valid,path:'folder\\secret.pdf'},
  {...valid,path:'/absolute.pdf'}, {...valid,name:'lecture.txt'}, {...valid,page:0}, {...valid,page:1.5},
  {...valid,widgetId:'bad id'}, {...valid,path:'folder//lecture.pdf'},
 ])assert.equal(checkedPdfPageReference(candidate),null,JSON.stringify(candidate));
});
