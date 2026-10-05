import {normalizeUrl} from './browser.ts';
import type {Bookmark} from './workspaces.ts';

export function bookmark(value:Partial<Bookmark>):Bookmark {
  const name=value.name?.trim();
  if(!name || name.length>60)throw new Error('Use a bookmark name from 1 to 60 characters');
  return {id:typeof value.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value.id)?value.id:crypto.randomUUID(),name,url:normalizeUrl(value.url??'')};
}
export function parseBookmarks(value:unknown,fallback:Bookmark[]=[]):Bookmark[] {
  if(!Array.isArray(value))return structuredClone(fallback);
  const result:Bookmark[]=[];
  for(const item of value.slice(0,500))try{
    const checked=bookmark(item);
    if(!result.some(b=>b.url===checked.url || b.id===checked.id))result.push(checked);
  }catch{/* Invalid saved links never become active navigation. */}
  return result;
}
export function saveBookmark(items:Bookmark[],value:Partial<Bookmark>):Bookmark[] {
  const checked=bookmark(value),existing=items.find(b=>b.id===checked.id || b.url===checked.url);
  return existing?items.map(b=>b.id===existing.id?{...checked,id:existing.id}:b):[...items,checked];
}
