import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';
import {configureCollectionOperationHost} from '../src/platform/collectionOperations.ts';
import {createWorkbenchService} from '../src/platform/workbenchOperations.ts';

test('Library assistant replacement searches shared resources and dispatches typed reference actions',async()=>{
 const saved=new Map();globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,String(value))};
 try{
  const state=createInitialState(),course=createWorkspace('Course',['browser','files']),other=createWorkspace('Other',[]);state.workspaces.push(course,other);const browser=course.widgets.find(widget=>widget.type==='browser'),pdf=course.widgets.find(widget=>widget.type==='files');browser.shortcuts=[{id:'lecture-link',name:'Lecture page',url:'https://example.edu/lecture'}];pdf.fileKey='pdf-grant';pdf.fileName='Lecture notes.pdf';let current=state;configureCollectionOperationHost({getState:()=>current,commitState:next=>{current=next}});
  const service=createWorkbenchService({getState:()=>current,commitState:next=>{current=next},layoutHandlers:{save:()=>'',apply:()=>'',rename:()=>'',duplicate:()=>'',delete:()=>''},saveRule:async()=>({kind:'error',message:'unsupported'}),getCaptureEvent:async()=>null,searchFiles:async()=>({results:[],unavailableWidgetIds:[],truncated:false})});
  const [found]=await service.executeWorkbenchActions([{operation:'resource.find',query:'lecture'}]);assert.equal(found.status,'succeeded');assert.equal(found.data.results.some(item=>item.linkId==='lecture-link'),true);assert.equal(found.data.results.some(item=>item.resourceId==='pdf-grant'),true);
  const [moved]=await service.executeWorkbenchActions([{operation:'file.moveReference',widgetId:pdf.id,destinationWorkspaceId:other.id}]);assert.equal(moved.status,'succeeded');assert.equal(current.workspaces.find(item=>item.id===other.id).widgets.find(item=>item.id===pdf.id).fileKey,'pdf-grant');assert.equal(current.workspaces.find(item=>item.id===course.id).widgets.some(item=>item.id===pdf.id),false);
  const [linkMoved]=await service.executeWorkbenchActions([{operation:'link.move',origin:{kind:'browser',workspaceId:course.id,widgetId:browser.id},linkId:'lecture-link',destinationWorkspaceId:other.id}]);assert.equal(linkMoved.status,'succeeded');assert.equal(current.workspaces.find(item=>item.id===other.id).groups[0].shortcuts[0].id,'lecture-link');
 }finally{delete globalThis.localStorage}
});
