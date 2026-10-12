import {isTauri} from '@tauri-apps/api/core';
import {openUrl} from '@tauri-apps/plugin-opener';

/** Open a validated external destination using the user's default browser. */
export async function openExternalUrl(url:string):Promise<void>{
 if(isTauri())return openUrl(url);
 const opened=window.open(url,'_blank','noopener,noreferrer');
 if(!opened)throw new Error('The browser blocked this link. Allow pop-ups for Still and try again.');
}
