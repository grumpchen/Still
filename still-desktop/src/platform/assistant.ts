import {invoke,isTauri} from '@tauri-apps/api/core';
import {captureWidget} from './capture.ts';
import {assistantIsConversationalOnly,parseAssistantReply,type AssistantProvider,type ChatMessage} from '../domain/assistant.ts';

export type AssistantRequest = {provider:AssistantProvider;model:string;messages:ChatMessage[];context:string;image?:string};
export const geminiAssistant = {
  available:isTauri(),
  configured:(provider:AssistantProvider)=>invoke<boolean>('assistant_configured',{provider}),
  models:(provider:AssistantProvider)=>invoke<string[]>('assistant_models',{provider}),
  keySetup:(provider:AssistantProvider)=>invoke<void>('assistant_key_setup',{provider}),
  setKey:(provider:AssistantProvider,key:string)=>invoke<string[]>('assistant_set_key',{provider,key}),
  async send(request:AssistantRequest){
    const prompt=request.messages.at(-1)?.text??'';
    const response=await invoke<unknown>('assistant_chat',{request});
    return parseAssistantReply(response,{ignoreWorkspaceChanges:assistantIsConversationalOnly(prompt)});
  },
};
export async function widgetImage(id:string):Promise<string> {
  const node=document.getElementById('widget-'+id);
  if(!node||node.closest('[hidden]'))throw new Error('This widget is no longer visible.');
  const viewport=node.closest('.canvas-viewport')?.getBoundingClientRect(),bounds=node.getBoundingClientRect();
  if(!viewport||bounds.left<viewport.left||bounds.top<viewport.top||bounds.right>viewport.right||bounds.bottom>viewport.bottom)throw new Error('Bring the whole widget into the visible canvas before sharing a screenshot.');
  const image=await createImageBitmap(await captureWidget(node,false));
  try{
    const scale=Math.min(1,1280/image.width,1280/image.height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Could not prepare the widget screenshot.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const base64=canvas.toDataURL('image/jpeg',0.8).split(',')[1];
    if(base64.length>2800000)throw new Error('This screenshot is too large to share.');
    return base64;
  }finally{image.close();}
}
