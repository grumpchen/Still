import {invoke,isTauri} from '@tauri-apps/api/core';
import {captureWidget} from './capture.ts';
import {parseAssistantReply,type AssistantProvider,type ChatMessage} from '../domain/assistant.ts';

export type AssistantRequest = {provider:AssistantProvider;model:string;messages:ChatMessage[];context:string;image?:string;session_id?:string};
const ASSISTANT_IMAGE_MAX_DIMENSION=2560;
const ASSISTANT_IMAGE_JPEG_QUALITY=0.92;
const ASSISTANT_IMAGE_MAX_BASE64_LENGTH=2_800_000;
export const geminiAssistant = {
  available:isTauri(),
  configured:(provider:AssistantProvider)=>invoke<boolean>('assistant_configured',{provider}),
  models:(provider:AssistantProvider)=>invoke<string[]>('assistant_models',{provider}),
  keySetup:(provider:AssistantProvider)=>invoke<void>('assistant_key_setup',{provider}),
  setKey:(provider:AssistantProvider,key:string)=>invoke<string[]>('assistant_set_key',{provider,key}),
  async send(request:AssistantRequest){return parseAssistantReply(await invoke<unknown>('assistant_chat',{request}));},
};
export async function widgetImage(id:string):Promise<string> {
  const node=document.getElementById('widget-'+id);
  if(!node||node.closest('[hidden]'))throw new Error('This widget is no longer visible.');
  const viewport=node.closest('.canvas-viewport')?.getBoundingClientRect(),bounds=node.getBoundingClientRect();
  if(!viewport||bounds.left<viewport.left||bounds.top<viewport.top||bounds.right>viewport.right||bounds.bottom>viewport.bottom)throw new Error('Bring the whole widget into the visible canvas before sharing a screenshot.');
  return imageData(await captureWidget(node,false));
}
/** Capture the active Still canvas and visible attached app panels inside it; detached desktop windows and the assistant panel are excluded. */
export async function workspaceImage():Promise<string> {
  const node=[...document.querySelectorAll<HTMLElement>('.canvas-viewport')].find(item=>!item.closest('[hidden]'));
  if(!node)throw new Error('The workspace canvas is not visible.');
  const bounds=node.getBoundingClientRect();
  if(bounds.width<1||bounds.height<1)throw new Error('The workspace canvas is not ready to capture.');
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
