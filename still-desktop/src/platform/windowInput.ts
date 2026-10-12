import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';
import type {HitRegion} from '../domain/windowInput.ts';

export const windowInput={
 available:isTauri(),
 updateRegions:(enabled:boolean,regions:HitRegion[])=>invoke<void>('window_input_update_regions',{enabled,regions}),
 configureToggle:(enabled:boolean)=>invoke<void>('window_input_configure_toggle',{enabled}),
 setClickThrough:(active:boolean)=>invoke<void>('window_input_set_click_through',{active}),
 subscribe:(callback:(active:boolean)=>void):Promise<UnlistenFn>=>listen<boolean>('whole-window-click-through-changed',event=>callback(event.payload)),
};
