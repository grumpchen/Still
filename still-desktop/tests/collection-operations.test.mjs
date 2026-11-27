import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace} from '../src/domain/workspaces.ts';
import {applyCollectionAction} from '../src/domain/collectionOperations.ts';

test('quick capture preserves course ownership and creates Notes only in the selected course when absent',()=>{
 const state=createInitialState(),course=createWorkspace('Course A',['files']);state.workspaces.push(course);
 const captured=applyCollectionAction(state,{type:'note.quickCapture',workspaceId:course.id,title:'Exam thought',text:'Review chapter 4'});
 const nextCourse=captured.state.workspaces.find(item=>item.id===course.id),notes=nextCourse.widgets.find(item=>item.type==='notes');
 assert.ok(notes);assert.equal(notes.noteDocuments[0].title,'Exam thought');assert.equal(notes.noteDocuments[0].text,'Review chapter 4');
 assert.equal(captured.state.workspaces.find(item=>item.role==='dashboard').widgets.find(item=>item.type==='notes').noteDocuments[0].text,state.workspaces[0].widgets.find(item=>item.type==='notes').noteDocuments[0].text);
});

test('saved links create a course-local collection and support rename, URL edit, cross-course move and metadata-only delete',()=>{
 const state=createInitialState(),a=createWorkspace('Course A',[]),b=createWorkspace('Course B',[]);state.workspaces.push(a,b);
 const created=applyCollectionAction(state,{type:'link.create',workspaceId:a.id,name:'Lecture',url:'https://example.edu/lecture'}),courseA=created.state.workspaces.find(item=>item.id===a.id),group=courseA.groups[0],link=group.shortcuts[0];
 assert.equal(group.name,'Saved links');
 const origin={kind:'group',workspaceId:a.id,groupId:group.id};
 const renamed=applyCollectionAction(created.state,{type:'link.rename',origin,linkId:link.id,name:'Week 1'});
 const edited=applyCollectionAction(renamed.state,{type:'link.editUrl',origin,linkId:link.id,url:'https://example.edu/week-1'});
 const target=applyCollectionAction(edited.state,{type:'link.create',workspaceId:b.id,name:'Folder link',url:'https://example.edu/course'}),groupB=target.state.workspaces.find(item=>item.id===b.id).groups[0];
 const emptyCourse=createWorkspace('Course C',[]);target.state.workspaces.push(emptyCourse);
 const moved=applyCollectionAction(target.state,{type:'link.move',origin,linkId:link.id,destinationWorkspaceId:emptyCourse.id});
 assert.equal(moved.state.workspaces.find(item=>item.id===a.id).groups[0].shortcuts.length,0);
 const groupC=moved.state.workspaces.find(item=>item.id===emptyCourse.id).groups[0];
 assert.equal(groupC.name,'Saved links');assert.equal(groupC.shortcuts.find(item=>item.id===link.id).url,'https://example.edu/week-1');
 const deleted=applyCollectionAction(moved.state,{type:'link.delete',origin:{kind:'group',workspaceId:emptyCourse.id,groupId:groupC.id},linkId:link.id});
 assert.equal(deleted.summary.includes('website was not deleted'),true);assert.equal(deleted.state.workspaces.find(item=>item.id===emptyCourse.id).groups[0].shortcuts.some(item=>item.id===link.id),false);
});

test('browser saved link actions mutate only the specified widget shortcut list',()=>{
 const state=createInitialState(),course=createWorkspace('Course A',['group']),widget=course.widgets.find(item=>item.type==='group');widget.type='browser';widget.shortcuts=[{id:'web-1',name:'Lecture',url:'https://example.edu/lecture',icon:'L'}];state.workspaces.push(course);
 const origin={kind:'browser',workspaceId:course.id,widgetId:widget.id};
 const renamed=applyCollectionAction(state,{type:'link.rename',origin,linkId:'web-1',name:'Week 2'});
 const owner=renamed.state.workspaces.find(item=>item.id===course.id);
 assert.equal(owner.widgets.find(item=>item.id===widget.id).shortcuts[0].name,'Week 2');
 assert.deepEqual(owner.groups,course.groups);
 const deleted=applyCollectionAction(renamed.state,{type:'link.delete',origin,linkId:'web-1'});
 assert.equal(deleted.state.workspaces.find(item=>item.id===course.id).widgets.find(item=>item.id===widget.id).shortcuts.length,0);
 const unrelated=createWorkspace('Course B',['notes']),note=unrelated.widgets.find(item=>item.type==='notes');note.shortcuts=[{id:'web-2',name:'Nope',url:'https://example.edu/nope',icon:'N'}];state.workspaces.push(unrelated);
 assert.throws(()=>applyCollectionAction(state,{type:'link.delete',origin:{kind:'browser',workspaceId:unrelated.id,widgetId:note.id},linkId:'web-2'}));
});

test('file annotations update the source Files widget and never leak to another workspace root',()=>{
 const state=createInitialState(),a=createWorkspace('Course A',['files']),b=createWorkspace('Course B',['files']);state.workspaces.push(a,b);
 const source=a.widgets.find(item=>item.type==='files'),other=b.widgets.find(item=>item.type==='files');
 const result=applyCollectionAction(state,{type:'file.annotation',widgetId:source.id,path:'week/reading.pdf',text:'Read for exam'});
 assert.equal(result.state.workspaces.find(item=>item.id===a.id).widgets.find(item=>item.id===source.id).fileNotes['week/reading.pdf'],'Read for exam');
 assert.deepEqual(result.state.workspaces.find(item=>item.id===b.id).widgets.find(item=>item.id===other.id).fileNotes,{});
 assert.throws(()=>applyCollectionAction(state,{type:'file.annotation',widgetId:source.id,path:'../escape.txt',text:'x'}));
});

test('file shortcut rename, move and delete change course metadata while keeping its opaque source reference',()=>{
 const state=createInitialState(),a=createWorkspace('Course A',['files']),b=createWorkspace('Course B',[]),file=a.widgets.find(item=>item.type==='files');file.fileKey='document-source-1';file.fileName='reading.pdf';state.workspaces.push(a,b);const activeId=state.activeId;
 const renamed=applyCollectionAction(state,{type:'file.renameReference',widgetId:file.id,name:'chapter one'});
 assert.equal(renamed.state.workspaces.find(item=>item.id===a.id).widgets.find(item=>item.id===file.id).fileName,'chapter one');
 const moved=applyCollectionAction(renamed.state,{type:'file.moveReference',widgetId:file.id,destinationWorkspaceId:b.id});
 assert.equal(moved.state.activeId,activeId);assert.equal(moved.state.workspaces.find(item=>item.id===a.id).widgets.some(item=>item.id===file.id),false);
 const destination=moved.state.workspaces.find(item=>item.id===b.id).widgets.find(item=>item.id===file.id);assert.equal(destination.fileKey,'document-source-1');assert.equal(destination.fileName,'chapter one');
 const removed=applyCollectionAction(moved.state,{type:'file.deleteReference',widgetId:file.id});assert.equal(removed.state.workspaces.find(item=>item.id===b.id).widgets.some(item=>item.id===file.id),false);assert.equal(file.fileKey,'document-source-1');
 assert.throws(()=>applyCollectionAction(state,{type:'file.moveReference',widgetId:file.id,destinationWorkspaceId:state.workspaces[0].id}));
});
