export const PDF_PAGE_BOOKMARK_LIMIT=200;
export const PDF_PAGE_BOOKMARK_DRAG_TYPE='application/x-still-pdf-bookmark';

export interface PdfPageReference {widgetId:string;path:string;name:string;page:number}

export function checkedPdfPageReference(value:unknown):PdfPageReference|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const candidate=value as Record<string,unknown>,{widgetId,path,name,page}=candidate;
 if(typeof widgetId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(widgetId)||typeof path!=='string'||!path||path.length>1000||path.startsWith('/')||path.includes('\\')||/^[a-zA-Z]:/.test(path)||path.split('/').some(segment=>!segment||segment==='.'||segment==='..')||typeof name!=='string'||!name.trim()||name.length>255||typeof page!=='number'||!Number.isSafeInteger(page)||page<1||page>1_000_000||!name.toLowerCase().endsWith('.pdf'))return null;
 return{widgetId,path,name:name.trim(),page};
}

export function pdfBookmarkStorageKey(widgetId:string,path:string,fingerprint:string):string{
 return `still.pdf-bookmarks.v1.${encodeURIComponent(widgetId)}.${encodeURIComponent(path)}.${encodeURIComponent(fingerprint)}`;
}

export function readPdfBookmarks(storage:Pick<Storage,'getItem'>,key:string,pageCount:number):number[]{
 try{
  const raw=storage.getItem(key);if(!raw||raw.length>8_192)return[];
  const value:unknown=JSON.parse(raw);
  if(!Array.isArray(value)||value.length>PDF_PAGE_BOOKMARK_LIMIT||value.some(page=>!Number.isInteger(page)||page<1||page>pageCount))return[];
  return [...new Set(value as number[])].sort((a,b)=>a-b);
 }catch{return[]}
}

export function writePdfBookmarks(storage:Pick<Storage,'setItem'|'removeItem'>,key:string,pages:readonly number[],pageCount:number):void{
 const unique=[...new Set(pages)].sort((a,b)=>a-b);
 if(!unique.length){storage.removeItem(key);return}
 if(unique.length>PDF_PAGE_BOOKMARK_LIMIT||unique.some(page=>!Number.isInteger(page)||page<1||page>pageCount))throw new Error('PDF page bookmarks are invalid or exceed the local storage limit.');
 storage.setItem(key,JSON.stringify(unique));
}
