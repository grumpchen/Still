import type {WidgetTaskStatusFilter} from '../domain/widgetTaskStatus.ts';
import type {SnapLayoutId} from '../domain/snapLayouts.ts';

export type CanvasCommand=
 | {operation:'canvas.overview';workspaceId:string;enabled:boolean}
 | {operation:'canvas.filter';workspaceId:string;status:WidgetTaskStatusFilter}
 | {operation:'canvas.snap';workspaceId:string;widgetId:string;layout:SnapLayoutId;zone:number}
 | {operation:'canvas.exportPng'|'canvas.copyImage'|'canvas.raise';workspaceId:string;widgetId:string};

type CanvasHandler=(command:CanvasCommand)=>Promise<string>;
const activeCanvases=new Map<string,CanvasHandler>();
export function registerCanvas(workspaceId:string,handler:CanvasHandler){
 activeCanvases.set(workspaceId,handler);
 return ()=>{if(activeCanvases.get(workspaceId)===handler)activeCanvases.delete(workspaceId)};
}
export function operateCanvas(command:CanvasCommand){
 const handler=activeCanvases.get(command.workspaceId);
 if(!handler)throw new Error('Open the requested workspace canvas first.');
 return handler(command);
}
