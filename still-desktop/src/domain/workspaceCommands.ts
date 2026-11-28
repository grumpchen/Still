import {defaultGlass} from './appearance.ts';
import {renameSavedPreset,removeSavedPreset} from './trayActions.ts';
import {applyRelaunchModeToAll} from './widgetRelaunch.ts';
import {duplicateWorkspace,stackWorkspaceWidgets,type WorkspaceState} from './workspaces.ts';

export type WorkspaceCommand =
 | {operation:'workspace.duplicate';workspaceId:string;name?:string}
 | {operation:'workspace.stack';workspaceId:string}
 | {operation:'preset.rename';presetId:string;name:string}
 | {operation:'preset.delete';presetId:string}
 | {operation:'appearance.reset'}
 | {operation:'relaunch.applyAll';value:'manual'|'automatic'};

export function applyWorkspaceCommand(state:WorkspaceState,command:WorkspaceCommand,viewport?:{width:number;height:number}){
 switch(command.operation){
  case 'workspace.duplicate':
  case 'workspace.stack': {
   const workspace=state.workspaces.find(item=>item.id===command.workspaceId);
   if(!workspace||workspace.role==='dashboard'||workspace.role==='library')throw new Error('Choose a course or custom workspace.');
   if(command.operation==='workspace.duplicate'){
    const copy=duplicateWorkspace(workspace,command.name??workspace.name.slice(0,55)+' copy');
    return {next:{...state,workspaces:[...state.workspaces,copy]},summary:`Created “${copy.name}” from “${workspace.name}”.`};
   }
   if(workspace.id!==state.activeId||!viewport)throw new Error('Open the workspace before stacking its widgets.');
   const widgets=stackWorkspaceWidgets(workspace.widgets,viewport.width,viewport.height);
   return {next:{...state,workspaces:state.workspaces.map(item=>item.id===workspace.id?{...item,widgets}:item)},summary:`Stacked the movable widgets in “${workspace.name}”.`};
  }
  case 'preset.rename':
  case 'preset.delete': {
   const preset=state.presets.find(item=>'preset-'+item.id===command.presetId);
   if(!preset)throw new Error('The selected saved shortcut no longer exists.');
   const presets=command.operation==='preset.delete'?removeSavedPreset(state.presets,preset.id):renameSavedPreset(state.presets,preset.id,command.name);
   return {next:{...state,presets},summary:command.operation==='preset.delete'?`Removed “${preset.name}” from the tray.`:`Renamed “${preset.name}” to “${command.name}”.`};
  }
  case 'appearance.reset':return {next:{...state,glass:defaultGlass()},summary:'Restored the default glass appearance.'};
  case 'relaunch.applyAll':return {next:applyRelaunchModeToAll(state,command.value),summary:`Applied the ${command.value} relaunch setting to every widget.`};
 }
}
