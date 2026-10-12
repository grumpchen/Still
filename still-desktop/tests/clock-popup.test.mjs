import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clockPopupPosition} from '../src/domain/clockPopup.ts';

test('Clock popup aligns above the owning widget at roughly half Focus dimensions',()=>{
 const position=clockPopupPosition({top:500,bottom:900,right:900},{width:1440,height:1080});
 assert.deepEqual(position,{top:272,right:540,maxHeight:220,side:'above'});
});

test('Clock popup falls below the whole widget when there is not enough room above',()=>{
 const position=clockPopupPosition({top:20,bottom:340,right:500},{width:1024,height:768});
 assert.deepEqual(position,{top:348,right:524,maxHeight:220,side:'below'});
});

test('Clock popup shrinks to available space without overlapping its widget',()=>{
 const position=clockPopupPosition({top:140,bottom:700,right:500},{width:1024,height:768});
 assert.equal(position.side,'above');
 assert.equal(position.maxHeight,124);
 assert.equal(position.top+position.maxHeight,132);
 assert.ok(position.top+position.maxHeight<=140);
});

test('Clock popup styling is approximately half the default Focus widget size',()=>{
 const css=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');
 assert.match(css,/\.widget-clock-popover\{[^}]*width:min\(180px/);
 assert.match(css,/\.widget-clock-popover\{[^}]*max-height:min\(220px/);
 assert.match(css,/\.widget-clock-popover \.timer-dial\{width:min\(100%,100px\)\}/);
});
