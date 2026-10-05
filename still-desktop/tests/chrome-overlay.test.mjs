import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlayVisible} from '../src/domain/chromeOverlay.ts';
test('Still-Chrome visibility requires an active, clear, fully visible browser area',()=>{
 const r={left:170,top:200,right:970,bottom:700,width:800,height:500},v={left:160,top:180,right:1200,bottom:900};
 assert.equal(overlayVisible(r,v,true,false,false),true);
 for(const args of [[false,false,false],[true,true,false],[true,false,true]])assert.equal(overlayVisible(r,v,...args),false);
 assert.equal(overlayVisible({...r,left:150},v,true,false,false),false);
 assert.equal(overlayVisible({...r,width:300},v,true,false,false),false);
 assert.equal(overlayVisible({...r,height:160},v,true,false,false),false);
 assert.equal(overlayVisible({...r,right:1250},v,true,false,false),false);
});
