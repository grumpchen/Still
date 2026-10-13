import type {ChatMessage} from './assistant.ts';

const STORAGE_PREFIX='still-assistant-chat-v1:';
export const SAVED_CHAT_MESSAGE_LIMIT=200;
const SAVED_CHAT_CHARACTER_LIMIT=200_000;

function checkedMessages(value:unknown):ChatMessage[]{
 if(!Array.isArray(value))return [];
 const valid=value.flatMap(item=>item&&typeof item==='object'&&(item.role==='user'||item.role==='model')&&typeof item.text==='string'?[{role:item.role,text:item.text.slice(0,12_000)} as ChatMessage]:[]).slice(-SAVED_CHAT_MESSAGE_LIMIT);
 let total=0;
 const kept:ChatMessage[]=[];
 for(const message of [...valid].reverse()){
  const remaining=SAVED_CHAT_CHARACTER_LIMIT-total;
  if(remaining<=0)break;
  const text=message.text.slice(-remaining);
  kept.push({...message,text});total+=text.length;
 }
 return kept.reverse();
}

function storageKey(workspaceId:string){return STORAGE_PREFIX+encodeURIComponent(workspaceId)}
function defaultStorage():Storage|undefined{try{return globalThis.localStorage}catch{return undefined}}

/** Chat transcripts stay on this device and are separated by workspace. */
export function readAssistantChat(workspaceId:string,storage:Pick<Storage,'getItem'>|undefined=defaultStorage()):ChatMessage[]{
 if(!workspaceId||!storage)return [];
 try{const value=storage.getItem(storageKey(workspaceId));return value?checkedMessages(JSON.parse(value)):[]}catch{return []}
}

export function saveAssistantChat(workspaceId:string,messages:ChatMessage[],storage:Pick<Storage,'setItem'>|undefined=defaultStorage()):void{
 if(!workspaceId||!storage)return;
 try{storage.setItem(storageKey(workspaceId),JSON.stringify(checkedMessages(messages)))}catch{/* chat saving is best-effort when storage is unavailable or full */}
}

export function deleteAssistantChat(workspaceId:string,storage:Pick<Storage,'removeItem'>|undefined=defaultStorage()):void{
 if(!workspaceId||!storage)return;
 try{storage.removeItem(storageKey(workspaceId))}catch{/* a deleted workspace must not block the rest of the app */}
}
