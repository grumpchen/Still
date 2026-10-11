import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './widgetRelaunch.ts';
import type {WidgetTagColor} from './workspaces.ts';

export interface WidgetPluginControlDefinition{
 id:string;
 pluginId:string;
 label:string;
 kind:'relaunch-global-mode'|'relaunch-tag-colors';
}
export interface BuiltInWidgetPluginDefinition{id:string;name:string;description:string;controls:WidgetPluginControlDefinition[]}
export const widgetPluginCatalog:BuiltInWidgetPluginDefinition[]=[{
 id:'widget-relaunch',name:'Widget Relaunch',description:'Control which workspace widgets start automatically.',controls:[
  {id:'widget-relaunch.global-mode',pluginId:'widget-relaunch',label:'Global relaunch mode',kind:'relaunch-global-mode'},
  {id:'widget-relaunch.tag-colors',pluginId:'widget-relaunch',label:'Tag color controls',kind:'relaunch-tag-colors'},
 ]
}];
export function availableStatusControls(status:WidgetRelaunchPluginStatus):WidgetPluginControlDefinition[]{
 return status==='enabled'?widgetPluginCatalog.flatMap(plugin=>plugin.controls):[];
}
export type WidgetPluginControlId=WidgetPluginControlDefinition['id'];
export type WidgetPluginContext={
 relaunchPluginStatus:WidgetRelaunchPluginStatus;
 globalMode:WidgetRelaunchMode;
 colors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 setGlobalMode:(mode:WidgetRelaunchMode)=>void;
 setColorMode:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
};
