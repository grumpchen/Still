export interface NativeWidgetPanelLifecycle {
 suspendForCollection(id:string):Promise<boolean>;
 cancelCollection(id:string):Promise<unknown>;
 release(id:string,closeApp?:boolean):Promise<{managedWindow:boolean;closeRequested:boolean}>;
}

export async function moveWithRetainedNativePanel<T>(id:string,retain:boolean,panel:Pick<NativeWidgetPanelLifecycle,'suspendForCollection'|'cancelCollection'>,move:()=>T|Promise<T>):Promise<T>{
 if(!retain)return move();
 const suspended=await panel.suspendForCollection(id);
 if(!suspended)throw new Error('The attached app window could not be verified and hidden. The widget was not moved.');
 try{return await move()}
 catch(error){
  try{await panel.cancelCollection(id)}catch(rollbackError){throw new Error(`The widget was not moved. The attached app could not be resumed after the failed move: ${String(rollbackError)}`,{cause:error})}
  throw error;
 }
}

export class NativeAppRemovalError extends Error{
 readonly closeRequestedIds:string[];readonly desktopReleasedIds:string[];
 readonly phase:'close-request'|'state-commit';
 constructor(phase:'close-request'|'state-commit',closeRequestedIds:string[],desktopReleasedIds:string[],cause:unknown){
  super(phase==='close-request'?`Could not complete all normal app close requests. ${closeRequestedIds.length} close request(s) were sent before the failure.`:'App close requests were sent, but the workspace change could not be saved.',{cause});
  this.name='NativeAppRemovalError';this.phase=phase;this.closeRequestedIds=closeRequestedIds;this.desktopReleasedIds=desktopReleasedIds;
 }
}

export async function closeNativeAppsBeforeMutation<T>(ids:string[],panel:Pick<NativeWidgetPanelLifecycle,'release'>,mutate:(closeRequestedIds:readonly string[])=>T|Promise<T>):Promise<{value:T;closeRequestedIds:string[];desktopReleasedIds:string[]}>{
 const closeRequestedIds:string[]=[],desktopReleasedIds:string[]=[];
 for(const id of [...new Set(ids)])try{const result=await panel.release(id,true);if(result.closeRequested)closeRequestedIds.push(id);else if(result.managedWindow){desktopReleasedIds.push(id);throw new Error('The native panel was released to the desktop, but its normal close request was not accepted.')}}catch(error){throw new NativeAppRemovalError('close-request',closeRequestedIds,desktopReleasedIds,error)}
 try{return{value:await mutate(closeRequestedIds),closeRequestedIds,desktopReleasedIds}}
 catch(error){throw new NativeAppRemovalError('state-commit',closeRequestedIds,desktopReleasedIds,error)}
}
