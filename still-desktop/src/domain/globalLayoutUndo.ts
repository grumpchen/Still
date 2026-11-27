import type {GlobalWorkspaceLayout,WorkspaceState} from './workspaces.ts';

type AppearanceState=Pick<WorkspaceState,'theme'|'density'|'background'|'appearance'|'glass'>;
export interface GlobalLayoutUndoRecord{
 targetId:string;
 activeBefore:string;
 activeAfter:string;
 before:WorkspaceState['workspaces'][number];
 after:WorkspaceState['workspaces'][number];
 appearanceBefore:AppearanceState;
 appearanceAfter:AppearanceState;
}
function appearance(state:WorkspaceState):AppearanceState{return{theme:state.theme,density:state.density,background:state.background,appearance:state.appearance,glass:state.glass}}
function same(left:unknown,right:unknown):boolean{return JSON.stringify(left)===JSON.stringify(right)}
export function createGlobalLayoutUndoRecord(before:WorkspaceState,targetId:string,afterWorkspace:WorkspaceState['workspaces'][number],layout:GlobalWorkspaceLayout,activeAfter=targetId):GlobalLayoutUndoRecord{
 return{targetId,activeBefore:before.activeId,activeAfter,before:structuredClone(before.workspaces.find(item=>item.id===targetId)!),after:structuredClone(afterWorkspace),appearanceBefore:structuredClone(appearance(before)),appearanceAfter:structuredClone(layout.settings)};
}
export function undoGlobalLayoutTarget(current:WorkspaceState,record:GlobalLayoutUndoRecord):{state:WorkspaceState;reason?:string}{
 const existing=current.workspaces.find(item=>item.id===record.targetId);
 if(!existing||!same(existing,record.after))return{state:current,reason:'The target workspace changed after this layout was applied. Undo was not applied.'};
 const next={...current,activeId:current.activeId===record.activeAfter?record.activeBefore:current.activeId,workspaces:current.workspaces.map(item=>item.id===record.targetId?structuredClone(record.before):item)};
 const appearanceAfter=appearance(current);
 if(same(appearanceAfter,record.appearanceAfter))Object.assign(next,structuredClone(record.appearanceBefore));
 return{state:next};
}
