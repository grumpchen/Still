import {useRef,useState} from 'react';
import {noteHistoryIdentity,noteHistoryKey,type NoteHistoryEntry,type NoteHistoryIdentity} from './domain/noteHistory.ts';
import {createNoteDocument,NOTE_DOCUMENT_TEXT_LIMIT,type NoteDocument} from './domain/noteDocuments.ts';
import {useT} from './localization.tsx';
import {notesLibrary} from './platform/notesLibrary.ts';

function markdownFile(entry:NoteHistoryEntry){
 return entry.markdownName??(/\.(?:md|markdown)$/i.test(entry.document.sourcePath??'')?entry.document.sourcePath:undefined);
}

export default function NotesHome({entries,create,edit,remove}:{
 entries:NoteHistoryEntry[];
 create:(entry:NoteHistoryEntry)=>void;
 edit:(identity:NoteHistoryIdentity,patch:Partial<Pick<NoteDocument,'title'|'text'>>)=>void;
 remove:(identity:NoteHistoryIdentity)=>void;
}){
 const t=useT();
 const [query,setQuery]=useState(''),[markdownOnly,setMarkdownOnly]=useState(false),[selectedId,setSelectedId]=useState('');
 const [draft,setDraft]=useState<{id:string;text:string;expected:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const saving=useRef(false);
 const entry=entries.find(item=>noteHistoryKey(item)===selectedId),note=entry?.document;
 const keyword=query.trim().replace(/^#/,'').toLocaleLowerCase();
 const matches=entries.filter(item=>{
  const file=markdownFile(item);
  if(markdownOnly&&!file)return false;
  return [item.document.title,item.document.text,file,...(item.document.tags??[])].join(' ').toLocaleLowerCase().includes(keyword);
 });
 const show=(item:NoteHistoryEntry|undefined)=>{setSelectedId(item?noteHistoryKey(item):'');setDraft(null);setError('')};
 function createBlank(){
  try{const item={document:createNoteDocument()};create(item);setMarkdownOnly(false);setQuery('');show(item)}
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
   if(previous){setMarkdownOnly(true);setQuery('');show(previous);return}
   const document={...createNoteDocument(file.name.replace(/\.(?:md|markdown)$/i,'').slice(0,60)),text};
   const item={document,markdownName:file.name};create(item);setMarkdownOnly(true);setQuery('');show(item);
  }catch(reason){setError(String(reason))}
  finally{setBusy(false)}
 }
 async function saveLinkedNote(){
  if(!note?.sourcePath||!entry?.widgetId||draft?.id!==note.id||busy||saving.current)return;
  saving.current=true;
  setBusy(true);setError('');
  try{
   await notesLibrary.write(entry.widgetId,note.sourcePath,draft.text,draft.expected);
   window.dispatchEvent(new CustomEvent('still-note-file-saved',{detail:{widgetId:entry.widgetId,path:note.sourcePath,previous:draft.expected,text:draft.text}}));
   if(entry)edit(noteHistoryIdentity(entry),{text:draft.text});
   setDraft(null);
  }catch(reason){setError(String(reason))}
  finally{saving.current=false;setBusy(false)}
 }
 function deleteSelected(){
  if(!note||!window.confirm(t('deleteNotePrompt').replace('{note}',note.title||t('untitledNote'))))return;
  try{if(entry)remove(noteHistoryIdentity(entry));show(undefined)}catch(reason){setError(String(reason))}
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
     {matches.map(item=><button type="button" key={noteHistoryKey(item)} disabled={busy} aria-current={noteHistoryKey(item)===selectedId?'true':undefined} onClick={()=>show(item)}>
      <strong>{item.document.title||t('untitledNote')}</strong>
      <small>{[markdownFile(item),item.workspaceName,...(item.document.tags??[]).map(tag=>'#'+tag)].filter(Boolean).join(' · ')||item.document.text.slice(0,90)}</small>
     </button>)}
     {!matches.length&&<p>{query?t('noMatchingNotesText'):t(markdownOnly?'emptyMarkdownHistory':'emptyNotesHome')}</p>}
    </div>
   </section>
   {note&&<section className="shared-notes-editor">
    <div className="shared-note-editor-actions">
     <button type="button" onClick={()=>show(undefined)} disabled={busy}>{t('backToNotesHome')}</button>
     {note.sourcePath&&<button type="button" onClick={()=>void saveLinkedNote()} disabled={busy||draft?.id!==note.id}>{t('save')}</button>}
     <button type="button" onClick={deleteSelected} disabled={busy}>{t('deleteSavedNote')}</button>
    </div>
    <input aria-label={t('noteHeading')} placeholder={t('untitledNote')} value={note.title} maxLength={60} readOnly={!!note.sourcePath} onChange={event=>entry&&edit(noteHistoryIdentity(entry),{title:event.target.value})}/>
    <span>{entry?.markdownName?t('importedMarkdown').replace('{name}',entry.markdownName):note.sourcePath?t('linkedMarkdown').replace('{name}',note.sourcePath):t('savedInSharedNotes')}</span>
    <textarea aria-label={t('noteText')} value={draft?.id===note.id?draft.text:note.text} disabled={busy} readOnly={!!note.sourcePath&&!notesLibrary.native} maxLength={NOTE_DOCUMENT_TEXT_LIMIT} onChange={event=>{
     const text=event.target.value;
     if(note.sourcePath)setDraft({id:note.id,text,expected:draft?.id===note.id?draft.expected:note.text});
     else if(entry)edit(noteHistoryIdentity(entry),{text});
    }}/>
   </section>}
  </div>
 </div>;
}
