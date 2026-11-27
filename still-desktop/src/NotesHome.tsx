import {useRef,useState} from 'react';
import type {NoteHistoryEntry} from './domain/noteHistory.ts';
import {createNoteDocument,NOTE_DOCUMENT_TEXT_LIMIT,type NoteDocument} from './domain/noteDocuments.ts';
import {useT} from './localization.tsx';
import {notesLibrary} from './platform/notesLibrary.ts';

function markdownFile(entry:NoteHistoryEntry){
 return entry.markdownName??(/\.(?:md|markdown)$/i.test(entry.document.sourcePath??'')?entry.document.sourcePath:undefined);
}

export default function NotesHome({entries,create,edit,remove}:{
 entries:NoteHistoryEntry[];
 create:(entry:NoteHistoryEntry)=>void;
 edit:(id:string,patch:Partial<Pick<NoteDocument,'title'|'text'>>)=>void;
 remove:(id:string)=>void;
}){
 const t=useT();
 const [query,setQuery]=useState(''),[markdownOnly,setMarkdownOnly]=useState(false),[selectedId,setSelectedId]=useState('');
 const [draft,setDraft]=useState<{id:string;text:string;expected:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const entry=entries.find(item=>item.document.id===selectedId),note=entry?.document;
 const keyword=query.trim().replace(/^#/,'').toLocaleLowerCase();
 const matches=entries.filter(item=>{
  const file=markdownFile(item);
  if(markdownOnly&&!file)return false;
  return [item.document.title,item.document.text,file,...(item.document.tags??[])].join(' ').toLocaleLowerCase().includes(keyword);
 });
 const show=(id:string)=>{setSelectedId(id);setDraft(null);setError('')};
 function createBlank(){
  try{const document=createNoteDocument();create({document});setMarkdownOnly(false);setQuery('');show(document.id)}
  catch(reason){setError(String(reason))}
 }
 async function openMarkdown(file:File){
  setBusy(true);setError('');
  try{
   if(!/\.(?:md|markdown)$/i.test(file.name))throw new Error(t('chooseMarkdownFile'));
   if(file.size>NOTE_DOCUMENT_TEXT_LIMIT*4)throw new Error(t('markdownTooLarge'));
   const text=await file.text();
   if(text.length>NOTE_DOCUMENT_TEXT_LIMIT)throw new Error(t('markdownTooLarge'));
   const previous=entries.find(item=>item.markdownName===file.name&&item.document.text===text);
   if(previous){setMarkdownOnly(true);setQuery('');show(previous.document.id);return}
   const document={...createNoteDocument(file.name.replace(/\.(?:md|markdown)$/i,'').slice(0,60)),text};
   create({document,markdownName:file.name});setMarkdownOnly(true);setQuery('');show(document.id);
  }catch(reason){setError(String(reason))}
  finally{setBusy(false)}
 }
 async function saveLinkedNote(){
  if(!note?.sourcePath||!entry?.widgetId||draft?.id!==note.id||busy)return;
  setBusy(true);setError('');
  try{
   await notesLibrary.write(entry.widgetId,note.sourcePath,draft.text,draft.expected);
   edit(note.id,{text:draft.text});
   setDraft(null);
  }catch(reason){setError(String(reason))}
  finally{setBusy(false)}
 }
 function deleteSelected(){
  if(!note||!window.confirm(t('deleteNotePrompt').replace('{note}',note.title||t('untitledNote'))))return;
  try{remove(note.id);show('')}catch(reason){setError(String(reason))}
 }
 return <div className="shared-notes-home">
  <div className="shared-notes-actions">
   <button type="button" className="primary" onClick={createBlank} disabled={busy}>{t('newNote')}</button>
   <button type="button" onClick={()=>input.current?.click()} disabled={busy}>{t('openMarkdown')}</button>
   <input ref={input} type="file" accept=".md,.markdown" aria-label={t('openMarkdown')} hidden onChange={event=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void openMarkdown(file);
   }}/>
  </div>
  {error&&<p className="widget-error" role="alert">{error}</p>}
  <div className={'shared-notes-layout'+(note?' has-note':'')}>
   <section className="shared-notes-browser" aria-label={t('savedNotesList')}>
    <input aria-label={t('findSavedNotes')} placeholder={t('findSavedNotes')} value={query} onChange={event=>setQuery(event.target.value)}/>
    <div className="shared-notes-filters">
     <button type="button" aria-pressed={!markdownOnly} onClick={()=>setMarkdownOnly(false)}>{t('allSavedNotes')}</button>
     <button type="button" aria-pressed={markdownOnly} onClick={()=>setMarkdownOnly(true)}>{t('markdownHistory')}</button>
    </div>
    <div className="shared-notes-list">
     {matches.map(item=><button type="button" key={item.document.id} disabled={busy} aria-current={item.document.id===selectedId?'true':undefined} onClick={()=>show(item.document.id)}>
      <strong>{item.document.title||t('untitledNote')}</strong>
      <small>{[markdownFile(item),item.workspaceName,...(item.document.tags??[]).map(tag=>'#'+tag)].filter(Boolean).join(' · ')||item.document.text.slice(0,90)}</small>
     </button>)}
     {!matches.length&&<p>{query?t('noMatchingNotesText'):t(markdownOnly?'emptyMarkdownHistory':'emptyNotesHome')}</p>}
    </div>
   </section>
   {note&&<section className="shared-notes-editor">
    <div className="shared-note-editor-actions">
     <button type="button" onClick={()=>show('')} disabled={busy}>{t('backToNotesHome')}</button>
     {note.sourcePath&&<button type="button" onClick={()=>void saveLinkedNote()} disabled={busy||draft?.id!==note.id}>{t('save')}</button>}
     <button type="button" onClick={deleteSelected} disabled={busy}>{t('deleteSavedNote')}</button>
    </div>
    <input aria-label={t('noteHeading')} placeholder={t('untitledNote')} value={note.title} maxLength={60} readOnly={!!note.sourcePath} onChange={event=>edit(note.id,{title:event.target.value})}/>
    <span>{entry?.markdownName?t('importedMarkdown').replace('{name}',entry.markdownName):note.sourcePath?t('linkedMarkdown').replace('{name}',note.sourcePath):t('savedInSharedNotes')}</span>
    <textarea aria-label={t('noteText')} value={draft?.id===note.id?draft.text:note.text} disabled={busy} readOnly={!!note.sourcePath&&!notesLibrary.native} maxLength={NOTE_DOCUMENT_TEXT_LIMIT} onChange={event=>{
     const text=event.target.value;
     if(note.sourcePath)setDraft({id:note.id,text,expected:draft?.id===note.id?draft.expected:note.text});
     else edit(note.id,{text});
    }}/>
   </section>}
  </div>
 </div>;
}
