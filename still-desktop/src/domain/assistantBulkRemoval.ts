import type {WidgetInstance} from './workspaces.ts';

export function assistantBulkRemovalSelection(widgets:WidgetInstance[],preserveWidgetId?:string){
  const preserved=widgets.filter(widget=>widget.lockPluginEnabled&&widget.locked||widget.id===preserveWidgetId);
  const preservedIds=new Set(preserved.map(widget=>widget.id));
  return{preserved,removed:widgets.filter(widget=>!preservedIds.has(widget.id))};
}
