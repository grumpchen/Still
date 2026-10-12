import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../src/canvas.css',import.meta.url),'utf8');

test('workspace viewport lets its thin WebKit scrollbar styling take effect',()=>{
 const viewport=css.match(/\.canvas-viewport\{([^}]*)\}/)?.[1]??'';
 assert.ok(viewport,'workspace viewport rule exists');
 assert.doesNotMatch(viewport,/scrollbar-(?:width|color)\s*:\s*(?!auto\b)[^;]+/,'standard scrollbar properties override Chromium WebKit scrollbar styling');
 assert.match(css,/\.canvas-viewport::\-webkit-scrollbar:horizontal\{[^}]*height:4px/);
 assert.match(css,/\.canvas-viewport::\-webkit-scrollbar-button:horizontal\{[^}]*display:none/);
});
