import type {LibraryNativeOperation,LibraryReceipt,LibrarySnapshot,LibraryUndoResult} from '../domain/libraryOrganisation.ts';
export const libraryOrganisation={
 // The former organisation invocations never had matching Rust handlers. Keep this path visibly unavailable;
 // direct Files actions now use the grant-scoped files_manage_resource command through collectionOperations.
 available:false,
 snapshot:(_id:string):Promise<LibrarySnapshot>=>Promise.reject(new Error('Names-only AI Library proposals are unavailable until their native review handlers are registered.')),
 apply:(_id:string,_rootId:string,_operation:LibraryNativeOperation):Promise<LibraryReceipt>=>Promise.reject(new Error('AI Library proposal execution is unavailable in this build.')),
 undo:(_id:string,_rootId:string,_undoToken:string):Promise<LibraryUndoResult>=>Promise.reject(new Error('AI Library undo is unavailable in this build.')),
 history:(_id:string,_rootId:string):Promise<LibraryReceipt[]>=>Promise.reject(new Error('AI Library operation history is unavailable in this build.')),
};
