import type {ComponentType} from 'react';
import type {WidgetRelaunchMode,WidgetRelaunchPluginStatus} from './widgetRelaunch.ts';
import type {ScreenshotPluginMode} from './screenshotPlugin.ts';
import type {WidgetTagColor} from './workspaces.ts';
import {RelaunchGlobalModeControl,RelaunchTagColorsControl,ScreenshotSettingsControl} from '../WidgetPluginStatusControls.tsx';

export interface WidgetPluginContext{
 relaunchPluginStatus:WidgetRelaunchPluginStatus;
 globalMode:WidgetRelaunchMode;
 colors:Partial<Record<WidgetTagColor,WidgetRelaunchMode>>;
 setGlobalMode:(mode:WidgetRelaunchMode)=>void;
 setColorMode:(color:WidgetTagColor,mode:WidgetRelaunchMode|null)=>void;
 screenshotMode:ScreenshotPluginMode;
 screenshotColors:WidgetTagColor[];
 setScreenshotMode:(mode:ScreenshotPluginMode)=>void;
 setScreenshotColor:(color:WidgetTagColor,enabled:boolean)=>void;
}
export interface WidgetPluginControlProps{context?:WidgetPluginContext}
export interface WidgetPluginControlDefinition{
 id:string;
 pluginId:string;
 label:string;
 StatusControl:ComponentType<WidgetPluginControlProps>;
 available:(status:WidgetRelaunchPluginStatus)=>boolean;
}
export interface BuiltInWidgetPluginDefinition{id:string;name:string;description:string;controls:WidgetPluginControlDefinition[]}

const alwaysAvailable=()=>true;
const relaunchAvailable=(status:WidgetRelaunchPluginStatus)=>status==='enabled';
export const widgetPluginCatalog:BuiltInWidgetPluginDefinition[]=[{
 id:'widget-relaunch',name:'Widget Relaunch',description:'Control which workspace widgets start automatically.',controls:[
  {id:'widget-relaunch.global-mode',pluginId:'widget-relaunch',label:'Global relaunch mode',StatusControl:RelaunchGlobalModeControl,available:relaunchAvailable},
  {id:'widget-relaunch.tag-colors',pluginId:'widget-relaunch',label:'Tag color controls',StatusControl:RelaunchTagColorsControl,available:relaunchAvailable},
 ]
},{id:'screenshot',name:'Screenshot',description:'Copy workspace widget screenshots; choose global or tag-color availability in Settings.',controls:[
  {id:'screenshot.settings',pluginId:'screenshot',label:'Screenshot settings',StatusControl:ScreenshotSettingsControl,available:alwaysAvailable},
]}];
export function availableStatusControls(status:WidgetRelaunchPluginStatus):WidgetPluginControlDefinition[]{
 return widgetPluginCatalog.flatMap(plugin=>plugin.controls.filter(control=>control.available(status)));
}
export type WidgetPluginControlId=WidgetPluginControlDefinition['id'];
