export type WidgetRelaunchMode='automatic'|'manual';
export type WidgetRelaunchOverride='follow'|WidgetRelaunchMode;
export type WidgetRelaunchPluginStatus='enabled'|'disabled'|'removed';

export interface RelaunchPolicyInput{
 pluginStatus:WidgetRelaunchPluginStatus;
 globalMode:WidgetRelaunchMode;
 widgetOverride?:WidgetRelaunchOverride;
 tagColor?:string|null;
 colorMode?:WidgetRelaunchMode|null;
}

export interface StartupWidgetLike{id:string;relaunchOverride?:WidgetRelaunchOverride;tagColor?:string|null}

export function startupDeferredWidgetIds(workspaces:Array<{widgets:StartupWidgetLike[]}>,pluginStatus:WidgetRelaunchPluginStatus,globalMode:WidgetRelaunchMode,colors:Record<string,WidgetRelaunchMode>):Set<string>{
 const deferred=new Set<string>();
 for(const workspace of workspaces)for(const widget of workspace.widgets){
  if(resolveWidgetRelaunch({pluginStatus,globalMode,widgetOverride:widget.relaunchOverride,tagColor:widget.tagColor,colorMode:widget.tagColor?colors[widget.tagColor]:undefined})==='manual')deferred.add(widget.id);
 }
 return deferred;
}

export function resolveWidgetRelaunch(input:RelaunchPolicyInput):WidgetRelaunchMode{
 if(input.pluginStatus!=='enabled')return'manual';
 if(input.widgetOverride==='automatic'||input.widgetOverride==='manual')return input.widgetOverride;
 if(input.tagColor&&(input.colorMode==='automatic'||input.colorMode==='manual'))return input.colorMode;
 return input.globalMode;
}

export function applyRelaunchModeToAll<T extends {widgetRelaunchMode:WidgetRelaunchMode;widgetRelaunchColors:Record<string,WidgetRelaunchMode>;workspaces:Array<{widgets:Array<{relaunchOverride:WidgetRelaunchOverride}>}>}>(state:T,mode:WidgetRelaunchMode):T{
 return{...state,widgetRelaunchMode:mode,widgetRelaunchColors:{},workspaces:state.workspaces.map(workspace=>({...workspace,widgets:workspace.widgets.map(widget=>({...widget,relaunchOverride:'follow'}))}))};
}
