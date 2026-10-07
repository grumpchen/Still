import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeCanvasScroll} from '../src/platform/canvasScroll.ts';

function viewport(){const listeners=new Map();return{addEventListener(name,listener){const set=listeners.get(name)??new Set();set.add(listener);listeners.set(name,set)},removeEventListener(name,listener){listeners.get(name)?.delete(listener)},dispatch(name){for(const listener of listeners.get(name)??[])listener()},count(name){return listeners.get(name)?.size??0}}}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('canvas scroll reports only start and settle transitions',async()=>{
 const node=viewport(),states=[];const stop=observeCanvasScroll(node,value=>states.push(value),20);
 node.dispatch('scroll');assert.deepEqual(states,[true]);
 node.dispatch('scroll');assert.deepEqual(states,[true]);
 await wait(30);assert.deepEqual(states,[true,false]);stop();
});

test('scrollend and idle fallback do not restore twice',async()=>{
 const node=viewport(),states=[];const stop=observeCanvasScroll(node,value=>states.push(value),20);
 node.dispatch('scroll');node.dispatch('scrollend');await wait(30);
 assert.deepEqual(states,[true,false]);stop();
});

test('unsubscribing cancels a pending settle and removes viewport listeners',async()=>{
 const node=viewport(),states=[];const stop=observeCanvasScroll(node,value=>states.push(value),20);
 node.dispatch('scroll');stop();await wait(30);
 assert.deepEqual(states,[true]);assert.equal(node.count('scroll'),0);assert.equal(node.count('scrollend'),0);
});
