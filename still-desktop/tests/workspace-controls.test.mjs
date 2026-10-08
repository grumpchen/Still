import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const canvas=readFileSync(new URL('../src/WorkspaceCanvas.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('widget headers expose other workspace rows as transfer targets and reset invalid drops',()=>{
 assert.match(app,/data-workspace-drop-target=\{w\.id\}/);
 assert.match(canvas,/elementFromPoint\(e\.clientX,e\.clientY\).*data-workspace-drop-target/);
 assert.match(canvas,/transferWidget\(workspaceId,g\.id,destination\)/);
 assert.match(canvas,/if\(!cancel&&g\.mode==='move'&&destination/);
 assert.match(styles,/workspace-drop-active/);
});

test('compact focus state is temporary and keeps its exit control beside fullscreen',()=>{
 assert.match(app,/useState\(false\);const \[workspaceDropTarget/);
 assert.match(app,/focusMode&&<button aria-label="Exit focus"/);
 assert.match(app,/focus=\{\(\)=>\{setFocusMode/);
 assert.match(app,/focusMode\?' focus-mode':''/);
 assert.match(styles,/\.canvas-app\.focus-mode \.sidebar\{display:none\}/);
 assert.match(styles,/\.canvas-app\.focus-mode \.widget-tray\{display:none\}/);
 assert.doesNotMatch(readFileSync(new URL('../src/domain/workspaces.ts',import.meta.url),'utf8'),/focusMode\??:/);
});
