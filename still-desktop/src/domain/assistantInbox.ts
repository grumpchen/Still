import {parseAssistantReply,type AssistantFileProposal} from './assistant.ts';
import type {AgentToolExecution} from './agentLoop.ts';
import type {FileEntry} from '../platform/files.ts';

export type InboxInspection={id:string;rootPath:string;entries:FileEntry[];truncated:boolean};
export type ReviewedFileMove=AssistantFileProposal&{fileName:string;widgetId:string;inboxRootPath?:string;sourceSize?:number;sourceRevision?:string|null};
export type InboxMoveProposal={kind:'inbox_moves';moves:readonly Readonly<ReviewedFileMove>[];truncated:boolean};

export function reviewInboxMove(move:AssistantFileProposal,inspection:InboxInspection|null):ReviewedFileMove{
  const source=inspection?.id===move.sourceWidgetId&&inspection.entries.find(item=>item.path===move.sourcePath&&!item.directory&&!item.blocked);
  const destination=move.destinationFolder===''||inspection?.entries.some(item=>item.path===move.destinationFolder&&item.directory&&!item.blocked);
  const parent=move.sourcePath.split('/').slice(0,-1).join('/');
  if(!inspection||!source||!source.revision||!destination||parent===move.destinationFolder)throw new Error('The move does not match an available file and a different folder in the inspected inbox.');
  return {...move,fileName:source.name,widgetId:inspection.id,inboxRootPath:inspection.rootPath,sourceSize:source.size,sourceRevision:source.revision};
}

export function reviewInboxMoves(input:unknown,inspection:InboxInspection|null):InboxMoveProposal{
  if(!inspection)throw new Error('Inspect the inbox before proposing any moves.');
  if(!input||typeof input!=='object'||Object.keys(input).length!==1||!Object.hasOwn(input,'fileProposals'))throw new Error('Provide only the fileProposals array.');
  const fileProposals=(input as {fileProposals:unknown}).fileProposals;
  if(!Array.isArray(fileProposals)||fileProposals.some(item=>!item||typeof item!=='object'||Object.keys(item).length!==4))throw new Error('Use one structured proposal per file.');
  const moves=parseAssistantReply({intent:'chat',reply:'Review the file moves.',actions:[],layout:[],fileProposals}).fileProposals;
  if(!moves?.length)throw new Error('Propose at least one file move.');
  return Object.freeze({kind:'inbox_moves',moves:Object.freeze(moves.map(move=>Object.freeze(reviewInboxMove(move,inspection)))),truncated:inspection.truncated});
}

export async function executeFileMoves(
  moves:readonly Readonly<ReviewedFileMove>[],
  check:(move:Readonly<ReviewedFileMove>)=>Promise<void>,
  move:(move:Readonly<ReviewedFileMove>)=>Promise<string>,
  journal?:{begin:(move:Readonly<ReviewedFileMove>,sequence:number)=>Promise<string>;finish:(id:string,success:boolean)=>Promise<void>},
):Promise<{execution:AgentToolExecution;completed:number}>{
  const moved:{sourcePath:string;destinationPath:string}[]=[];
  const summary=()=>`${moved.length} of ${moves.length} file moves verified.`;
  for(const proposal of moves){
    let started=false;
    try{
      await check(proposal);
      const journalId=journal?await journal.begin(proposal,moved.length+1):null;
      started=true;
      let destinationPath:string;
      try{destinationPath=await move(proposal)}catch(error){if(journalId)await journal!.finish(journalId,false);throw error}
      if(!destinationPath)throw new Error('Still did not receive a destination path.');
      if(journalId)await journal!.finish(journalId,true);
      moved.push({sourcePath:proposal.sourcePath,destinationPath});
    }catch(error){
      const reason=error instanceof Error?error.message:String(error);
      const details=moved.map(item=>`${item.sourcePath} → ${item.destinationPath}`).join('\n');
      return {completed:moved.length,execution:{status:'failed',mutation:started?'unknown':moved.length?'partial':'none',error:`${summary()} ${started?'Check the failed file before retrying. ':''}Stopped at ${proposal.sourcePath}: ${reason}\n${details}`.trim()}};
    }
  }
  return {completed:moved.length,execution:{status:'succeeded',mutation:'applied',result:{receipt:summary(),moved}}};
}
