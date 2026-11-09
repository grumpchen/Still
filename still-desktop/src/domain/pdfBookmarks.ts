export const PDF_PAGE_BOOKMARK_LIMIT=200;

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
