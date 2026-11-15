import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedFileReadingStatus,findRelatedNotes,formatStudyQuestions,parseStudyQuestions} from '../src/domain/fileStudy.ts';
import {checkedNoteSources} from '../src/domain/noteDocuments.ts';

test('reading status accepts only bounded relative file paths and supported states',()=>{
 assert.deepEqual(checkedFileReadingStatus({
  'Course/week1.pdf':'in-progress',
  '../outside.pdf':'done',
  'C:\\outside.pdf':'done',
  'Course/unknown.pdf':'later',
  '':'unread',
 }),{'Course/week1.pdf':'in-progress'});
 const saturated=Object.fromEntries(Array.from({length:500},(_,index)=>[`file-${index}.pdf`,'done']));
 const updated=checkedFileReadingStatus({...saturated,'new-file.pdf':'in-progress'});
 assert.equal(Object.keys(updated).length,500);
 assert.equal(updated['new-file.pdf'],'in-progress','new status updates evict the oldest bounded entry');
});

test('related notes rank title matches above body-only matches and return no unrelated notes',()=>{
 const docs=[
  {id:'n1',title:'Deadline policy',text:'Details about the agreement.'},
  {id:'n2',title:'General notes',text:'The report deadline appears here.'},
  {id:'n3',title:'Biology',text:'Cells and organisms.'},
 ];
 assert.deepEqual(findRelatedNotes('Agreement.pdf','The report deadline is September 30.',docs).map(item=>item.id),['n1','n2']);
 assert.deepEqual(findRelatedNotes('Biology.pdf','Cells and organisms.',docs).map(item=>item.id),['n3']);
});

test('study question parser accepts fenced JSON, rejects malformed entries, bounds output and formats answers',()=>{
 const response='```json\n'+JSON.stringify([
  {question:'What is the deadline?',answer:'September 30.'},
  {question:'',answer:'Ignore me'},
  ...Array.from({length:10},(_,index)=>({question:`Question ${index}`,answer:'Answer'})),
 ])+'\n```';
 const parsed=parseStudyQuestions(response);
 assert.equal(parsed.length,8);
 assert.equal(parsed[0].question,'What is the deadline?');
 assert.match(formatStudyQuestions(parsed),/Answer: September 30\./);
 assert.deepEqual(parseStudyQuestions('not json'),[]);
});

test('note source citations reject traversal and validate page references',()=>{
 assert.deepEqual(checkedNoteSources([
  {widgetId:'files-1',path:'Course/agreement.pdf',fileName:'agreement.pdf',page:3},
  {widgetId:'files-1',path:'../secret.pdf',fileName:'secret.pdf',page:1},
  {widgetId:'files-1',path:'Course/agreement.pdf',fileName:'agreement.pdf',page:0},
 ]),[
  {widgetId:'files-1',path:'Course/agreement.pdf',fileName:'agreement.pdf',page:3},
  {widgetId:'files-1',path:'Course/agreement.pdf',fileName:'agreement.pdf'},
 ]);
});
