import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const component=await readFile(new URL('../src/FilesWidget.tsx',import.meta.url),'utf8');
const styles=await readFile(new URL('../src/canvas.css',import.meta.url),'utf8');

test('browse search and file rows share a vertical panel that keeps the list visible',()=>{
 assert.match(component,/<div className=\{selected\?'files-content-with-preview':'files-content-browse'\}>\s*<aside className="files-selection-list">\s*<input className="file-filter"[\s\S]*?<div className="file-list"/);
 assert.match(component,/file\.path===selected\?\.path\?' selected':''/);
 assert.match(styles,/\.files-content-browse>\.files-selection-list\{flex:1;max-width:none;border-right:0\}/);
});
