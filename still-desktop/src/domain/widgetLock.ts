import type {WidgetInstance} from './workspaces.ts';

export function canMoveWidget(widget:Pick<WidgetInstance,'lockPluginEnabled'|'locked'>):boolean{
 return !widget.lockPluginEnabled||!widget.locked;
}

export function canCloseWidget(widget:Pick<WidgetInstance,'lockPluginEnabled'|'locked'>):boolean{
 return !widget.lockPluginEnabled||!widget.locked;
}

export function setWidgetLock(widget:WidgetInstance,enabled:boolean):WidgetInstance{
 return{...widget,lockPluginEnabled:enabled,locked:enabled};
}
