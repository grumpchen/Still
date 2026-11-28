import type {ReadingStatus} from '../domain/fileStudy.ts';

export type FilesViewCommand =
 | {operation:'filesView.search';widgetId:string;query:string}
 | {operation:'filesView.open';widgetId:string;path:string}
 | {operation:'filesView.closePreview'|'filesView.exitSearch';widgetId:string}
 | {operation:'filesView.filter';widgetId:string;status:ReadingStatus|'all'}
 | {operation:'filesView.readingStatus';widgetId:string;path:string;status:ReadingStatus};

type FilesViewHandler=(command:FilesViewCommand)=>Promise<string>;
const views=new Map<string,FilesViewHandler>();

export function registerFilesView(widgetId:string,handler:FilesViewHandler){
 views.set(widgetId,handler);
 return ()=>{if(views.get(widgetId)===handler)views.delete(widgetId)};
}
export async function operateFilesView(command:FilesViewCommand){
 const handler=views.get(command.widgetId);
 if(!handler)throw new Error('Open the connected Files widget in the active workspace.');
 return handler(command);
}
