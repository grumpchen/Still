import {invoke,isTauri} from '@tauri-apps/api/core';

export interface NotesLibraryEntry {path:string;name:string;size:number}
export interface NotesLibrarySearchEntry extends NotesLibraryEntry {snippet:string}
export interface NotesLibrarySearchResult {results:NotesLibrarySearchEntry[];truncated:boolean}
export interface NotesAgentListing {entries:NotesLibraryEntry[];truncated:boolean}
export interface NotesAgentRead {text:string;truncated:boolean}
const native=isTauri();
export const notesLibrary={
 native,
 choose:(id:string)=>native?invoke<string|null>('notes_library_choose',{id}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 list:(id:string)=>native?invoke<NotesLibraryEntry[]>('notes_library_list',{id}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 search:(id:string,query:string)=>native?invoke<NotesLibrarySearchResult>('notes_library_search',{id,query}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 read:(id:string,path:string)=>native?invoke<string>('notes_library_read',{id,path}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 write:(id:string,path:string,text:string,expected:string)=>native?invoke<void>('notes_library_write',{id,path,text,expected}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
 agentGrant:(id:string)=>native?invoke<string>('notes_library_agent_grant',{id}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 agentList:(id:string,grant:string)=>native?invoke<NotesAgentListing>('notes_library_agent_list',{id,grant}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 agentSearch:(id:string,grant:string,query:string)=>native?invoke<NotesLibrarySearchResult>('notes_library_agent_search',{id,grant,query}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 agentRead:(id:string,grant:string,path:string)=>native?invoke<NotesAgentRead>('notes_library_agent_read',{id,grant,path}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 agentWrite:(id:string,grant:string,path:string,text:string,expected:string)=>native?invoke<void>('notes_library_agent_write',{id,grant,path,text,expected}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 agentCreate:(id:string,grant:string,location:string,title:string,text:string)=>native?invoke<NotesLibraryEntry>('notes_library_agent_create',{id,grant,location,title,text}):Promise.reject(new Error('Library agent tools are available in the Still desktop app.')),
 create:(id:string,title:string,location='',text='')=>native?invoke<NotesLibraryEntry>('notes_library_create',{id,location,title,text}):Promise.reject(new Error('Notes libraries are available in the Still desktop app.')),
};
