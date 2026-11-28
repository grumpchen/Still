import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createWorkspace,parseState} from '../src/domain/workspaces.ts';
import {checkedStudyMode,parseCourseModeDefaults,parseStudyModes,resolveStudyMode,studyModeContext} from '../src/domain/studyModes.ts';

test('study modes validate named profiles, preserve opaque selected-folder references, and resolve course defaults',()=>{
 const general={id:'general',name:'General',instructions:'',downloadDirectory:null,saveDirectory:null},physics={id:'physics-mode',name:'Physics',instructions:'Cite formulas and state units.',downloadDirectory:{id:'mode-physics-download',name:'Lecture downloads'},saveDirectory:{id:'mode-physics-save',name:'Worked solutions'}};
 const modes=parseStudyModes([general,physics,{...physics,id:'duplicate',name:'PHYSICS'},null]);assert.deepEqual(modes,[general,physics]);
 const defaults=parseCourseModeDefaults({course:'physics-mode',missing:'does-not-exist',library:'general'},new Set(['course']),modes);assert.deepEqual(defaults,{course:'physics-mode'});
 assert.equal(resolveStudyMode(modes,'general',defaults,'course').id,'physics-mode');assert.equal(resolveStudyMode(modes,'general',defaults,'other').id,'general');
 assert.throws(()=>checkedStudyMode({...physics,name:'GENERAL'},modes),/already uses/);
 const context=studyModeContext(physics);assert.match(context,/Cite formulas and state units/);assert.match(context,/Lecture downloads/);assert.match(context,/Worked solutions/);
});

test('mode profiles and per-course defaults migrate through the workspace persistence parser',()=>{
 const state=createInitialState(),course=createWorkspace('Physics',[]);state.workspaces.push(course);
 const mode={id:'physics',name:'Physics',instructions:'Cite equations.',downloadDirectory:{id:'physics-dl',name:'Downloads'},saveDirectory:{id:'physics-save',name:'Solutions'}};
 state.studyModes=[...state.studyModes,mode];state.defaultStudyModeId='general';state.courseStudyModeDefaults={[course.id]:'physics'};
 const restored=parseState(JSON.stringify(state));assert.deepEqual(restored.studyModes,state.studyModes);assert.equal(restored.courseStudyModeDefaults[course.id],'physics');assert.equal(restored.defaultStudyModeId,'general');
 const legacy=parseState({...state,studyModes:undefined,defaultStudyModeId:undefined,courseStudyModeDefaults:undefined});assert.equal(legacy.studyModes?.[0].id,'general');assert.equal(legacy.defaultStudyModeId,'general');assert.deepEqual(legacy.courseStudyModeDefaults,{});
});
