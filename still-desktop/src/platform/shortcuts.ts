import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppShortcutAction, WorkspaceDirection, WorkspaceShortcuts } from '../domain/shortcuts.ts';
export const nativeShortcuts = {
  available:isTauri(),
  configure:(shortcuts:WorkspaceShortcuts,enabled:boolean)=>invoke<void>('shortcuts_configure',{shortcuts,enabled}),
  subscribe:(callback:(direction:WorkspaceDirection)=>void):Promise<UnlistenFn>=>listen<WorkspaceDirection>('workspace-shortcut',event=>{
    if(event.payload==='up'||event.payload==='down')callback(event.payload);
  }),
  subscribeActions:(callback:(action:AppShortcutAction)=>void):Promise<UnlistenFn>=>listen<string>('app-shortcut',event=>{
    if(event.payload==='commandPalette'||event.payload==='undo'||/^workspace:[1-9]$/.test(event.payload))callback(event.payload as AppShortcutAction);
  }),
  subscribeOverviewToggle:():Promise<UnlistenFn>=>listen('workspace-overview-toggle',()=>window.dispatchEvent(new Event('still:workspace-overview-toggle'))),
};
