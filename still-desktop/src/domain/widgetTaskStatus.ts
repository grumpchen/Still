import type {WidgetInstance} from './workspaces.ts';

export const widgetTaskStatuses=['todo','in-progress','done'] as const;
export type WidgetTaskStatus=typeof widgetTaskStatuses[number];
export type WidgetTaskStatusFilter='all'|'unset'|WidgetTaskStatus;
export type WidgetTaskStatusCounts=Record<WidgetTaskStatus,number>&{unset:number;all:number};

export function checkedWidgetTaskStatus(value:unknown):WidgetTaskStatus|null{
 return widgetTaskStatuses.includes(value as WidgetTaskStatus)?value as WidgetTaskStatus:null;
}

export function widgetTaskStatusCounts(widgets:readonly Pick<WidgetInstance,'taskStatus'>[]):WidgetTaskStatusCounts{
 const counts:WidgetTaskStatusCounts={all:widgets.length,unset:0,todo:0,'in-progress':0,done:0};
 for(const widget of widgets){const status=checkedWidgetTaskStatus(widget.taskStatus);if(status===null)counts.unset++;else counts[status]++}
 return counts;
}

export function matchesWidgetTaskStatus(widget:Pick<WidgetInstance,'taskStatus'>,filter:WidgetTaskStatusFilter):boolean{
 const status=checkedWidgetTaskStatus(widget.taskStatus);
 return filter==='all'||(filter==='unset'?status===null:status===filter);
}
