import type {Workspace,WidgetInstance} from './workspaces.ts';
import {widgetCatalog} from './widgetCatalog.ts';

function widgetLabel(widget:WidgetInstance){return widget.title||widgetCatalog[widget.type].name+' '+widget.instanceNumber}

function mentionTerms(workspace:Workspace):Map<string,Set<string>>{
  const terms=new Map<string,Set<string>>();
  for(const widget of workspace.widgets)for(const term of new Set([widgetLabel(widget),widgetCatalog[widget.type].name])){
    const ids=terms.get(term.toLocaleLowerCase())??new Set<string>();ids.add(widget.id);terms.set(term.toLocaleLowerCase(),ids);
  }
  return terms;
}
function mentionPattern(term:string,global=false):RegExp{
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|\\s)@${escaped}(?=$|[\\s.,!?;:)\\]}])`,global?'giu':'iu');
}

/** Treat exact, unambiguous @text references as explicit widget selections. */
export function resolveAssistantWidgetMentions(text:string,workspace:Workspace,selectedWidgetIds:string[]=[]):string[]{
  const selected=new Set(selectedWidgetIds.includes('__all__')?workspace.widgets.map(widget=>widget.id):selectedWidgetIds.filter(id=>workspace.widgets.some(widget=>widget.id===id)));
  for(const [term,ids] of mentionTerms(workspace))if(ids.size===1&&mentionPattern(term).test(text))selected.add([...ids][0]);
  return [...selected];
}
export function removeAssistantWidgetMention(text:string,workspace:Workspace,widgetId:string):string{
  if(widgetId==='__all__')return text.replace(mentionPattern('All widgets',true),'$1').replace(/[ \t]{2,}/g,' ').trim();
  let result=text;
  for(const [term,ids] of mentionTerms(workspace))if(ids.size===1&&ids.has(widgetId))result=result.replace(mentionPattern(term,true),'$1');
  return result.replace(/[ \t]{2,}/g,' ').trim();
}
