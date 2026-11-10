import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('right-clicking the canvas opens the add-tool menu instead of the webview menu',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 assert.match(canvas,/onContextMenu=\{canvasContextMenu\}/);
 assert.match(canvas,/function canvasContextMenu\(event:ReactMouseEvent<HTMLDivElement>\)/);
 assert.match(canvas,/event\.preventDefault\(\);event\.stopPropagation\(\)/,'the native context menu is suppressed');
 assert.match(canvas,/setAddMenu\(\{x:event\.clientX,y:event\.clientY\}\)/);
 assert.match(canvas,/closest\('input,textarea,select,\[contenteditable="true"\]'\)/,'text fields keep their own menu');
});

test('choosing a tool adds it to the current workspace at the pointer',()=>{
 const canvas=source('../src/WorkspaceCanvas.tsx');
 assert.match(canvas,/<AddToolContextMenu target=\{addMenu\} close=\{closeAddMenu\}/);
 assert.match(canvas,/const at=canvasPoint\(addMenu\.x,addMenu\.y\)/);
 assert.match(canvas,/type==='apps'\?pickApp\(undefined,at,extent\):add\(type,at,extent\)/);
});

test('the add-tool menu lists every built-in widget type',()=>{
 const menu=source('../src/AddToolContextMenu.tsx');
 assert.match(menu,/import \{widgetCatalog,widgetTypes,type WidgetType\} from '\.\/domain\/widgetCatalog\.ts'/);
 assert.match(menu,/widgetTypes\.map\(type=><button/);
 assert.match(menu,/<Icon name=\{widgetCatalog\[type\]\.icon\}\/>/);
 assert.match(menu,/t\('widget_'\+type\)/);
 assert.match(menu,/role="menu"/);
 assert.match(menu,/role="menuitem"/);
 assert.match(menu,/event\.key==='Escape'/);
});

test('the add-tool menu is styled like the existing canvas menus',()=>{
 const styles=source('../src/canvas.css');
 assert.match(styles,/\.add-tool-context-menu\{position:fixed/);
 assert.match(styles,/\.add-tool-context-menu button:hover/);
});
