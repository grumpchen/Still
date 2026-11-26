import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSoftwareGraphicsRenderer} from '../src/domain/graphicsPerformance.ts';

test('software WebGL renderers enable the static reduced-cost fallback',()=>{
 for(const name of ['Google SwiftShader','ANGLE (llvmpipe, LLVM 18.1)','Mesa softpipe','Software Rasterizer'])assert.equal(isSoftwareGraphicsRenderer(name),true,name);
 for(const name of ['ANGLE (Intel UHD Graphics)','NVIDIA GeForce RTX','Apple M3'])assert.equal(isSoftwareGraphicsRenderer(name),false,name);
 assert.equal(isSoftwareGraphicsRenderer(undefined),false);
});
