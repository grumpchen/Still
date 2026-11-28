function escapeHtml(value:string):string{return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function escapeMarkdownInline(value:string):string{return value.replaceAll('\\','\\\\').replaceAll('*','\\*').replaceAll('`','\\`')}
function inlineHtml(value:string):string{
 const literals:string[]=[];let escaped=escapeHtml(value).replace(/\\([\\*`])/g,(_match,literal:string)=>{const token=`\uE000${literals.length}\uE001`;literals.push(literal);return token});
 escaped=escaped.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
 return escaped.replace(/\uE000(\d+)\uE001/g,(_match,index:string)=>escapeHtml(literals[Number(index)]??''));
}
function isListLine(line:string):boolean{return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)}
function listPrefix(line:string):{kind:'task'|'bullet'|'ordered';content:string;checked?:boolean}|null{
 const task=line.match(/^\s*[-*+]\s+\[([ xX])\]\s?(.*)$/);if(task)return{kind:'task',content:task[2],checked:task[1].toLowerCase()==='x'};
 const bullet=line.match(/^\s*[-*+]\s+(.*)$/);if(bullet)return{kind:'bullet',content:bullet[1]};
 const ordered=line.match(/^\s*\d+[.)]\s+(.*)$/);if(ordered)return{kind:'ordered',content:ordered[1]};return null;
}
/** Render the Markdown already used by Notes into a small safe editor DOM. */
export function noteMarkdownToHtml(markdown:string):string{
 const lines=markdown.replaceAll('\r\n','\n').replaceAll('\r','\n').split('\n'),blocks:string[]=[];let paragraph:string[]=[],index=0;
 const flush=()=>{if(paragraph.length){blocks.push(`<p>${paragraph.map(inlineHtml).join('<br>')}</p>`);paragraph=[]}};
 while(index<lines.length){const line=lines[index];if(!line.trim()){flush();index++;continue}
  const heading=line.match(/^(#{1,6})\s+(.*)$/);if(heading){flush();const level=heading[1].length;blocks.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);index++;continue}
  const first=listPrefix(line);if(first){flush();const ordered=first.kind==='ordered',tag=ordered?'ol':'ul',items:string[]=[];while(index<lines.length){const item=listPrefix(lines[index]);if(!item||item.kind==='ordered'!==ordered)break;items.push(`<li${item.kind==='task'?` data-task="${item.checked?'checked':'unchecked'}"`:''}>${item.kind==='task'?`<input type="checkbox" data-task-checkbox contenteditable="false"${item.checked?' checked':''}> `:''}${inlineHtml(item.content)}</li>`);index++}blocks.push(`<${tag}>${items.join('')}</${tag}>`);continue}
  paragraph.push(line);index++;
 }
 flush();return blocks.join('');
}
function inlineMarkdown(node:Node):string{
 if(node.nodeType===3)return escapeMarkdownInline(node.textContent??'');
 if(node.nodeType!==1)return'';
 const element=node as Element,tag=element.tagName.toLowerCase();
 if(tag==='br')return'\n';
 const content=Array.from(element.childNodes).map(inlineMarkdown).join('');
 if(tag==='strong'||tag==='b')return`**${content}**`;
 if(tag==='em'||tag==='i')return`*${content}*`;
 if(tag==='code')return'`'+content.replaceAll('`','\\`')+'`';
 return content;
}
function blockMarkdown(node:Node):string{
 if(node.nodeType===3)return escapeMarkdownInline(node.textContent??'');
 if(node.nodeType!==1)return'';
 const element=node as HTMLElement,tag=element.tagName.toLowerCase();
 if(tag==='ul'||tag==='ol')return Array.from(element.children).filter(child=>child.tagName.toLowerCase()==='li').map((child,index)=>{
  const item=child as HTMLElement,checkbox=item.querySelector<HTMLInputElement>('[data-task-checkbox]'),task=item.dataset.task==='checked'||item.dataset.task==='unchecked'||!!checkbox,prefix=task?`- [${checkbox?(checkbox.checked?'x':' '):item.dataset.task==='checked'?'x':' '}] `:tag==='ol'?`${index+1}. `:'- ',nested=Array.from(item.children).filter(nestedChild=>['ul','ol'].includes(nestedChild.tagName.toLowerCase())),text=Array.from(item.childNodes).filter(child=>!nested.includes(child as Element)).map(inlineMarkdown).join('').trim();return prefix+text+(nested.length?'\n'+nested.map(blockMarkdown).join('\n'):'');
 }).join('\n');
 if(/^h[1-6]$/.test(tag))return`${'#'.repeat(Number(tag[1]))} ${Array.from(element.childNodes).map(inlineMarkdown).join('').trim()}`;
 if(tag==='p'||tag==='div')return Array.from(element.childNodes).map(inlineMarkdown).join('').replace(/\n+$/,'');
 return Array.from(element.childNodes).map(blockMarkdown).filter(Boolean).join('\n\n');
}
/** Serialize editable DOM back to Markdown so old saved notes remain readable. */
export function noteEditorHtmlToMarkdown(root:HTMLElement):string{
 return Array.from(root.childNodes).map(blockMarkdown).filter((block,index,array)=>block!==''||index>0&&index<array.length-1).join('\n\n').replaceAll('\u00a0',' ').trimEnd();
}
export type NoteFormat='bold'|'heading'|'bullet'|'task';
export function applyNoteEditorFormat(root:HTMLElement,kind:NoteFormat):string{
 root.focus();if(kind==='task'){
  const document=root.ownerDocument,selection=document.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0).cloneRange():document.createRange(),selected=selection?.toString()??'';
  if(!selection?.rangeCount){range.selectNodeContents(root);range.collapse(false)}
  const containing=range.startContainer.nodeType===1?range.startContainer as Element:range.startContainer.parentElement;
  let block:Element|null=containing;while(block&&block.parentElement!==root)block=block.parentElement;
  if(!block&&range.startContainer===root&&range.startOffset>0)block=root.children[Math.min(root.children.length-1,range.startOffset-1)]??null;
  const list=document.createElement('ul'),item=document.createElement('li'),checkbox=document.createElement('input');list.append(item);item.dataset.task='unchecked';checkbox.type='checkbox';checkbox.dataset.taskCheckbox='';checkbox.setAttribute('contenteditable','false');item.append(checkbox);
  const fullBlock=!!selected&&block?.textContent?.trim()===selected.trim();
  if(fullBlock&&block){while(block.firstChild)item.append(block.firstChild);block.replaceWith(list)}
  else{if(selected)item.append(document.createTextNode(selected));if(block?.parentElement===root)block.after(list);else root.append(list)}
  const caret=document.createRange();caret.selectNodeContents(item);caret.collapse(false);selection?.removeAllRanges();selection?.addRange(caret);
 }else if(kind==='heading')root.ownerDocument.execCommand('formatBlock',false,'h2');
 else if(kind==='bullet')root.ownerDocument.execCommand('insertUnorderedList');
 else root.ownerDocument.execCommand('bold');
 return noteEditorHtmlToMarkdown(root);
}
