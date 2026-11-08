import {invoke,isTauri} from '@tauri-apps/api/core';
import {captureWidget} from './capture.ts';
import {parseAssistantReply,type AssistantProvider,type AssistantReply,type ChatMessage} from '../domain/assistant.ts';
import {runAgentLoop,resumeAgentLoop,createAgentToolDispatcher,type AgentLoopOptions,type AgentLoopResult,type AgentToolCall,type AgentToolCallResult,type AgentToolExecution,type AgentToolHandler,type AgentToolDispatchResult} from '../domain/agentLoop.ts';
import type {AddNotesWidgetProposal,AssistantMemoryProposal,SafeWorkspaceActionProposal,StillWorkspaceToolRegistry} from '../domain/assistantTools.ts';
import type {InboxMoveProposal} from '../domain/assistantInbox.ts';

export type AssistantRequest = {provider:AssistantProvider;model:string;messages:ChatMessage[];context:string;image?:string;session_id?:string};
export type ProviderAgentMessage = {role:'user';content:string}|{role:'assistant';content?:string|null;tool_calls?:{id:string;type:'function';function:{name:string;arguments:string}}[];gemini_content?:unknown;plan_reasoning?:unknown}|{role:'tool';tool_call_id:string;content:string};
export type ProviderAgentCall = {id:string;name:string;input:unknown};
export type ProviderAgentTurn = {kind:'final';response:unknown}|{kind:'tool_calls';assistantMessage:ProviderAgentMessage;calls:ProviderAgentCall[]};
export type ProviderAgentProposal=AddNotesWidgetProposal|SafeWorkspaceActionProposal|AssistantMemoryProposal|InboxMoveProposal;
type InboxMoveTools={prepare:(input:unknown)=>InboxMoveProposal;execute:(proposal:InboxMoveProposal)=>Promise<AgentToolExecution>};
export type ProviderAgentOutcome = {status:'final';response:AssistantReply}|{status:'awaiting_confirmation';proposal:ProviderAgentProposal;approve:()=>Promise<{execution:AgentToolExecution;resume:()=>Promise<ProviderAgentOutcome>}>;decline:()=>Promise<ProviderAgentOutcome>};
const MAX_AGENT_TOOL_RESULT_CHARS=64_000;
const ASSISTANT_IMAGE_MAX_DIMENSION=2560;
const ASSISTANT_IMAGE_JPEG_QUALITY=0.92;
const ASSISTANT_IMAGE_MAX_BASE64_LENGTH=2_800_000;
type ChatgptPlanStatus={connected:boolean;email:string|null};
type ChatgptPlanModel={slug:string;display_name:string};
export const chatgptPlan = {
  status:()=>invoke<ChatgptPlanStatus>('chatgpt_plan_status'),
  connect:()=>invoke<ChatgptPlanStatus>('chatgpt_plan_connect'),
  disconnect:()=>invoke<boolean>('chatgpt_plan_disconnect'),
  models:()=>invoke<ChatgptPlanModel[]>('chatgpt_plan_models'),
};
export const geminiAssistant = {
  available:isTauri(),
  configured:(provider:AssistantProvider)=>invoke<boolean>('assistant_configured',{provider}),
  models:(provider:AssistantProvider)=>invoke<string[]>('assistant_models',{provider}),
  keySetup:(provider:AssistantProvider)=>invoke<void>('assistant_key_setup',{provider}),
  setKey:(provider:AssistantProvider,key:string)=>invoke<string[]>('assistant_set_key',{provider,key}),
  async send(request:AssistantRequest){return parseAssistantReply(await invoke<unknown>('assistant_chat',{request}));},
  async agentTurn(request:{provider:AssistantProvider;model:string;messages:ProviderAgentMessage[];session_id:string;enable_add_widget_tool?:boolean;enable_safe_workspace_action_tool?:boolean;enable_assistant_memory_tool?:boolean;enable_inbox_tool?:boolean;enable_inbox_move_tool?:boolean}){
    const turn=request.provider==='chatgpt'
      ? await invoke<ProviderAgentTurn>('chatgpt_plan_agent_turn',{request:{...request,provider:'openai'}})
      : await invoke<ProviderAgentTurn>('assistant_agent_turn',{request});
    return turn.kind==='final'?{kind:'final' as const,response:parseAssistantReply(turn.response)}:turn;
  },
};

export async function runProviderAgent(options:{provider:AssistantProvider;model:string;messages:ProviderAgentMessage[];sessionId:string;inspectWorkspace?:()=>unknown|Promise<unknown>;inspectInbox?:()=>unknown|Promise<unknown>;inboxMoves?:InboxMoveTools;validateWorkspace?:()=>void;toolRegistry?:StillWorkspaceToolRegistry;enableSafeWorkspaceActionTool?:boolean;enableAssistantMemoryTool?:boolean}):Promise<ProviderAgentOutcome>{
  let oversizedWorkspaceResult=false,notesToolUsed=false,safeActionToolUsed=false,memoryToolUsed=false;
  const inspectWorkspace:AgentToolHandler=async(input:unknown):Promise<AgentToolDispatchResult>=>{
    const registered=options.toolRegistry?.tools.inspect_workspace;
    if(registered){
      const result=await registered(input);
      if(result.status==='succeeded'&&JSON.stringify(result).length>MAX_AGENT_TOOL_RESULT_CHARS){oversizedWorkspaceResult=true;return {status:'failed',mutation:'none',error:'The current workspace context is too large for the agent preview. Select fewer widgets or use the standard assistant mode.'}}
      return result;
    }
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length) return {status:'failed',mutation:'none',error:'inspect_workspace takes no arguments.'};
    if(!options.inspectWorkspace)return {status:'failed',mutation:'none',error:'Workspace inspection is unavailable.'};
    const result=await options.inspectWorkspace?.();
    if(JSON.stringify({status:'succeeded',mutation:'none',result}).length>MAX_AGENT_TOOL_RESULT_CHARS){oversizedWorkspaceResult=true;return {status:'failed',mutation:'none',error:'The current workspace context is too large for the agent preview. Select fewer widgets or use the standard assistant mode.'}}
    return {status:'succeeded',mutation:'none',result};
  };
  const inspectInbox:AgentToolHandler=async input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)return {status:'failed',mutation:'none',error:'inspect_inbox takes no arguments.'};if(!options.inspectInbox)return {status:'failed',mutation:'none',error:'Downloads Inbox is unavailable.'};try{const result=await options.inspectInbox();if(JSON.stringify(result).length>MAX_AGENT_TOOL_RESULT_CHARS)return {status:'failed',mutation:'none',error:'The inbox listing is too large.'};return {status:'succeeded',mutation:'none',result}}catch(error){return {status:'failed',mutation:'none',error:error instanceof Error?error.message:String(error)}}};
  const registeredAddWidget=options.toolRegistry?.tools.add_widget;
  const addWidget:AgentToolHandler=async input=>{if(notesToolUsed)return {status:'failed',mutation:'none',error:'Only one Notes widget may be proposed in a user turn.'};return registeredAddWidget?registeredAddWidget(input):{status:'failed',mutation:'none',error:'Adding a Notes widget is unavailable.'}};
  const registeredSafeAction=options.toolRegistry?.tools.propose_workspace_action;
  const safeAction:AgentToolHandler=async input=>{if(safeActionToolUsed)return {status:'failed',mutation:'none',error:'Only one reviewed workspace action is allowed in a user turn.'};return registeredSafeAction?registeredSafeAction(input):{status:'failed',mutation:'none',error:'Workspace actions are unavailable.'}};
  const registeredMemory=options.toolRegistry?.tools.propose_assistant_memory;
  const proposeMemory:AgentToolHandler=async input=>{if(memoryToolUsed)return {status:'failed',mutation:'none',error:'Only one assistant memory item may be proposed in a user turn.'};return registeredMemory?registeredMemory(input):{status:'failed',mutation:'none',error:'Saving assistant memory is unavailable.'}};
  // The wider action tool remains separately opted-in and confirmation-gated.
  const tools:Readonly<Record<string,AgentToolHandler>>=options.toolRegistry?{inspect_workspace:inspectWorkspace,inspect_inbox:inspectInbox,add_widget:addWidget,...(options.enableSafeWorkspaceActionTool?{propose_workspace_action:safeAction}:{}),...(options.enableAssistantMemoryTool?{propose_assistant_memory:proposeMemory}:{})}: {inspect_workspace:inspectWorkspace,inspect_inbox:inspectInbox};
  const inboxMoves=options.inspectInbox&&options.inboxMoves;
  const proposeInboxMoves:AgentToolHandler=input=>{
    if(!inboxMoves)return {status:'failed',mutation:'none',error:'Inbox moves are unavailable.'};
    try{return {status:'requires_confirmation',proposal:inboxMoves.prepare(input)}}
    catch(error){return {status:'failed',mutation:'none',error:error instanceof Error?error.message:String(error)}}
  };
  const dispatcher=createAgentToolDispatcher({...tools,...(inboxMoves?{propose_inbox_moves:proposeInboxMoves}:{})});
  const appendToolRound=(history:readonly ProviderAgentMessage[],assistantMessage:ProviderAgentMessage,results:readonly AgentToolCallResult[]):ProviderAgentMessage[]=>[
    ...history,assistantMessage,...results.map(item=>({role:'tool' as const,tool_call_id:item.toolCallId,content:JSON.stringify(item.execution)})),
  ];
  const loopOptions:AgentLoopOptions<ProviderAgentMessage,AssistantReply>={
    history:options.messages,
    requestModel:async history=>{if(oversizedWorkspaceResult)throw new Error('The current workspace context is too large for the agent preview. Select fewer widgets or use the standard assistant mode.');return geminiAssistant.agentTurn({provider:options.provider,model:options.model,messages:[...history],session_id:options.sessionId,enable_add_widget_tool:!!options.toolRegistry,enable_safe_workspace_action_tool:!!options.enableSafeWorkspaceActionTool,enable_assistant_memory_tool:!!options.enableAssistantMemoryTool,enable_inbox_tool:!!options.inspectInbox,enable_inbox_move_tool:!!inboxMoves})},
    executeTool:(call:AgentToolCall)=>dispatcher(call),appendToolRound,
    confirmationRequiredToolNames:[...(options.toolRegistry?['add_widget',...(options.enableSafeWorkspaceActionTool?['propose_workspace_action']:[]),...(options.enableAssistantMemoryTool?['propose_assistant_memory']:[])]:[]),...(inboxMoves?['propose_inbox_moves']:[])],
  };
  const wrapResult=async(result:AgentLoopResult<ProviderAgentMessage,AssistantReply>,allowSnapshotCheck=true):Promise<ProviderAgentOutcome>=>{
    if(result.status==='awaiting_confirmation'){
      if(result.proposal===null||typeof result.proposal!=='object'||!['add_widget','workspace_action','assistant_memory','inbox_moves'].includes(String((result.proposal as {kind?:unknown}).kind)))throw new Error('Still received an unsupported agent proposal. Nothing was changed.');
      const proposal=result.proposal as ProviderAgentProposal;
      if(proposal.kind==='inbox_moves'?!inboxMoves:!options.toolRegistry)throw new Error('This agent tool is unavailable.');
      let decided=false;
      const decide=()=>{if(decided)throw new Error('This proposal was already reviewed.');decided=true;};
      const continueWith=(execution:AgentToolExecution)=>{
        let resumed=false;
        return async()=>{if(resumed)throw new Error('This agent step already resumed.');resumed=true;return wrapResult(await resumeAgentLoop(loopOptions,result.continuation,execution),false)};
      };
      const markUsed=()=>{if(proposal.kind==='add_widget')notesToolUsed=true;else if(proposal.kind==='workspace_action')safeActionToolUsed=true;else if(proposal.kind==='assistant_memory')memoryToolUsed=true};
      return {status:'awaiting_confirmation',proposal,approve:async()=>{decide();markUsed();const execution=proposal.kind==='inbox_moves'?await inboxMoves!.execute(proposal):proposal.kind==='add_widget'?await options.toolRegistry!.executeConfirmed(proposal):proposal.kind==='workspace_action'?await options.toolRegistry!.executeConfirmedAction(proposal):await options.toolRegistry!.executeConfirmedMemory(proposal);return {execution,resume:continueWith(execution)}},decline:async()=>{decide();markUsed();return continueWith({status:'failed',mutation:'none',error:'The user declined this proposal. Nothing was changed.'})();}};
    }
    if(result.status!=='final')throw new Error(`The agent stopped before a final answer (${result.status.replace('_',' ')}).`);
    const inspectionFailure=result.toolResults.find(item=>item.toolName==='inspect_workspace'&&item.execution.status==='failed');
    if(inspectionFailure?.execution.status==='failed')throw new Error(`Still could not inspect the workspace. ${inspectionFailure.execution.error}`);
    const gatedActionFailure=result.toolResults.find(item=>(item.toolName==='add_widget'||item.toolName==='propose_workspace_action'||item.toolName==='propose_assistant_memory')&&item.execution.status==='failed'&&item.execution.error!=='The user declined this proposal. Nothing was changed.');
    if(gatedActionFailure?.execution.status==='failed')throw new Error(`Still could not complete the reviewed workspace action. ${gatedActionFailure.execution.error}`);
    const inboxFailure=result.toolResults.find(item=>item.toolName==='propose_inbox_moves'&&item.execution.status==='failed'&&item.execution.error!=='The user declined this proposal. Nothing was changed.');
    if(inboxFailure?.execution.status==='failed'&&!allowSnapshotCheck)return {status:'final',response:{intent:'chat',reply:'See the file move receipt for the verified outcome.',actions:[],layout:[]}};
    if(allowSnapshotCheck)options.validateWorkspace?.();
    return {status:'final',response:result.response};
  };
  return wrapResult(await runAgentLoop(loopOptions));
}
export async function widgetImage(id:string):Promise<string> {
  const node=document.getElementById('widget-'+id);
  if(!node||node.closest('[hidden]'))throw new Error('This widget is no longer visible.');
  const viewport=node.closest('.canvas-viewport')?.getBoundingClientRect(),bounds=node.getBoundingClientRect();
  if(!viewport||bounds.left<viewport.left||bounds.top<viewport.top||bounds.right>viewport.right||bounds.bottom>viewport.bottom)throw new Error('Bring the whole widget into the visible canvas before sharing a screenshot.');
  return imageData(await captureWidget(node,false));
}
/** Capture only the active workspace viewport (canvas or fixed page), excluding the assistant and detached desktop windows. */
export async function workspaceImage():Promise<string> {
  const canvas=[...document.querySelectorAll<HTMLElement>('.canvas-viewport')].find(item=>!item.closest('[hidden]'));
  const page=[...document.querySelectorAll<HTMLElement>('.workspace-surface:not([hidden]) :is(.dashboard-home,.library-home)')].find(item=>!item.closest('[hidden]'));
  // Fixed pages may be taller than the window: capture their scroll viewport, not the full document.
  const node=canvas??page?.closest<HTMLElement>('.main > .content');
  if(!node)throw new Error('The active workspace is not visible.');
  const bounds=node.getBoundingClientRect();
  if(bounds.width<1||bounds.height<1)throw new Error('The workspace is not ready to capture.');
  return imageData(await captureWidget(node,false,true,false));
}
async function imageData(blob:Blob):Promise<string>{
  const image=await createImageBitmap(blob);
  try{
    const scale=Math.min(1,ASSISTANT_IMAGE_MAX_DIMENSION/image.width,ASSISTANT_IMAGE_MAX_DIMENSION/image.height),canvas=document.createElement('canvas');
    let width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Could not prepare the widget screenshot.');
    for(let attempt=0;attempt<8;attempt++){
      canvas.width=width;canvas.height=height;context.drawImage(image,0,0,width,height);
      for(const quality of [ASSISTANT_IMAGE_JPEG_QUALITY,0.88,0.84,0.8]){
        const base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];
        if(base64.length<=ASSISTANT_IMAGE_MAX_BASE64_LENGTH)return base64;
      }
      if(Math.max(width,height)<=1280)break;
      width=Math.max(1,Math.round(width*0.85));height=Math.max(1,Math.round(height*0.85));
    }
    throw new Error('This screenshot is too large to share.');
  }finally{image.close();}
}
