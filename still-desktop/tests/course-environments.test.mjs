import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWidget,createWorkspace,parseState} from '../src/domain/workspaces.ts';
import {decideCourseEnvironmentAction,dueCourseEnvironmentOccurrences,removeWorkspaceAndUnlinkCourseEnvironments,resolveLocalClassStart} from '../src/domain/courseEnvironments.ts';

function fixture({startOffset=5,targets=['Chemistry'],autoOpenCourseEnvironments=true,autoOpen=true}={}){
 const state=createInitialState(),source=state.workspaces.find(item=>item.role==='dashboard'),timetable=source.widgets.find(item=>item.type==='timetable');
 const now=new Date(),start=new Date(now.getTime()+startOffset*60_000);start.setSeconds(0,0);const day=(start.getDay()+6)%7,time=`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
 const destinations=targets.map(name=>createWorkspace(name,['notes']));state.workspaces.push(...destinations);state.autoOpenCourseEnvironments=autoOpenCourseEnvironments;
 timetable.schedule=targets.map((name,index)=>({id:`course-${index}`,day,time,title:name+' 101',location:'Room 1',workspaceId:destinations[index].id,autoOpen}));
 return {state,now,start,timetable,destinations};
}

test('due window includes ten minutes before and fifteen minutes after, but no backlog after expiry',()=>{
 const {state,now,start}=fixture();
 assert.equal(dueCourseEnvironmentOccurrences(state.workspaces,true,start.getTime()-10*60_000).length,1);
 assert.equal(dueCourseEnvironmentOccurrences(state.workspaces,true,start.getTime()-10*60_000-1).length,0);
 assert.equal(dueCourseEnvironmentOccurrences(state.workspaces,true,start.getTime()+15*60_000).length,1);
 assert.equal(dueCourseEnvironmentOccurrences(state.workspaces,true,start.getTime()+15*60_000+1).length,0);
 assert.ok(dueCourseEnvironmentOccurrences(state.workspaces,true,now).length===1);
});

test('global and per-course opt-outs suppress scheduled openings',()=>{
 const global=fixture({autoOpenCourseEnvironments:false}),perCourse=fixture({autoOpen:false});
 assert.deepEqual(dueCourseEnvironmentOccurrences(global.state.workspaces,global.state.autoOpenCourseEnvironments,global.now),[]);
 assert.deepEqual(dueCourseEnvironmentOccurrences(perCourse.state.workspaces,true,perCourse.now),[]);
});

test('one destination switches automatically while concurrent destinations produce one deterministic grouped choice',()=>{
 const one=fixture(),oneDue=dueCourseEnvironmentOccurrences(one.state.workspaces,true,one.now);
 assert.equal(decideCourseEnvironmentAction(oneDue,one.state.activeId,new Set(one.state.workspaces.map(item=>item.id))).kind,'switch');
 const many=fixture({targets:['Zoology','Chemistry','Chemistry']});many.timetable.schedule[2].workspaceId=many.destinations[1].id;const manyDue=dueCourseEnvironmentOccurrences(many.state.workspaces,true,many.now);
 const decision=decideCourseEnvironmentAction(manyDue,many.state.activeId,new Set(many.state.workspaces.map(item=>item.id)));
 assert.equal(decision.kind,'choose');
 assert.deepEqual(decision.groups.map(group=>group.workspaceName),['Chemistry','Zoology']);
 assert.equal(decision.groups[0].occurrences.length,2);
});

test('skips nonexistent spring-forward wall times and resolves repeated fall-back time to the first instance',()=>{
 const previous=process.env.TZ;process.env.TZ='America/New_York';
 try{
  const spring=new Date(2026,2,8,12),fall=new Date(2026,10,1,12);
  assert.equal(resolveLocalClassStart(spring,'02:30'),null);
  const repeated=resolveLocalClassStart(fall,'01:30');
  assert.equal(repeated.toISOString(),'2026-11-01T05:30:00.000Z');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous}
});

test('schedule links migrate to enabled by default and deleted workspace links are cleared immutably',()=>{
 const {state,destinations,timetable}=fixture(),source=state.workspaces[0];
 const legacy=structuredClone(state);delete legacy.autoOpenCourseEnvironments;delete legacy.workspaces[0].widgets.find(item=>item.type==='timetable').schedule[0].autoOpen;
 const parsed=parseState(legacy);
 assert.equal(parsed.autoOpenCourseEnvironments,true);
 assert.equal(parsed.workspaces[0].widgets.find(item=>item.type==='timetable').schedule[0].autoOpen,true);
 const removed=removeWorkspaceAndUnlinkCourseEnvironments(state,destinations[0].id);
 assert.equal(removed.workspaces.some(item=>item.id===destinations[0].id),false);
 assert.equal(removed.workspaces.find(item=>item.id===source.id).widgets.find(item=>item.id===timetable.id).schedule[0].workspaceId,undefined);
 assert.equal(state.workspaces.find(item=>item.id===source.id).widgets.find(item=>item.id===timetable.id).schedule[0].workspaceId,destinations[0].id,'undo snapshot remains intact');
});
