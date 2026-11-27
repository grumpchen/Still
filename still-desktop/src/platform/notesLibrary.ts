import {invoke,isTauri} from '@tauri-apps/api/core';

export interface NotesLibraryEntry {path:string;name:string;size:number}
export interface NotesLibrarySearchEntry extends NotesLibraryEntry {snippet:string}
export interface NotesLibrarySearchResult {results:NotesLibrarySearchEntry[];truncated:boolean}
const native=isTauri();
export const notesLibrary={
 native,
 choose:(id:string)=>native?invoke<string|null>('notes_library_choose',{id}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 list:(id:string)=>native?invoke<NotesLibraryEntry[]>('notes_library_list',{id}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 search:(id:string,query:string)=>native?invoke<NotesLibrarySearchResult>('notes_library_search',{id,query}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 read:(id:string,path:string)=>native?invoke<string>('notes_library_read',{id,path}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 write:(id:string,path:string,text:string,expected:string)=>native?invoke<void>('notes_library_write',{id,path,text,expected}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 create:(id:string,title:string,location='')=>native?invoke<NotesLibraryEntry>('notes_library_create',{id,location,title}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
};
