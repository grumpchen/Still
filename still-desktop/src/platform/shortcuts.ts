import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { WorkspaceDirection, WorkspaceShortcuts } from '../domain/shortcuts.ts';
export const nativeShortcuts = {
  available:isTauri(),
  configure:(shortcuts:WorkspaceShortcuts,enabled:boolean)=>invoke<void>('shortcuts_configure',{shortcuts,enabled}),
  subscribe:(callback:(direction:WorkspaceDirection)=>void):Promise<UnlistenFn>=>listen<WorkspaceDirection>('workspace-shortcut',event=>{
    if(event.payload==='up'||event.payload==='down')callback(event.payload);
  }),
};
