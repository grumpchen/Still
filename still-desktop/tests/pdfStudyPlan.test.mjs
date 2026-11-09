import assert from 'node:assert/strict';
import test from 'node:test';
import {createInitialState,parseState} from '../src/domain/workspaces.ts';

test('PDF page study-plan links persist locally and malformed links are discarded',()=>{
 const state=createInitialState(),timetable=state.workspaces[0].widgets.find(widget=>widget.type==='timetable');
 const source={widgetId:'files-widget-1',path:'Lectures/week 1.pdf',name:'week 1.pdf',page:12};
 timetable.schedule=[{id:'study-page-12',day:0,time:'09:30',title:'Study week 1',location:'PDF page 12',pdfSource:source}];
 const saved=JSON.parse(JSON.stringify(state)),restored=parseState(saved).workspaces[0].widgets.find(widget=>widget.type==='timetable');
 assert.deepEqual(restored.schedule[0].pdfSource,source);
 saved.workspaces[0].widgets.find(widget=>widget.type==='timetable').schedule[0].pdfSource={...source,path:'../../outside.pdf'};
 const sanitized=parseState(saved).workspaces[0].widgets.find(widget=>widget.type==='timetable');
 assert.equal(Object.hasOwn(sanitized.schedule[0],'pdfSource'),false);
});
