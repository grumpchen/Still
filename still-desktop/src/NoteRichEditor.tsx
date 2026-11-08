import type {RefObject} from 'react';
import type {NoteDocument} from './domain/noteDocuments.ts';
import {NOTE_TAG_LIMIT,NOTE_DOCUMENT_TEXT_LIMIT} from './domain/noteDocuments.ts';
import type {WidgetInstance} from './domain/workspaces.ts';
import {useT} from './localization.tsx';

interface Props {
 widget:WidgetInstance;
 active:NoteDocument;
 documents:NoteDocument[];
 editor:RefObject<HTMLTextAreaElement|null>;
 fontFamily:string;
 tagInput:string;
 searchQuery:string;
 matchingNotes:NoteDocument[];
 busy:boolean;
 conflictPath:string|null;
 saveState:string;
 localDocumentCount:number;
 showAiActions:boolean;
 onSearch:(value:string)=>void;
 onActivate:(id:string)=>void;
 onOpenPath:(path:string)=>void;
 onClose:(id:string)=>void;
 onCreate:()=>void;
 onTagInput:(value:string)=>void;
 onAddTag:()=>void;
 onRemoveTag:(tag:string)=>void;
 onFont:(font:WidgetInstance['noteFont'])=>void;
 onFontSize:(size:number)=>void;
 onInsertLink:(id:string)=>void;
 onFormat:(kind:'heading'|'bullet'|'task'|'bold')=>void;
 onToggleAi:()=>void;
 onAskAi:(task:'explain'|'summarize'|'summary-note'|'flashcards'|'outline'|'quiz')=>void;
 onChangeText:(value:string)=>void;
 onBlur:()=>void;
 onReload:()=>void;
}

export default function NoteRichEditor({widget,active,documents,editor,fontFamily,tagInput,searchQuery,matchingNotes,busy,conflictPath,saveState,localDocumentCount,showAiActions,onSearch,onActivate,onOpenPath,onClose,onCreate,onTagInput,onAddTag,onRemoveTag,onFont,onFontSize,onInsertLink,onFormat,onToggleAi,onAskAi,onChangeText,onBlur,onReload}:Props){
 const t=useT();
 return <div className="note-rich-file-editor">
  <div className="notes-search" role="search"><label><span aria-hidden="true">⌕</span><input aria-label={t('searchOpenNotes')} placeholder={t('searchOpenNotes')} value={searchQuery} onChange={event=>onSearch(event.target.value)}/>{searchQuery&&<button type="button" aria-label={t('clearSearch')} onClick={()=>onSearch('')}>×</button>}</label>{searchQuery&&<div className="notes-search-results">{matchingNotes.length?matchingNotes.map(document=><button type="button" key={document.id} onClick={()=>{onSearch('');if(document.sourcePath)onOpenPath(document.sourcePath);else onActivate(document.id)}}><strong>{document.title||t('untitledNote')}</strong><small>{document.text.slice(0,100)||t('noteText')}</small></button>):<p>{t('noMatchingNotesText')}</p>}</div>}</div>
  <div className="note-tabs" role="tablist" aria-label={t('openNotes')}>{documents.map((document,index)=><div className="note-tab-item" key={document.id}><button type="button" role="tab" aria-selected={document.id===active.id} className="note-tab" onClick={()=>{if(document.sourcePath)onOpenPath(document.sourcePath);else onActivate(document.id)}} title={document.title||`Untitled ${index+1}`}>{document.title||`Untitled ${index+1}`}</button><button className="note-tab-close" type="button" aria-label={`Close ${document.title||`Untitled ${index+1}`}`} title={t('closeNote')} onClick={()=>void onClose(document.id)}>×</button></div>)}<button className="note-tab-add" type="button" aria-label={t('newNote')} title={t('newNote')} onClick={onCreate}>+</button></div>
  <div className="card-body note-editor"><div className="note-tags" aria-label={t('noteTags')}><span>{t('noteTags')}</span>{(active.tags??[]).map(tag=><button type="button" className="note-tag" key={tag} onClick={()=>onRemoveTag(tag)} aria-label={t('removeNoteTag').replace('{tag}',tag)}>#{tag}<i>×</i></button>)}{(active.tags??[]).length<NOTE_TAG_LIMIT&&<input aria-label={t('addNoteTag')} placeholder={t('addNoteTag')} maxLength={32} value={tagInput} onChange={event=>onTagInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'||event.key===','){event.preventDefault();onAddTag()}}} onBlur={()=>{if(tagInput.trim())onAddTag()}}/>}</div>
   <div className="note-format-toolbar" aria-label={t('noteFormatting')}><div className="note-markdown-actions"><button type="button" aria-label={t('insertHeading')} title={t('heading')} onClick={()=>onFormat('heading')}>H2</button><button type="button" aria-label={t('insertBullet')} title={t('bulletList')} onClick={()=>onFormat('bullet')}>• List</button><button type="button" aria-label={t('insertChecklist')} title={t('checklist')} onClick={()=>onFormat('task')}>☐ Task</button><button type="button" aria-label={t('boldSelection')} title={t('bold')} onClick={()=>onFormat('bold')}><strong>B</strong></button></div><label><span>{t('font')}</span><select aria-label={t('font')} value={widget.noteFont} onChange={event=>onFont(event.target.value as WidgetInstance['noteFont'])}><option value="sans">{t('sansSerif')}</option><option value="serif">{t('serif')}</option><option value="mono">{t('monospace')}</option></select></label><label><span>{t('size')}</span><select aria-label={t('noteTextSize')} value={widget.noteFontSize} onChange={event=>onFontSize(Number(event.target.value))}>{[12,14,16,18,20,24,28].map(size=><option key={size} value={size}>{size}px</option>)}</select></label><label className="note-link-insert"><span>{t('insertNoteLink')}</span><select aria-label={t('insertNoteLink')} value="" onChange={event=>onInsertLink(event.target.value)}><option value="">{t('insertNoteLink')}</option>{documents.filter(document=>document.id!==active.id).map(document=><option key={document.id} value={document.id}>{document.title||t('untitledNote')}</option>)}</select></label>{active.sourcePath&&conflictPath===active.sourcePath&&<button type="button" disabled={busy} onClick={onReload}>{t('reloadFromFile')}</button>}</div>
   <div className="note-ai-actions" aria-label={t('studyWithAi')}><button type="button" className="note-ai-toggle" aria-expanded={showAiActions} onClick={onToggleAi}>{t('studyWithAi')}<span aria-hidden="true">{showAiActions?'⌃':'⌄'}</span></button>{showAiActions&&<div className="note-ai-actions-list"><button type="button" disabled={busy} onClick={()=>onAskAi('explain')}>{t('explain')}</button><button type="button" disabled={busy} onClick={()=>onAskAi('summarize')}>{t('summarize')}</button><button type="button" disabled={busy||!active.text.trim()} onClick={()=>onAskAi('summary-note')}>{t('makeSummaryNote')}</button><button type="button" disabled={busy} onClick={()=>onAskAi('flashcards')}>{t('flashcards')}</button><button type="button" disabled={busy} onClick={()=>onAskAi('outline')}>{t('studyOutline')}</button><button type="button" disabled={busy} onClick={()=>onAskAi('quiz')}>{t('quiz')}</button></div>}</div>
   <textarea ref={editor} className="note" aria-label={t('noteText')} disabled={busy} maxLength={NOTE_DOCUMENT_TEXT_LIMIT} style={{fontFamily,fontSize:`${widget.noteFontSize}px`}} value={active.text} onChange={event=>onChangeText(event.target.value)} onBlur={onBlur}/>
   {(documents.some(document=>document.id!==active.id&&active.text.includes(`[[note:${document.id}]]`))||documents.some(document=>document.id!==active.id&&document.text.includes(`[[note:${active.id}]]`)))&&<div className="note-links">{documents.filter(document=>document.id!==active.id&&active.text.includes(`[[note:${document.id}]]`)).length>0&&<div><span>{t('linkedNotes')}</span>{documents.filter(document=>document.id!==active.id&&active.text.includes(`[[note:${document.id}]]`)).map(document=><button type="button" key={document.id} onClick={()=>document.sourcePath?onOpenPath(document.sourcePath):onActivate(document.id)}>{document.title||t('untitledNote')}</button>)}</div>}{documents.filter(document=>document.id!==active.id&&document.text.includes(`[[note:${active.id}]]`)).length>0&&<div><span>{t('referencedBy')}</span>{documents.filter(document=>document.id!==active.id&&document.text.includes(`[[note:${active.id}]]`)).map(document=><button type="button" key={document.id} onClick={()=>document.sourcePath?onOpenPath(document.sourcePath):onActivate(document.id)}>{document.title||t('untitledNote')}</button>)}</div>}</div>}
  </div><div className="note-status">{active.sourcePath?t(saveState):`${t('localNoteCount').replace('{count}',String(localDocumentCount))}`}</div>
 </div>;
}
