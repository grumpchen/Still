import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromeClipGeometry,overlayVisible} from '../src/domain/chromeOverlay.ts';
test('Still-Chrome visibility requires an active, clear, non-empty viewport intersection',()=>{
 const r={left:170,top:200,right:970,bottom:700,width:800,height:500},v={left:160,top:180,right:1200,bottom:900};
 assert.equal(overlayVisible(r,v,true,false,false),true);
 for(const args of [[false,false,false],[true,true,false],[true,false,true]])assert.equal(overlayVisible(r,v,...args),false);
 assert.equal(overlayVisible({...r,left:150},v,true,false,false),true);
 assert.equal(overlayVisible({...r,width:300},v,true,false,false),true);
 assert.equal(overlayVisible({...r,height:160},v,true,false,false),true);
 assert.equal(overlayVisible({...r,right:1250},v,true,false,false),true);
 assert.equal(overlayVisible({...r,left:1300},v,true,false,false),false);
});
test('Chrome clip geometry retains partial viewport edges and masks only higher widgets',()=>{
 const geometry=chromeClipGeometry({left:-30,top:100,right:470,bottom:500},{left:0,top:0,right:400,bottom:300},{left:0,top:80,right:400,bottom:500},[{left:180,top:150,right:280,bottom:250}],true,false);
 assert.deepEqual(geometry.bounds,{x:-30,y:100,width:500,height:400});
 assert.deepEqual(geometry.clip,{x:0,y:100,width:400,height:200});
 assert.deepEqual(geometry.occlusions,[{x:180,y:150,width:100,height:100}]);
 assert.equal(geometry.visible,true);
 assert.equal(chromeClipGeometry({left:0,top:0,right:100,bottom:100},{left:0,top:0,right:100,bottom:100},{left:0,top:0,right:100,bottom:100},[{left:0,top:0,right:100,bottom:100}],true,false).visible,false);
});
test('Chrome remains hidden when there is no intersection, workspace inactive, obscured, or actively scrolling',()=>{
 const r={left:0,top:0,right:100,bottom:100},v={left:200,top:200,right:300,bottom:300};
 assert.equal(chromeClipGeometry(r,v,r,[],true,false).visible,false);
 assert.equal(chromeClipGeometry(r,{...r},r,[],false,false).visible,false);
 assert.equal(chromeClipGeometry(r,{...r},r,[],true,true).visible,false);
 assert.equal(chromeClipGeometry(r,{...r},r,[],true,false,true).visible,false);
});
