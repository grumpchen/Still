export type AssistantRunRecoveryStage='awaiting_review'|'applying'|'receipt_saved';
export type AssistantRunRecoveryKind='add_widget'|'workspace_action'|'inbox_moves'|'library_edit'|'library_create_note'|'library_create_folder'|'assistant_memory'|'assistant_review';
export type AssistantRunRecovery={version:1;workspaceId:string;runId:string;stage:AssistantRunRecoveryStage;kind:AssistantRunRecoveryKind;updatedAt:number};

const PREFIX='still-assistant-run-recovery-v1:';
const KINDS=new Set<AssistantRunRecoveryKind>(['add_widget','workspace_action','inbox_moves','library_edit','library_create_note','library_create_folder','assistant_memory','assistant_review']);
function defaultStorage():Pick<Storage,'getItem'|'setItem'|'removeItem'>|undefined{try{return globalThis.localStorage}catch{return undefined}}
function key(workspaceId:string){return PREFIX+encodeURIComponent(workspaceId)}

export function readAssistantRunRecovery(workspaceId:string,storage=defaultStorage()):AssistantRunRecovery|null{
 if(!workspaceId||!storage)return null;
 try{
  const raw=storage.getItem(key(workspaceId));if(!raw)return null;
  const value=JSON.parse(raw) as Partial<AssistantRunRecovery>;
  if(value.version!==1||value.workspaceId!==workspaceId||typeof value.runId!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(value.runId)||!KINDS.has(value.kind as AssistantRunRecoveryKind)||value.stage!=='awaiting_review'&&value.stage!=='applying'&&value.stage!=='receipt_saved'||typeof value.updatedAt!=='number'||!Number.isFinite(value.updatedAt))return null;
  return value as AssistantRunRecovery;
 }catch{return null}
}

/** Stores only recovery metadata. Prompts, proposals, paths, and provider data stay out of this journal. */
export function writeAssistantRunRecovery(input:Omit<AssistantRunRecovery,'version'|'updatedAt'>,storage=defaultStorage(),now=Date.now()):boolean{
 if(!input.workspaceId||!input.runId||!KINDS.has(input.kind)||input.stage!=='awaiting_review'&&input.stage!=='applying'&&input.stage!=='receipt_saved'||!storage)return false;
 try{storage.setItem(key(input.workspaceId),JSON.stringify({version:1,...input,updatedAt:now} satisfies AssistantRunRecovery));return true}catch{return false}
}

export function clearAssistantRunRecovery(workspaceId:string,runId?:string,storage=defaultStorage()):boolean{
 if(!workspaceId||!storage)return false;
 try{const current=readAssistantRunRecovery(workspaceId,storage);if(!current)return true;if(runId&&current.runId!==runId)return false;storage.removeItem(key(workspaceId));return storage.getItem(key(workspaceId))===null}catch{return false}
}

export function assistantRunRecoveryMessage(record:AssistantRunRecovery):string{
 const owner=record.kind==='assistant_review'?'Still change':'agent change';
 if(record.stage==='awaiting_review')return `A previous ${owner} was still awaiting review when Still closed. That approval expired and no change was applied by recovery. Inspect the workspace, then ask Still to prepare a fresh proposal.`;
 if(record.stage==='receipt_saved')return `A previous ${owner} has a saved execution receipt in this chat. Recovery did not repeat it.`;
 return `Still closed while an approved ${owner} was being applied. Its result may be incomplete or uncertain. Recovery did not repeat the change. Inspect the workspace before asking Still to retry.`;
}
