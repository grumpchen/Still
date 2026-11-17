import type {Workspace} from './workspaces.ts';
import {createNoteDocument,NOTE_DOCUMENT_LIMIT,NOTE_DOCUMENT_TEXT_LIMIT,NOTE_DOCUMENT_TOTAL_LIMIT} from './noteDocuments.ts';

export function addGeneratedResultNote(workspace:Workspace,generatedWidgetId:string,notesWidgetId:string,title:string,text:string):{workspace:Workspace;noteId:string;title:string}{
 if(!workspace.widgets.some(widget=>widget.id===generatedWidgetId&&widget.type==='generated'))throw new Error('generatedWidgetSaveSourceMissing');
 const notes=workspace.widgets.find(widget=>widget.id===notesWidgetId&&widget.type==='notes');
 if(!notes)throw new Error('generatedWidgetSaveTargetMissing');
 if(notes.notesLibraryKey)throw new Error('generatedWidgetSaveFolderNotes');
 if(notes.noteDocuments.length>=NOTE_DOCUMENT_LIMIT)throw new Error('generatedWidgetSaveNoteLimit');
 const noteTitle=title.trim().slice(0,60),noteText=text.trim();
 if(!noteTitle||!noteText)throw new Error('generatedWidgetSaveEmpty');
 if(noteText.length>NOTE_DOCUMENT_TEXT_LIMIT)throw new Error('generatedWidgetSaveTextLimit');
 const total=notes.noteDocuments.reduce((sum,note)=>sum+note.text.length,0);
 if(total+noteText.length>NOTE_DOCUMENT_TOTAL_LIMIT)throw new Error('generatedWidgetSaveTotalLimit');
 const note=createNoteDocument(noteTitle);note.text=noteText;
 const updated={...notes,noteDocuments:[...notes.noteDocuments,note],activeNoteDocumentId:note.id,title:note.title,text:note.text};
 return{workspace:{...workspace,widgets:workspace.widgets.map(widget=>widget.id===notes.id?updated:widget)},noteId:note.id,title:note.title};
}
