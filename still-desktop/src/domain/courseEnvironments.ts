import type {ScheduleEntry, WorkspaceState} from './workspaces.ts';

export const COURSE_ENVIRONMENT_EARLY_MINUTES=10;
export const COURSE_ENVIRONMENT_LATE_MINUTES=15;

export interface CourseEnvironmentOccurrence {
  key:string;
  courseId:string;
  courseTitle:string;
  sourceWorkspaceId:string;
  sourceWidgetId:string;
  workspaceId:string;
  workspaceName:string;
  scheduledAt:number;
}

type CourseWorkspace=Pick<WorkspaceState['workspaces'][number],'id'|'name'|'widgets'>;

function localDateKey(date:Date):string{
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

/** Resolve a weekly local wall-clock time using the platform's civil-time rules.
 * Nonexistent spring-forward times are skipped; ambiguous fall-back times resolve
 * to their first occurrence, so the same class never fires twice.
 */
export function resolveLocalClassStart(date:Date,time:string):Date|null{
  const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if(!match)return null;
  const hour=Number(match[1]),minute=Number(match[2]);
  const resolved=new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute,0,0);
  if(resolved.getFullYear()!==date.getFullYear()||resolved.getMonth()!==date.getMonth()||resolved.getDate()!==date.getDate()||resolved.getHours()!==hour||resolved.getMinutes()!==minute)return null;
  return resolved;
}

export function dueCourseEnvironmentOccurrences(
  workspaces:CourseWorkspace[],
  autoOpenCourseEnvironments:boolean,
  now:Date|number=new Date(),
):CourseEnvironmentOccurrence[]{
  if(!autoOpenCourseEnvironments)return [];
  const instant=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(instant.getTime()))return [];
  const weekday=(instant.getDay()+6)%7;
  const dateKey=localDateKey(instant);
  const environmentNames=new Map(workspaces.map(workspace=>[workspace.id,workspace.name]));
  const occurrences:CourseEnvironmentOccurrence[]=[];
  for(const source of workspaces){
    for(const widget of source.widgets){
      if(widget.type!=='timetable')continue;
      for(const entry of widget.schedule){
        if(!entry.workspaceId||entry.autoOpen===false)continue;
        const workspaceName=environmentNames.get(entry.workspaceId);
        if(!workspaceName||entry.day!==weekday)continue;
        const start=resolveLocalClassStart(instant,entry.time);
        if(!start)continue;
        const scheduledAt=start.getTime(),delta=instant.getTime()-scheduledAt;
        if(delta < -COURSE_ENVIRONMENT_EARLY_MINUTES*60_000 || delta > COURSE_ENVIRONMENT_LATE_MINUTES*60_000)continue;
        occurrences.push({
          key:`${source.id}:${widget.id}:${entry.id}:${dateKey}`,
          courseId:entry.id,
          courseTitle:entry.title,
          sourceWorkspaceId:source.id,
          sourceWidgetId:widget.id,
          workspaceId:entry.workspaceId,
          workspaceName,
          scheduledAt,
        });
      }
    }
  }
  return occurrences.sort((a,b)=>a.scheduledAt-b.scheduledAt||a.courseTitle.localeCompare(b.courseTitle)||a.workspaceId.localeCompare(b.workspaceId)||a.key.localeCompare(b.key));
}

export type CourseEnvironmentDecision=
  | {kind:'none'}
  | {kind:'already-there';occurrences:CourseEnvironmentOccurrence[]}
  | {kind:'switch';workspaceId:string;occurrences:CourseEnvironmentOccurrence[]}
  | {kind:'choose';groups:Array<{workspaceId:string;workspaceName:string;occurrences:CourseEnvironmentOccurrence[]}>};

export function decideCourseEnvironmentAction(
  occurrences:CourseEnvironmentOccurrence[],
  activeWorkspaceId:string,
  validWorkspaceIds:ReadonlySet<string>,
):CourseEnvironmentDecision{
  const valid=occurrences.filter(item=>validWorkspaceIds.has(item.workspaceId));
  if(!valid.length)return {kind:'none'};
  const grouped=new Map<string,CourseEnvironmentOccurrence[]>();
  for(const occurrence of valid){const group=grouped.get(occurrence.workspaceId)??[];group.push(occurrence);grouped.set(occurrence.workspaceId,group)}
  const groups=[...grouped].map(([workspaceId,items])=>({workspaceId,workspaceName:items[0].workspaceName,occurrences:items})).sort((a,b)=>a.workspaceName.localeCompare(b.workspaceName)||a.workspaceId.localeCompare(b.workspaceId));
  if(groups.length>1)return {kind:'choose',groups};
  const group=groups[0];
  return group.workspaceId===activeWorkspaceId?{kind:'already-there',occurrences:group.occurrences}:{kind:'switch',workspaceId:group.workspaceId,occurrences:group.occurrences};
}

export function unlinkCourseEnvironments(state:WorkspaceState,removedWorkspaceId:string):WorkspaceState{
  let changed=false;
  const workspaces=state.workspaces.map(workspace=>{
    let changedWorkspace=false;
    const widgets=workspace.widgets.map(widget=>{
      if(widget.type!=='timetable')return widget;
      let changedSchedule=false;
      const schedule=widget.schedule.map((entry:ScheduleEntry)=>{
        if(entry.workspaceId!==removedWorkspaceId)return entry;
        const {workspaceId:_removed,...unlinked}=entry;
        changedSchedule=true;return unlinked;
      });
      if(!changedSchedule)return widget;
      changedWorkspace=true;return {...widget,schedule};
    });
    if(!changedWorkspace)return workspace;
    changed=true;return {...workspace,widgets};
  });
  return changed?{...state,workspaces}:state;
}

export function removeWorkspaceAndUnlinkCourseEnvironments(state:WorkspaceState,removedWorkspaceId:string):WorkspaceState{
  if(!state.workspaces.some(workspace=>workspace.id===removedWorkspaceId))return state;
  const unlinked=unlinkCourseEnvironments(state,removedWorkspaceId);
  const workspaces=unlinked.workspaces.filter(workspace=>workspace.id!==removedWorkspaceId);
  return {...unlinked,workspaces,activeId:state.activeId===removedWorkspaceId?(workspaces[0]?.id??''):state.activeId};
}
