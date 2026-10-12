import {invoke,isTauri} from '@tauri-apps/api/core';
import type {StartupStatus} from '../domain/startup.ts';

export const startupSettings={
 available:isTauri(),
 status:()=>invoke<StartupStatus>('startup_status'),
 setEnabled:(enabled:boolean)=>invoke<StartupStatus>('startup_set',{enabled}),
};
