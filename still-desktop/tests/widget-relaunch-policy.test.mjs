import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWidgetRelaunch,applyRelaunchModeToAll,startupDeferredWidgetIds} from '../src/domain/widgetRelaunch.ts';

test('Relaunch plugin disabled always makes the startup choice manual',()=>{
 assert.equal(resolveWidgetRelaunch({pluginStatus:'disabled',globalMode:'automatic',widgetOverride:'automatic',tagColor:'red',colorMode:'automatic'}),'manual');
 assert.equal(resolveWidgetRelaunch({pluginStatus:'removed',globalMode:'automatic',widgetOverride:'automatic'}),'manual');
});

test('individual widget choices override tag colors and global mode',()=>{
 assert.equal(resolveWidgetRelaunch({pluginStatus:'enabled',globalMode:'automatic',widgetOverride:'manual',tagColor:'green',colorMode:'automatic'}),'manual');
 assert.equal(resolveWidgetRelaunch({pluginStatus:'enabled',globalMode:'manual',widgetOverride:'automatic',tagColor:'blue',colorMode:'manual'}),'automatic');
});

test('tag color choices override global mode when the widget follows settings',()=>{
 assert.equal(resolveWidgetRelaunch({pluginStatus:'enabled',globalMode:'manual',widgetOverride:'follow',tagColor:'red',colorMode:'automatic'}),'automatic');
 assert.equal(resolveWidgetRelaunch({pluginStatus:'enabled',globalMode:'automatic',widgetOverride:'follow',tagColor:'blue',colorMode:'manual'}),'manual');
 assert.equal(resolveWidgetRelaunch({pluginStatus:'enabled',globalMode:'automatic',widgetOverride:'follow',tagColor:null,colorMode:'manual'}),'automatic');
});

test('Apply to All updates the global mode and clears widget and color exceptions',()=>{
 const state={widgetRelaunchMode:'manual',widgetRelaunchColors:{red:'automatic',blue:'manual'},workspaces:[{widgets:[{relaunchOverride:'manual'},{relaunchOverride:'automatic'}]}]};
 const applied=applyRelaunchModeToAll(state,'automatic');
 assert.equal(applied.widgetRelaunchMode,'automatic');assert.deepEqual(applied.widgetRelaunchColors,{});assert.deepEqual(applied.workspaces[0].widgets.map(widget=>widget.relaunchOverride),['follow','follow']);
 assert.equal(state.workspaces[0].widgets[0].relaunchOverride,'manual','the original state is immutable');
});

test('startup defers only widgets whose resolved policy is manual and does not change workspace membership',()=>{
 const workspaces=[{id:'study',widgets:[{id:'manual',relaunchOverride:'manual'},{id:'tag-auto',tagColor:'red',relaunchOverride:'follow'},{id:'ordinary'}]},{id:'design',widgets:[{id:'override-auto',tagColor:'blue',relaunchOverride:'automatic'}]}];
 const original=JSON.stringify(workspaces);
 assert.deepEqual([...startupDeferredWidgetIds(workspaces,'enabled','manual',{red:'automatic',blue:'manual'})].sort(),['manual','ordinary']);
 assert.equal(JSON.stringify(workspaces),original,'startup decisions do not remove or mutate saved cards');
});
