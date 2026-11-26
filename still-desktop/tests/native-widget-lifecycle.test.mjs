import {test} from 'node:test';
import assert from 'node:assert/strict';
import {closeNativeAppsBeforeMutation,moveWithRetainedNativePanel,NativeAppRemovalError} from '../src/domain/nativeWidgetLifecycle.ts';

test('moving an open Apps widget hides then moves the same instance without release or relaunch',async()=>{
 const calls=[];let resolveSuspend;const panel={suspendForCollection:id=>{calls.push(['suspend',id]);return new Promise(resolve=>{resolveSuspend=resolve})},cancelCollection:async id=>calls.push(['resume-cancel',id]),release:async(...args)=>{calls.push(['release',...args]);return{managedWindow:false,closeRequested:false}}};let current={source:['apps-1'],destination:[]};
 const moving=moveWithRetainedNativePanel('apps-1',true,panel,()=>{assert.deepEqual(current.source,['apps-1'],'do not remove until the native window is hidden');current={source:[],destination:['apps-1']};calls.push(['move','apps-1']);return current});
 assert.deepEqual(calls,[['suspend','apps-1']]);resolveSuspend(true);const result=await moving;assert.deepEqual(result.destination,['apps-1']);assert.deepEqual(calls,[['suspend','apps-1'],['move','apps-1']]);assert.equal(calls.some(([name])=>name==='release'||name==='open'),false);
});

test('move failure keeps the source widget and cancels collection so the same app can resume',async()=>{
 const calls=[];let current={source:[{id:'apps-1',title:'Word',appPanelOpen:true}],destination:[]};const panel={suspendForCollection:async id=>{calls.push(['suspend',id]);return true},cancelCollection:async id=>calls.push(['resume-cancel',id]),release:async(...args)=>{calls.push(['release',...args]);return{managedWindow:false,closeRequested:false}}};
 await assert.rejects(()=>moveWithRetainedNativePanel('apps-1',true,panel,()=>{assert.ok(current.source.some(widget=>widget.id==='apps-1'));throw new Error('destination changed')}),/destination changed/);assert.deepEqual(current.source,[{id:'apps-1',title:'Word',appPanelOpen:true}]);assert.deepEqual(calls,[['suspend','apps-1'],['resume-cancel','apps-1']]);
});

test('a failed hide refuses to move an Apps widget',async()=>{
 let moved=false;const panel={suspendForCollection:async()=>false,cancelCollection:async()=>{},release:async()=>({managedWindow:false,closeRequested:false})};await assert.rejects(()=>moveWithRetainedNativePanel('apps-1',true,panel,()=>{moved=true}),/not moved/);assert.equal(moved,false);
});

test('bulk removal sends closeApp=true to every app before mutating state',async()=>{
 const calls=[],state={widgets:['apps-1','notes','apps-2']};const panel={release:async(id,closeApp)=>{calls.push(['release',id,closeApp]);return{managedWindow:true,closeRequested:true}}};
 const result=await closeNativeAppsBeforeMutation(['apps-1','apps-2'],panel,closeRequestedIds=>{assert.deepEqual(calls,[['release','apps-1',true],['release','apps-2',true]]);state.widgets=state.widgets.filter(id=>!closeRequestedIds.includes(id));calls.push(['remove']);return state.widgets});assert.deepEqual(result.closeRequestedIds,['apps-1','apps-2']);assert.deepEqual(calls.at(-1),['remove']);assert.deepEqual(state.widgets,['notes']);
});

test('close or state-write errors never run removal prematurely and report prior close requests',async()=>{
 let mutated=false;const panel={release:async(id,closeApp)=>{assert.equal(closeApp,true);if(id==='apps-2')throw new Error('native failure');return{managedWindow:true,closeRequested:true}}};
 await assert.rejects(()=>closeNativeAppsBeforeMutation(['apps-1','apps-2'],panel,()=>{mutated=true}),error=>error instanceof NativeAppRemovalError&&error.phase==='close-request'&&assert.deepEqual(error.closeRequestedIds,['apps-1'])===undefined);assert.equal(mutated,false);
 const successfulPanel={release:async()=>({managedWindow:true,closeRequested:true})};await assert.rejects(()=>closeNativeAppsBeforeMutation(['apps-1'],successfulPanel,()=>{throw new Error('quota')}),error=>error instanceof NativeAppRemovalError&&error.phase==='state-commit'&&error.closeRequestedIds[0]==='apps-1');
});

test('a failed normal close request reports that the panel was released to the desktop and does not mutate',async()=>{let mutated=false;const panel={release:async()=>({managedWindow:true,closeRequested:false})};await assert.rejects(()=>closeNativeAppsBeforeMutation(['apps-1'],panel,()=>{mutated=true}),error=>error instanceof NativeAppRemovalError&&error.desktopReleasedIds[0]==='apps-1'&&error.closeRequestedIds.length===0);assert.equal(mutated,false)});
