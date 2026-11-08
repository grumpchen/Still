import assert from 'node:assert/strict';
import test from 'node:test';
import {checkedPdfHighlightKeywords,findPdfHighlightRanges,pdfHighlightStorageKey,readPdfHighlights,writePdfHighlights} from '../src/domain/pdfHighlights.ts';

test('AI keyword replies must be bounded JSON phrases found in the explicitly shared PDF text',()=>{
 assert.deepEqual(checkedPdfHighlightKeywords('{"keywords":["cell membrane","osmosis"]}','The cell   membrane controls osmosis.'),['cell membrane','osmosis']);
 for(const reply of ['not json','{"keywords":["not present"]}','{"keywords":["osmosis","OSMOSIS"]}','{"keywords":[]}','{"keywords":['+Array.from({length:21},(_,i)=>JSON.stringify(`term ${i}`)).join(',')+']}'])assert.throws(()=>checkedPdfHighlightKeywords(reply,'osmosis term 0 term 1 term 2 term 3 term 4 term 5 term 6 term 7 term 8 term 9 term 10 term 11 term 12 term 13 term 14 term 15 term 16 term 17 term 18 term 19 term 20'),/keyword|matched/i);
});

test('PDF keyword positions map across text spans and repeated phrases',()=>{
 const ranges=findPdfHighlightRanges(['Cell  membrane controls','osmosis; cell membrane.'],['cell membrane','osmosis']);
 assert.deepEqual(ranges,[
  {spanIndex:0,start:0,end:5,keyword:'cell membrane'},
  {spanIndex:0,start:6,end:14,keyword:'cell membrane'},
  {spanIndex:1,start:0,end:7,keyword:'osmosis'},
  {spanIndex:1,start:9,end:22,keyword:'cell membrane'},
 ]);
});

test('PDF highlights are keyed by file and revision and storage is bounded',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const first=pdfHighlightStorageKey('widget','lectures/week 1.pdf','rev-a'),second=pdfHighlightStorageKey('widget','lectures/week 1.pdf','rev-b');
 writePdfHighlights(storage,first,['osmosis']);assert.deepEqual(readPdfHighlights(storage,first),['osmosis']);assert.deepEqual(readPdfHighlights(storage,second),[]);
 values.set(second,'invalid');assert.deepEqual(readPdfHighlights(storage,second),[]);
 writePdfHighlights(storage,first,[]);assert.deepEqual(readPdfHighlights(storage,first),[]);
});
