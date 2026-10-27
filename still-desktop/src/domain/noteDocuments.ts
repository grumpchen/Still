export interface NoteDocument {id:string;title:string;text:string;sourcePath?:string;tags?:string[]}
export const NOTE_DOCUMENT_LIMIT=40;
export const NOTE_DOCUMENT_TEXT_LIMIT=256000;
export const NOTE_DOCUMENT_TOTAL_LIMIT=4000000;
export const NOTE_TAG_LIMIT=12;
export const NOTE_TAG_LENGTH_LIMIT=32;

export function checkedNoteTags(value:unknown):string[]{
 if(!Array.isArray(value))return[];
 const seen=new Set<string>(),tags:string[]=[];
 for(const raw of value){if(typeof raw!=='string')continue;const tag=raw.trim().replace(/^#+/,'').replace(/\s+/g,' ').slice(0,NOTE_TAG_LENGTH_LIMIT);if(!tag||/[\u0000-\u001f\u007f]/.test(tag))continue;const key=tag.toLocaleLowerCase();if(seen.has(key))continue;seen.add(key);tags.push(tag);if(tags.length>=NOTE_TAG_LIMIT)break}
 return tags;
}

export function checkedNoteDocuments(value:unknown,fallback:{id:string;title:string;text:string}):NoteDocument[]{
 const source=Array.isArray(value)?value:[fallback],ids=new Set<string>(),result:NoteDocument[]=[];let total=0;
 for(const raw of source.slice(0,NOTE_DOCUMENT_LIMIT)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const item=raw as Partial<NoteDocument>;
  if(typeof item.id!=='string'||!/^[a-zA-Z0-9-]{1,500}$/.test(item.id)||ids.has(item.id)||typeof item.title!=='string'||typeof item.text!=='string'||(item.sourcePath!==undefined&&(typeof item.sourcePath!=='string'||item.sourcePath.length>1000)))continue;
  const title=item.title.trim().slice(0,60),text=item.text.slice(0,NOTE_DOCUMENT_TEXT_LIMIT),room=NOTE_DOCUMENT_TOTAL_LIMIT-total;
  if(room<=0)break;
  const checkedText=text.slice(0,room),tags=checkedNoteTags(item.tags);total+=checkedText.length;ids.add(item.id);result.push({id:item.id,title,text:checkedText,...(item.sourcePath&&checkedText.length===item.text.length?{sourcePath:item.sourcePath}:{}),...(tags.length?{tags}:{})});
 }
 return result.length?result:[{id:fallback.id,title:fallback.title.trim().slice(0,60),text:fallback.text.slice(0,NOTE_DOCUMENT_TEXT_LIMIT)}];
}

export function noteDocument(documents:NoteDocument[],id:string|undefined):NoteDocument{
 return documents.find(item=>item.id===id)??documents[0];
}

export function detachNoteLibraryDocuments(documents:NoteDocument[]):NoteDocument[]{
 return documents.map(({sourcePath,...document})=>document);
}

export function updatedNoteDocument(documents:NoteDocument[],id:string|undefined,patch:Partial<Pick<NoteDocument,'title'|'text'|'tags'>>):NoteDocument[]{
 const active=noteDocument(documents,id);
 return documents.map(item=>item.id!==active.id?item:{...active,...patch,title:(patch.title??active.title).trim().slice(0,60),text:(patch.text??active.text).slice(0,NOTE_DOCUMENT_TEXT_LIMIT),...(patch.tags!==undefined?{tags:checkedNoteTags(patch.tags)}:{})});
}

export function createNoteDocument(title=''):{id:string;title:string;text:string}{
 return{id:crypto.randomUUID(),title,text:''};
}
