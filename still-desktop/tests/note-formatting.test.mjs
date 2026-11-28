import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {noteEditorHtmlToMarkdown,noteMarkdownToHtml} from '../src/domain/noteFormatting.ts';

function roundTrip(markdown){const dom=new JSDOM('<div></div>'),root=dom.window.document.querySelector('div');root.innerHTML=noteMarkdownToHtml(markdown);const result=noteEditorHtmlToMarkdown(root);dom.window.close();return{html:noteMarkdownToHtml(markdown),result}}

test('Notes formatting keeps old plain-text paragraphs byte-for-byte',()=>{
 const source='A legacy paragraph with line one\nand line two.\n\nA second paragraph.';
 const {result,html}=roundTrip(source);
 assert.equal(result,source);assert.match(html,/<p>A legacy paragraph with line one<br>and line two\.<\/p>/);
});

test('Markdown headings, bold, lists and checked tasks render as actual editable formatting and round-trip',()=>{
 const source='## Week 2\n\nKeep **important** details visible.\n\n- first item\n- second item\n\n- [ ] review reading\n- [x] submit work';
 const {result,html}=roundTrip(source);
 assert.equal(result,source);assert.match(html,/<h2>Week 2<\/h2>/);assert.match(html,/<strong>important<\/strong>/);assert.match(html,/<ul><li>first item<\/li><li>second item<\/li><\/ul>/);assert.match(html,/data-task="unchecked"/);assert.match(html,/data-task="checked"/);
 const dom=new JSDOM('<div></div>'),root=dom.window.document.querySelector('div');root.innerHTML=html;const task=root.querySelector('[data-task-checkbox]');task.checked=true;task.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.match(noteEditorHtmlToMarkdown(root),/- \[x\] review reading/);dom.window.close();
});

test('formatting parser escapes pasted markup and does not create executable HTML',()=>{
 const html=noteMarkdownToHtml('<img src=x onerror=alert(1)>');
 assert.equal(html,'<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});
