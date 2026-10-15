export interface NoteDocument {id:string;title:string;text:string}
export const NOTE_DOCUMENT_LIMIT=40;
export const NOTE_DOCUMENT_TEXT_LIMIT=12000;
export const NOTE_DOCUMENT_TOTAL_LIMIT=480000;

export function checkedNoteDocuments(value:unknown,fallback:{id:string;title:string;text:string}):NoteDocument[]{
 const source=Array.isArray(value)?value:[fallback],ids=new Set<string>(),result:NoteDocument[]=[];let total=0;
 for(const raw of source.slice(0,NOTE_DOCUMENT_LIMIT)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const item=raw as Partial<NoteDocument>;
  if(typeof item.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(item.id)||ids.has(item.id)||typeof item.title!=='string'||typeof item.text!=='string')continue;
  const title=item.title.trim().slice(0,60),text=item.text.slice(0,NOTE_DOCUMENT_TEXT_LIMIT),room=NOTE_DOCUMENT_TOTAL_LIMIT-total;
  if(room<=0)break;
  const checkedText=text.slice(0,room);total+=checkedText.length;ids.add(item.id);result.push({id:item.id,title,text:checkedText});
 }
 return result.length?result:[{id:fallback.id,title:fallback.title.trim().slice(0,60),text:fallback.text.slice(0,NOTE_DOCUMENT_TEXT_LIMIT)}];
}

export function noteDocument(documents:NoteDocument[],id:string|undefined):NoteDocument{
 return documents.find(item=>item.id===id)??documents[0];
}

export function updatedNoteDocument(documents:NoteDocument[],id:string|undefined,patch:Partial<Pick<NoteDocument,'title'|'text'>>):NoteDocument[]{
 const active=noteDocument(documents,id);
 return documents.map(item=>item.id!==active.id?item:{...active,...patch,title:(patch.title??active.title).trim().slice(0,60),text:(patch.text??active.text).slice(0,NOTE_DOCUMENT_TEXT_LIMIT)});
}

export function createNoteDocument(title=''):{id:string;title:string;text:string}{
 return{id:crypto.randomUUID(),title,text:''};
}
