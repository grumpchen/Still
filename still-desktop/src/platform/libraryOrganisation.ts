import {invoke,isTauri} from '@tauri-apps/api/core';
import type {LibraryNativeOperation,LibraryReceipt,LibrarySnapshot,LibraryUndoResult} from '../domain/libraryOrganisation.ts';
export const libraryOrganisation={
 available:isTauri(),
 snapshot:(id:string)=>invoke<LibrarySnapshot>('files_organisation_snapshot',{id}),
 apply:(id:string,rootId:string,operation:LibraryNativeOperation)=>invoke<LibraryReceipt>('files_organisation_apply',{id,rootId,operation}),
 undo:(id:string,rootId:string,undoToken:string)=>invoke<LibraryUndoResult>('files_organisation_undo',{id,rootId,undoToken}),
 history:(id:string,rootId:string)=>invoke<LibraryReceipt[]>('files_organisation_history',{id,rootId}),
};
