import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [canvasCss,baseCss]=await Promise.all([
 readFile(new URL('../src/canvas.css',import.meta.url),'utf8'),
 readFile(new URL('../src/styles.css',import.meta.url),'utf8'),
]);
const css=`${canvasCss}\n${baseCss}`;

test('all scrollbars share a thin visible thumb and a wider native hit area',()=>{
 assert.match(css,/:where\(\*\)\{[^}]*scrollbar-width:auto[^}]*scrollbar-color:auto/);
 assert.match(css,/\*::\-webkit-scrollbar\{[^}]*width:14px[^}]*height:14px/);
 assert.match(css,/\*::\-webkit-scrollbar-thumb\{[^}]*border:5px solid transparent[^}]*background-clip:content-box/);
 assert.match(css,/\*::\-webkit-scrollbar-button\{[^}]*display:none/);
 assert.doesNotMatch(css,/scrollbar-width:thin/,'per-element thin settings can override the shared WebView scrollbar styling');
});
