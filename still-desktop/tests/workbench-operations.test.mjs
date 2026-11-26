import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';
import {configureCollectionOperationHost} from '../src/platform/collectionOperations.ts';
import {createWorkbenchService} from '../src/platform/workbenchOperations.ts';

function installStorage(){const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};return values}
afterEach(()=>{delete globalThis.localStorage});
function stateWithCourses(){const state=createInitialState(),source=createWorkspace('Source',[]),target=createWorkspace('Biology',[]);state.workspaces.push(source,target);return{state,source,target}}
const emptyLayoutHandlers={save:()=> 'saved',apply:()=> 'applied',rename:()=> 'renamed',duplicate:()=> 'duplicated',delete:()=> 'deleted'};

test('workbench snapshot lists workspace resource and layout metadata without exposing widget content',()=>{
 const {state,source}=stateWithCourses();source.widgets.push({...createWorkspace('Temp',['files']).widgets[0],folderKey:'folder-grant',folderName:'Reading'});source.groups=[{id:'group-saved',name:'Saved',shortcuts:[{id:'saved-link',name:'Lecture',url:'https://example.edu'}],widgets:[],expanded:false}];state.globalLayouts=[{id:'layout-1',name:'Exam setup',createdAt:12,widgets:[],groups:[]}];
 const service=createWorkbenchService({getState:()=>state,commitState(){},layoutHandlers:emptyLayoutHandlers,saveRule:async()=>({kind:'rule'}),getCaptureEvent:async()=>null});const result=service.snapshot();
 assert.equal(result.workspaces.find(item=>item.id===source.id).files[0].name,'Reading');assert.equal(result.workspaces.find(item=>item.id===source.id).links[0].id,'saved-link');assert.deepEqual(result.layouts,[{id:'layout-1',name:'Exam setup',createdAt:12,widgetCount:0,groupCount:0}]);
});

test('workbench collection dispatch uses the shared pure reducer and returns the real created link receipt',async()=>{
 installStorage();const {state,source,target}=stateWithCourses();let current=state;configureCollectionOperationHost({getState:()=>current,commitState:next=>{current=next}});
 const service=createWorkbenchService({getState:()=>current,commitState:next=>{current=next},layoutHandlers:emptyLayoutHandlers,saveRule:async()=>({kind:'unsupported',message:'unsupported'}),getCaptureEvent:async()=>null});
 const [receipt]=await service.executeWorkbenchActions([{operation:'link.create',workspaceId:source.id,name:'Lecture',url:'https://example.edu/lecture'}]);
 assert.equal(receipt.status,'succeeded');assert.equal(receipt.changed,true);assert.ok(receipt.data.linkId);const stored=current.workspaces.find(item=>item.id===source.id).groups[0].shortcuts[0];assert.equal(stored.id,receipt.data.linkId);assert.equal(stored.name,'Lecture');
 const [moved]=await service.executeWorkbenchActions([{operation:'link.move',origin:{kind:'group',workspaceId:source.id,groupId:current.workspaces.find(item=>item.id===source.id).groups[0].id},linkId:stored.id,destinationWorkspaceId:target.id}]);assert.equal(moved.status,'succeeded');assert.equal(current.workspaces.find(item=>item.id===target.id).groups[0].shortcuts[0].id,stored.id);
});

test('workbench action batches search linked URLs and files while reporting inaccessible folder roots',async()=>{
 const {state,source}=stateWithCourses();source.groups=[{id:'saved-links',name:'Saved',shortcuts:[{id:'link-1',name:'Lecture',url:'https://example.edu/chapter'}],widgets:[],expanded:false}];let searched;const service=createWorkbenchService({getState:()=>state,commitState(){},layoutHandlers:emptyLayoutHandlers,saveRule:async()=>({kind:'unsupported',message:'unsupported'}),getCaptureEvent:async()=>null,searchFiles:async(ids,query)=>{searched={ids,query};return{results:[],unavailableWidgetIds:ids,truncated:true}}});
 const result=await service.executeWorkbenchActions([{operation:'layout.list'},{operation:'resource.find',query:'chapter'}]);assert.equal(result.length,2);assert.equal(result[1].data.truncated,true);assert.match(result[1].summary,/limit/);assert.equal(result[1].data.results.some(item=>item.kind==='link'&&item.linkId==='link-1'),true);assert.equal(searched.ids.length,state.workspaces.flatMap(workspace=>workspace.widgets).filter(widget=>widget.type==='files'&&widget.folderKey).length);assert.equal(searched.query,'chapter');
 await assert.rejects(()=>service.executeWorkbenchActions([{operation:'link.create',workspaceId:state.activeId,name:'One',url:'https://one.example'},{operation:'link.create',workspaceId:state.activeId,name:'Two',url:'https://two.example'}]),/invalid Still action/);
});

test('layout automation shares an opaque idempotency key across concurrent and restarted dispatchers',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};const {state,target}=stateWithCourses();state.globalLayouts=[{id:'weekly',name:'Weekly',createdAt:1,widgets:[],groups:[]}];let calls=0,release;const gate=new Promise(resolve=>release=resolve);const options={getState:()=>state,commitState(){},getLayouts:()=>state.globalLayouts,layoutHandlers:{...emptyLayoutHandlers,apply:async()=>{throw new Error('manual apply handler should not be used')},prepare:async()=>{calls++;await gate;return'layout applied'}},saveRule:async()=>({kind:'unsupported',message:'unsupported'}),getCaptureEvent:async()=>null,storage};const first=createWorkbenchService(options),context={ruleId:'rule:@ user',occurrenceKey:'weekly:Etc/UTC/2026-11-26',scheduledAt:'2026-11-26T11:00:00.000Z',attempt:1,idempotencyKey:'arbitrary key/@:occurrence+timezone'};const action={kind:'prepareWorkspaceLayout',workspaceId:target.id,layoutId:'weekly',mode:'append'};
 const a=first.automationService.execute(action,context),b=first.automationService.execute(action,context);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);release();assert.deepEqual(await a,await b);assert.equal(calls,1);
 const restarted=createWorkbenchService(options),replayed=await restarted.automationService.execute(action,{...context,attempt:2});assert.equal(replayed.status,'succeeded');assert.equal(calls,1);
});

test('automation never retries an uncertain layout mutation after its result is journaled',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};const {state,target}=stateWithCourses();state.globalLayouts=[{id:'weekly',name:'Weekly',createdAt:1,widgets:[],groups:[]}];let calls=0;const options={getState:()=>state,commitState(){},getLayouts:()=>state.globalLayouts,layoutHandlers:{...emptyLayoutHandlers,apply:async()=>{calls++;throw new Error('commit status lost')}} ,saveRule:async()=>({kind:'unsupported',message:'unsupported'}),getCaptureEvent:async()=>null,storage};const action={kind:'prepareWorkspaceLayout',workspaceId:target.id,layoutId:'weekly',mode:'replace'},context={ruleId:'opaque/rule',occurrenceKey:'opaque occurrence TZ:Pacific/Apia',scheduledAt:'2026-11-26T00:00:00Z',attempt:1,idempotencyKey:'opaque key:still valid'};
 const first=createWorkbenchService(options),result=await first.automationService.execute(action,context);assert.equal(result.status,'outcome_unknown');const again=await createWorkbenchService(options).automationService.execute(action,{...context,attempt:2});assert.equal(again.status,'outcome_unknown');assert.equal(calls,1);
});

test('capture automation moves only the exact matching captured link and clarifies stale or unrelated captures',async()=>{
 installStorage();const {state,source,target}=stateWithCourses();source.groups=[{id:'saved',name:'Saved links',shortcuts:[{id:'captured-link',name:'Lecture 4',url:'https://example.edu/4'}],widgets:[],expanded:false}];let current=state;configureCollectionOperationHost({getState:()=>current,commitState:next=>{current=next}});const event={eventId:'capture-1',capturedAt:new Date().toISOString(),kind:'link',name:'Lecture 4',status:'pending',sourceWorkspaceId:source.id,origin:{kind:'group',workspaceId:source.id,groupId:'saved'},linkId:'captured-link'};const service=createWorkbenchService({getState:()=>current,commitState:next=>{current=next},layoutHandlers:emptyLayoutHandlers,saveRule:async()=>({kind:'unsupported',message:'unsupported'}),getCaptureEvent:async id=>id===event.eventId?event:null,getCourses:()=>[{id:'course-bio',title:'Biology',workspaceId:target.id}]});const action={kind:'fileResourcesToCourse',courseId:'course-bio',workspaceId:target.id,resourceKinds:['link'],queryPattern:'lecture'};const context={ruleId:'rule.2',occurrenceKey:'capture-event:capture-1',scheduledAt:event.capturedAt,attempt:1,idempotencyKey:'rule.2/capture-event:capture-1',captureEventId:event.eventId};
 const moved=await service.automationService.execute(action,context);assert.equal(moved.status,'succeeded');assert.equal(current.workspaces.find(item=>item.id===source.id).groups[0].shortcuts.length,0);assert.equal(current.workspaces.find(item=>item.id===target.id).groups[0].shortcuts[0].id,'captured-link');
 const replay=await service.automationService.execute(action,{...context,attempt:2});assert.equal(replay.status,'succeeded');assert.equal(current.workspaces.find(item=>item.id===target.id).groups[0].shortcuts.length,1,'the same capture event cannot move the link twice');const stale=await service.automationService.execute(action,{...context,idempotencyKey:'another-key',captureEventId:'missing'});assert.equal(stale.status,'needs_clarification');assert.equal(current.workspaces.find(item=>item.id===target.id).groups[0].shortcuts.length,1);
});

test('collection commit failures return failure without claiming a successful workbench mutation',async()=>{
 installStorage();const {state}=stateWithCourses();configureCollectionOperationHost({getState:()=>state,commitState:()=>{throw new Error('state persistence failed')}});const service=createWorkbenchService({getState:()=>state,commitState:()=>{throw new Error('state persistence failed')},layoutHandlers:emptyLayoutHandlers,saveRule:async()=>({kind:'error',message:'error'}),getCaptureEvent:async()=>null});
 const [receipt]=await service.executeWorkbenchActions([{operation:'link.create',workspaceId:state.activeId,name:'Lecture',url:'https://example.edu/lecture'}]);assert.equal(receipt.status,'failed');assert.equal(receipt.changed,false);assert.equal(state.workspaces.find(item=>item.id===state.activeId).groups.length,0);
});

test('rule.save succeeds only when saveRule returns a saved rule',async()=>{
 const state=createInitialState(),service=createWorkbenchService({getState:()=>state,commitState(){},layoutHandlers:emptyLayoutHandlers,saveRule:async text=>text==='valid'?{kind:'rule',rule:{id:'rule-1'}}:{kind:'clarification',message:'Choose a target.'},getCaptureEvent:async()=>null});
 const [saved]=await service.executeWorkbenchActions([{operation:'rule.save',text:'valid'}]);const [question]=await service.executeWorkbenchActions([{operation:'rule.save',text:'ambiguous'}]);assert.equal(saved.status,'succeeded');assert.equal(question.status,'needs_clarification');
});
