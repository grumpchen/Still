export interface RecentLibraryFile {widgetId:string;name:string;path:string;openedAt:number}
const STORAGE_KEY='still-library-recent-files-v1';
export const RECENT_LIBRARY_FILES_LIMIT=12;

function safeRelativePath(path:string):boolean{return path.length>0&&path.length<=2048&&!path.startsWith('/')&&!/^[a-z]:/i.test(path)&&!path.split(/[\\/]/).includes('..')}
function validRecentFile(value:unknown):value is RecentLibraryFile{
 if(!value||typeof value!=='object')return false;
 const item=value as Partial<RecentLibraryFile>;
 return typeof item.widgetId==='string'&&item.widgetId.length>0&&item.widgetId.length<=128&&typeof item.name==='string'&&item.name.length>0&&item.name.length<=512&&typeof item.path==='string'&&safeRelativePath(item.path)&&typeof item.openedAt==='number'&&Number.isFinite(item.openedAt)&&item.openedAt>0&&item.openedAt<=Date.now()+60_000;
}

export function readRecentLibraryFiles():RecentLibraryFile[]{
 try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)??'[]');if(!Array.isArray(value))return[];return value.filter(validRecentFile).slice(0,RECENT_LIBRARY_FILES_LIMIT)}catch{return[]}
}

export function rememberRecentLibraryFile(value:RecentLibraryFile):RecentLibraryFile[]{
 if(!validRecentFile(value))return readRecentLibraryFiles();
 const next=[value,...readRecentLibraryFiles().filter(item=>item.widgetId!==value.widgetId||item.path!==value.path)].slice(0,RECENT_LIBRARY_FILES_LIMIT);
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* Recent history is optional when storage is unavailable. */}
 return next;
}
