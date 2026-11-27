import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export const AUTOMATION_TICK_EVENT='still:automation-tick';
export interface AutomationTick { runtimeId:string; sequence:number; scheduledAtUnixMs:number }
export interface AutomationTickBatch { runtimeId:string; requestedAfterSequence:number; oldestAvailableSequence:number|null; latestSequence:number; ticks:AutomationTick[] }
export interface AutomationRuntimeStatus { runtimeId:string; tickIntervalMs:number; replayCapacity:number; latestSequence:number; lastTickScheduledAtUnixMs:number|null; hiddenToTray:boolean; trayAvailable:boolean; trayError:string|null; mainWindowVisible:boolean|null; mainWindowMinimized:boolean|null }
export interface AutomationCursor { runtimeId:string|null; sequence:number }
export interface AutomationRuntimePort {
  readonly native:boolean;
  runtimeStatus():Promise<AutomationRuntimeStatus>;
  ticksSince(cursor:AutomationCursor):Promise<AutomationTickBatch>;
  subscribeTicks(callback:(tick:AutomationTick)=>void):Promise<UnlistenFn>;
  hideToTray():Promise<void>;
}
export interface AutomationRuntimeBridge {
  native:boolean;
  invoke<T>(command:string,args?:Record<string,unknown>):Promise<T>;
  listen<T>(event:string,callback:(payload:T)=>void):Promise<UnlistenFn>;
}
const tauriBridge:AutomationRuntimeBridge={native:isTauri(),invoke,listen:(event,callback)=>listen(event,entry=>callback(entry.payload as never))};

/** Bridge-backed factory keeps native command contracts testable without a Windows host. */
export function createAutomationRuntime(bridge:AutomationRuntimeBridge):AutomationRuntimePort{
  return{
    native:bridge.native,
    runtimeStatus:()=>bridge.invoke<AutomationRuntimeStatus>('automation_runtime_status'),
    ticksSince:(cursor)=>bridge.invoke<AutomationTickBatch>('automation_ticks_since',{runtimeId:cursor.runtimeId,sequence:cursor.sequence}),
    subscribeTicks:(callback)=>bridge.listen<AutomationTick>(AUTOMATION_TICK_EVENT,tick=>{if(validTick(tick))callback(tick)}),
    hideToTray:()=>bridge.invoke<void>('window_minimize_to_tray'),
  };
}
function validTick(value:unknown):value is AutomationTick{
  return !!value&&typeof value==='object'&&typeof (value as AutomationTick).runtimeId==='string'&&Number.isSafeInteger((value as AutomationTick).sequence)&&(value as AutomationTick).sequence>0&&Number.isFinite((value as AutomationTick).scheduledAtUnixMs);
}
export const automationRuntime=createAutomationRuntime(tauriBridge);
