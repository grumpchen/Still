import {invoke,isTauri} from '@tauri-apps/api/core';
import {normalizeUrl} from '../domain/browser.ts';
export const chromeLauncher={native:isTauri(),async open(value:string){
  const url=normalizeUrl(value);
  if(this.native)return invoke<void>('chrome_open',{url});
  const tab=window.open(url,'_blank','noopener,noreferrer');void tab;
}};
