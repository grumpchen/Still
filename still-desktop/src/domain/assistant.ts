import {createWidget,minimizeWidgetInstance,nextInstanceNumber,restoreWidgetInstance,type WidgetInstance,type Workspace,type ScheduleEntry} from './workspaces.ts';
import {widgetCatalog,widgetTypes,type WidgetType} from './widgetCatalog.ts';
import type {WidgetPreset} from './presets.ts';
import type {SavedGroup} from './workspaces.ts';
import {constrainPlacement,nextPlacement,type Placement} from './layout.ts';
import {widgetTagColors} from './widgetTags.ts';

export type AssistantProvider = 'gemini' | 'openai' | 'opencode';
export type ChatMessage = {role:'user'|'model'; text:string};
export function resolveAcceptedNotesOffer(prompt:string,messages:ChatMessage[]):{action:AssistantAction;intent:string}|null{
  if(!/^(?:yes|yeah|yep|sure|ok|okay|please|do it|go ahead|yes please)[.!?]*$/i.test(prompt.trim()))return null;
  const previousAssistant=messages.at(-1);
  if(previousAssistant?.role!=='model'||!/would you like me to add a new Notes widget with that text instead\?\s*$/i.test(previousAssistant.text.trim()))return null;
  const previousUser=[...messages.slice(0,-1)].reverse().find(message=>message.role==='user')?.text.trim();
  if(!previousUser||previousUser.length>12000)return null;
  return{action:{type:'add_widget',ids:['notes'],text:previousUser},intent:'Add a Notes widget with the previous message text.'};
}
export type LayoutItem = Placement & {id:string};
export const ASSISTANT_ACTION_TYPES=['minimize','restore','save_to_tray','set_timer','add_widget','open_saved','remove_widget','edit_widget','set_widget_plugin','set_sidebar_plugin','rename_workspace'] as const;
export type AssistantActionType = typeof ASSISTANT_ACTION_TYPES[number];
export type AssistantAction = {type:AssistantActionType;ids:string[];seconds?:number;title?:string;text?:string;schedule?:ScheduleEntry[];tagColor?:string;pluginControls?:string[];plugin?:string;enabled?:boolean};
export type AssistantTrayItem={id:string;name:string;type:WidgetType;kind:'preset'|'group'};
export type AssistantResponseIntent='chat'|'clarification'|'workspace_action'|'layout';
export const MAX_ASSISTANT_BATCH=10;
export const MAX_ASSISTANT_WIDGETS=100;
export function resolveNamedNotesCreation(prompt:string):{title:string;topic:string}|null{
  const details=prompt.trim().match(/^(?:(?:please|can|could|would|will)\s+)*(?:you\s+)?(?:make|create|add)\s+(?:a\s+)?(?:new\s+)?notes?\s+(?:widget\s+)?(?:named|called|titled)\s+["'“]?([^,"'”\n]+?)\s*["'”]?(?:\s*,?\s*(?:and\s+)?(?:write|put|add|include)\s+(?:some\s+)?notes?\s+(?:about|on|for|covering)\s+([\s\S]+?))?[.!?]*$/i);
  if(!details)return null;
  const title=details[1].trim(),topic=details[2]?.trim().replace(/[.!?]+$/,'').trim()??'';
  if(!title||title.length>60||topic.length>12000)return null;
  return {title,topic};
}
export type AssistantReply = {intent?:AssistantResponseIntent;reply:string; layout:LayoutItem[]; actions:AssistantAction[]};
export type LayoutPlan = {workspaceId:string; fingerprint:string; width:number; height:number; items:LayoutItem[]};
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_MODELS:Record<AssistantProvider,string> = {gemini:DEFAULT_MODEL,openai:'gpt-4o-mini',opencode:'mimo-v2.6-flash'};
export const HISTORY_LIMIT = 12;
export function preferredModel(models:string[],provider:AssistantProvider='gemini'):string {
  const preferred=DEFAULT_MODELS[provider];
  return models.includes(preferred)?preferred:models[0]??preferred;
}
export function assistantKeyError(reason:unknown):string {
  const detail=reason instanceof Error?reason.message:typeof reason==='string'?reason:'';
  return detail.trim()||'Could not verify the API key.';
}
/** Resolve an in-chat confirmation in place so the provider history remains user/model alternating. */
export function settleAssistantConfirmation(messages:ChatMessage[],text:string):ChatMessage[]{
  const last=messages.length-1;
  if(last<0||messages[last].role!=='model')return [...messages,{role:'model',text}];
  const next=[...messages];next[last]={...next[last],text};return next;
}
/** Repair empty legacy assistant turns before they reach providers, and cap prompt history. */
export function prepareAssistantHistory(messages:ChatMessage[]):ChatMessage[]{
  return messages.slice(-HISTORY_LIMIT).map(message=>({
    ...message,
    text:message.text.trim()?message.text.slice(0,message.role==='model'?6000:8000):message.role==='model'?'No response was recorded for the previous message.':'No message text was recorded.',
  }));
}
/** Give locally applied add-widget actions a user-visible receipt. */
export function assistantAddedWidgetReceipt(actions:AssistantAction[]):string{
  const added=actions.filter(action=>action.type==='add_widget').flatMap(action=>action.ids);
  if(!added.length)return '';
  const counts=new Map<string,number>();for(const id of added)counts.set(id,(counts.get(id)??0)+1);
  const labels=[...counts].map(([id,count])=>{
    const name=widgetCatalog[id as WidgetType]?.name??'widget';
    return count===1?`a ${name} widget`:`${count} ${name} widgets`;
  });
  const description=labels.length===1?labels[0]:`${labels.slice(0,-1).join(', ')} and ${labels.at(-1)}`;
  return `Added ${description}.`;
}
export function safeAssistantReceipt(text:string):string{
  return text.trim()?text:'Still could not confirm whether that action completed. Check the workspace before trying again.';
}
export function assistantActionsDescription(actions:AssistantAction[],workspace:Workspace,tray:AssistantTrayItem[]):string{
  const labels:Record<AssistantActionType,string>={add_widget:'Create',open_saved:'Open saved',remove_widget:'Remove',minimize:'Minimize',restore:'Restore',save_to_tray:'Save to tray',set_timer:'Start timer on',edit_widget:'Edit',set_widget_plugin:'Change plugin on',set_sidebar_plugin:'Change sidebar plugin',rename_workspace:'Rename workspace'};
  return actions.map(action=>{
    const names=action.ids.map(id=>action.type==='add_widget'?widgetCatalog[id as WidgetType]?.name:action.type==='open_saved'?tray.find(item=>item.id===id)?.name:action.type==='rename_workspace'?workspace.name:action.type==='set_sidebar_plugin'?id:workspace.widgets.find(item=>item.id===id)).map(value=>typeof value==='string'?value:value?widgetLabel(value):'widget');
    return `${labels[action.type]} ${names.join(', ')}${action.title?` named “${action.title}”`:''}${action.text!==undefined?' with initial note text':''}${action.seconds!==undefined?` for ${action.seconds} seconds`:''}${action.enabled===false?' off':''}`;
  }).join('; ');
}

export function widgetLabel(widget:WidgetInstance):string {
  return widget.title || widgetCatalog[widget.type].name+' '+widget.instanceNumber;
}
// No resource grants, local paths, bookmarks, or content from other widgets.
export function widgetContext(widget:WidgetInstance):Record<string,unknown> {
  const result:Record<string,unknown> = {type:widget.type, title:widgetLabel(widget),tagColor:widget.tagColor??null};
  if(widget.type==='notes'||widget.type==='ai')result.text=widget.text.slice(0,12000);
  if(widget.type==='timetable')result.schedule=widget.schedule.slice(0,80);
  if(widget.type==='focus')result.remainingSeconds=widget.end?Math.max(0,Math.ceil((widget.end-Date.now())/1000)):widget.remaining;
  if(widget.clockPluginEnabled)result.clockTimerEnabled=true;
  if(widget.type==='apps'||widget.type==='desmos'||widget.type==='files')result.reading='Without a screenshot, only metadata is available. When a visible screenshot is included, describe only content that is legible in that image; otherwise do not infer unseen window or file contents.';
  return result;
}
export function layoutFingerprint(workspace:Workspace):string {
  return JSON.stringify(workspace.widgets.map(w=>[w.id,w.type,w.minimized,w.placement,w.appPanelOpen,w.appMinWidth,w.appMinHeight,w.lockPluginEnabled,w.locked]));
}
export function layoutContext(workspace:Workspace,width:number,height:number) {
  return {canvas:{width,height,padding:20},widgets:workspace.widgets.map(w=>({
    id:w.id,title:widgetLabel(w),type:w.type,tagColor:w.tagColor??null,placement:w.placement,minimized:w.minimized,
    minimumWidth:Math.max(widgetCatalog[w.type].minWidth,w.appPanelOpen?w.appMinWidth??0:0),
    minimumHeight:Math.max(widgetCatalog[w.type].minHeight,w.appPanelOpen?w.appMinHeight??0:0),
  }))};
}
/** Workspace widget data is available to answer and edit requests; @ marks widgets the user wants to point out. */
export function assistantWorkspaceContext(workspace:Workspace,width:number,height:number,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[],installedSidebarPlugins:string[]=[]):Record<string,unknown> {
  const unique=[...new Set(selectedWidgetIds)];
  const selected=new Set(unique);
  const widgetData:Record<string,unknown>[]=workspace.widgets.map(widget=>({id:widget.id,...widgetContext(widget),quickSelected:selected.has(widget.id)}));
  const context:Record<string,unknown>={canvasAndWidgets:layoutContext(workspace,width,height),widgetData,savedTrayItems:savedTrayItems.map(({id,name,type,kind})=>({id,name,type,kind})),installedSidebarPlugins,capabilities:{actions:[...ASSISTANT_ACTION_TYPES],creatableWidgets:widgetTypes.map(id=>({id,name:widgetCatalog[id].name})),editableFields:{allWidgets:['title','tagColor'],notes:['text'],timetable:['schedule'],tagStatus:['pluginControls'],focusAndClock:['timer'],limits:{titleMaxLength:60,notesTextMaxLength:12000,scheduleEntriesMax:80,groupControlsMax:20}},plugins:{widget:['clock-timer'],sidebar:['stack','layout'],tagStatus:['widget-relaunch.global-mode','widget-relaunch.tag-colors','screenshot.settings','clock-timer.settings']},contentEditingRequiresWidgetSelection:false,externalContentEditing:['apps','files','calculator'],maxBatchItems:MAX_ASSISTANT_BATCH,maxAddOrOpenItems:MAX_ASSISTANT_BATCH,maxWorkspaceWidgets:MAX_ASSISTANT_WIDGETS,confirmationRequired:['remove_widget','open_saved_apps','delete_workspace','unclear_action_intent']}};
  const lowerPriority=[...widgetData.filter(item=>!item.quickSelected).reverse(),...widgetData.filter(item=>item.quickSelected).reverse()];
  for(const item of lowerPriority){
    if(JSON.stringify(context).length<=60000)break;
    const omitted=['text','schedule'].filter(field=>field in item);
    for(const field of omitted)delete item[field];
    if(omitted.length)item.contentOmitted=true;
  }
  return context;
}
export function assistantTrayItems(presets:WidgetPreset[],groups:SavedGroup[]):AssistantTrayItem[]{
  return [
    ...presets.map(item=>({id:`preset-${item.id}`,name:item.name,type:item.type,kind:'preset' as const})),
    ...groups.map(item=>({id:`group-${item.id}`,name:item.name||'Group',type:'group' as const,kind:'group' as const})),
  ];
}
export function assistantRequestLimitError(text:string,savedTrayItems:AssistantTrayItem[]=[]):string|null{
  const types=assistantActionRequest(text,savedTrayItems),amount=assistantRequestedItemCount(text);
  if((types.includes('add_widget')||types.includes('open_saved'))&&amount===0)return `Choose between 1 and ${MAX_ASSISTANT_BATCH} widgets. Nothing was changed.`;
  if(types.includes('add_widget')&&amount!==null&&amount>MAX_ASSISTANT_BATCH)return `Still AI can add at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`;
  if(types.includes('open_saved')&&amount!==null&&amount>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Nothing was changed.`;
  if(types.includes('open_saved')&&/\b(?:all|every|each)\b/i.test(text)&&savedTrayItems.length>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Open a smaller group at a time.`;
  return null;
}
function assistantRequestedItemCount(text:string):number|null{
  const amount=text.match(/(?<![-.\d])\b(\d+)\s+(?:saved\s+)?(?:[a-z-]+\s+)?(?:widgets?|cards?)\b/i)??text.match(/(?<![-.\d])\b(\d+)\s+(?:notes?|focus|calculators?|files?|apps?|timetables?|groups?)\b/i);
  return amount?Number(amount[1]):null;
}
export function parseAssistantReply(value:unknown):AssistantReply {
  if(!value||typeof value!=='object')throw new Error('The AI returned an invalid response. Try again.');
  const {reply,intent}=value as Partial<AssistantReply>;
  if(typeof reply!=='string'||reply.length>24000)throw new Error('The AI returned an incomplete response. Try again.');
  if(intent!==undefined&&!['chat','clarification','workspace_action','layout'].includes(intent))throw new Error('The AI returned an invalid response intent. Try again.');
  const {layout}=value as Partial<AssistantReply>,rawActions=(value as Partial<AssistantReply>).actions??[];
  if(!Array.isArray(layout)||layout.length>100||!Array.isArray(rawActions)||rawActions.length>100)throw new Error('The AI returned an incomplete response. Try again.');
  const items=layout.map(item=>{
    if(!item||typeof item.id!=='string'||item.id.length>80||[item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n)))throw new Error('The AI returned an invalid layout. Try again.');
    return {id:item.id,x:item.x,y:item.y,width:item.width,height:item.height};
  });
  const actions:AssistantAction[]=rawActions.map(action=>{
    const newWidgets=action?.type==='add_widget',openSaved=action?.type==='open_saved';
    if(!action||!ASSISTANT_ACTION_TYPES.includes(action.type)||!Array.isArray(action.ids)||!action.ids.length||action.ids.length>(newWidgets||openSaved||action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin'?MAX_ASSISTANT_BATCH:100)||action.ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id))||(!newWidgets&&new Set(action.ids).size!==action.ids.length)||(newWidgets&&action.ids.some(id=>!widgetTypes.includes(id as WidgetType)))||(openSaved&&action.ids.some(id=>!id.startsWith('preset-')&&!id.startsWith('group-')))||(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))||(action.type!=='set_timer'&&action.seconds!==undefined))throw new Error('The AI returned an invalid workspace action. Nothing was changed. Try again.');
    validateAssistantActionFields(action);
    return {type:action.type,ids:[...action.ids],...(action.type==='set_timer'?{seconds:action.seconds}:{}),...(action.title!==undefined?{title:action.title.trim()}:{}),...(action.text!==undefined?{text:action.text}:{}),...(action.schedule!==undefined?{schedule:action.schedule.map(entry=>({...entry,title:entry.title.trim(),location:entry.location.trim()}))}:{}),...(action.tagColor!==undefined?{tagColor:action.tagColor}:{}),...(action.pluginControls!==undefined?{pluginControls:[...action.pluginControls]}:{}),...(action.plugin!==undefined?{plugin:action.plugin}:{}),...(action.enabled!==undefined?{enabled:action.enabled}:{})};
  });
  if(actions.filter(action=>action.type==='add_widget'||action.type==='open_saved').reduce((total,action)=>total+action.ids.length,0)>MAX_ASSISTANT_BATCH)throw new Error('The AI returned too many widget actions. Nothing was changed. Try a smaller request.');
  if(actions.filter(action=>action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin').reduce((total,action)=>total+action.ids.length,0)>MAX_ASSISTANT_BATCH)throw new Error('The AI returned too many workspace changes. Nothing was changed. Try a smaller request.');
  if(!intent&&items.length&&actions.length)throw new Error('The AI mixed a layout proposal with workspace actions. Nothing was changed. Try again.');
  const safeLayout=intent==='chat'||intent==='clarification'||intent==='workspace_action'?[]:items;
  const safeActions=intent==='chat'||intent==='clarification'||intent==='layout'?[]:actions;
  if(!reply.trim()&&!safeActions.length&&!safeLayout.length)throw new Error('The AI returned no reply. Try again.');
  const normalizedReply=reply.trim()?reply:safeActions.length?'Workspace actions requested.':'Workspace layout proposal.';
  return {...(intent?{intent}:{}),reply:normalizedReply,layout:safeLayout,actions:safeActions};
}
function validateAssistantActionFields(action:AssistantAction):void{
  if(action.title!==undefined&&(action.type!=='add_widget'&&action.type!=='edit_widget'&&action.type!=='rename_workspace'||typeof action.title!=='string'||!action.title.trim()||action.title.length>60))throw new Error('Invalid names: use between 1 and 60 characters. Nothing was changed.');
  if(action.text!==undefined&&(action.type!=='add_widget'&&action.type!=='edit_widget'||typeof action.text!=='string'||action.text.length>12000||action.type==='add_widget'&&action.ids.some(id=>id!=='notes')))throw new Error('Text changes are supported only for Notes widgets, up to 12,000 characters. Nothing was changed.');
  if(action.schedule!==undefined&&(action.type!=='edit_widget'||!Array.isArray(action.schedule)||action.schedule.length>80||action.schedule.some(entry=>!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(entry.id)||!Number.isInteger(entry.day)||entry.day<0||entry.day>6||typeof entry.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>80||typeof entry.location!=='string'||entry.location.length>100)||new Set(action.schedule.map(entry=>entry.id)).size!==action.schedule.length))throw new Error('Timetable edits need up to 80 valid entries with a day, time, class name, and location. Nothing was changed.');
  if(action.tagColor!==undefined&&(action.type!=='edit_widget'||action.tagColor!=='none'&&!widgetTagColors.includes(action.tagColor as typeof widgetTagColors[number])))throw new Error('Choose a valid widget tag color. Nothing was changed.');
  if(action.pluginControls!==undefined&&(action.type!=='edit_widget'||!Array.isArray(action.pluginControls)||action.pluginControls.length>20||action.pluginControls.some(id=>!['widget-relaunch.global-mode','widget-relaunch.tag-colors','screenshot.settings','clock-timer.settings'].includes(id))))throw new Error('Tag Color Status can use only supported widget plugin controls. Nothing was changed.');
  if(action.type==='edit_widget'&&action.title===undefined&&action.text===undefined&&action.schedule===undefined&&action.tagColor===undefined&&action.pluginControls===undefined)throw new Error('Choose a widget field to edit. Nothing was changed.');
  if(action.type==='set_widget_plugin'&&(!['clock-timer'].includes(action.plugin??'')||typeof action.enabled!=='boolean'))throw new Error('Choose a supported widget plugin and turn it on or off. Nothing was changed.');
  if(action.type==='set_sidebar_plugin'&&(action.ids.some(id=>!['stack','layout'].includes(id))||typeof action.enabled!=='boolean'||action.plugin!==undefined))throw new Error('Choose Stack or Layout and turn it on or off. Nothing was changed.');
  if(action.type!=='set_widget_plugin'&&action.type!=='set_sidebar_plugin'&&(action.plugin!==undefined||action.enabled!==undefined))throw new Error('Plugin settings are supported only for plugin actions. Nothing was changed.');
  if(action.type==='rename_workspace'&&(action.ids.length!==1||action.title===undefined))throw new Error('Choose one workspace name to save. Nothing was changed.');
  if(action.type!=='add_widget'&&action.type!=='edit_widget'&&action.type!=='rename_workspace'&&(action.title!==undefined||action.text!==undefined||action.schedule!==undefined||action.tagColor!==undefined||action.pluginControls!==undefined))throw new Error('These fields are supported only for widget editing. Nothing was changed.');
}
function isQuestionOrExplanation(text:string):boolean{
  const prompt=text.trim();
  return !prompt||/\b(?:don't|do not|never)\s+(?:add|make|create|build|insert|spawn|open|remove|delete|close)\b/i.test(prompt)||/^(?:what|why|how|where|when|which)\b/i.test(prompt)||/^(?:please\s+)?(?:write|draft|summari[sz]e|translate|research|compare|discuss|explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt)||/^(?:can|could|would) you (?:write|draft|summari[sz]e|translate|research|compare|discuss|explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt)||/^(?:can|could|would) you (?:edit|modify|change|update|rename)\s+(?:(?:the|this|that)\s+)?(?:widget|card|notes?|timetable|schedule|workspace|it|this|that)[?.!]*$/i.test(prompt)||/^(?:can|could|would) you make (?:an?\s+)?(?:edit|change|modification)s?\b/i.test(prompt)||/^(?:(?:can|could|would) you\s+)?make edits? to (?:the\s+)?(?:timetable|schedule|notes?|widget|workspace)\b/i.test(prompt);
}
export function extractAssistantTimerSeconds(text:string):number|null{
  const match=text.match(/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i);
  if(!match)return null;
  const unit=match[2].toLowerCase(),multiplier=/^(?:s|sec|secs|second|seconds)$/.test(unit)?1:/^(?:m|min|mins|minute|minutes)$/.test(unit)?60:3600;
  const seconds=Number(match[1])*multiplier;
  return Number.isSafeInteger(seconds)&&seconds>=1&&seconds<=31536000?seconds:null;
}
export function assistantActionRequest(text:string,savedTrayItems:AssistantTrayItem[]=[]):AssistantActionType[]{
  const prompt=text.trim();
  if(isQuestionOrExplanation(prompt))return [];
  const requested:AssistantActionType[]=[];
  if(/\brename\b[\s\S]{0,30}\bworkspace\b[\s\S]{0,20}\b(?:to|as)\s+.+/i.test(prompt))requested.push('rename_workspace');
  if(/\b(?:add|enable|turn on|remove|disable|turn off|install)\b[\s\S]{0,40}\b(?:sidebar\s+)?(?:stack|layout)\s+plugin\b/i.test(prompt)||/\b(?:add|enable|turn on|remove|disable|turn off)\b[\s\S]{0,30}\b(?:stack|layout)\b[\s\S]{0,25}\b(?:to|in)\s+(?:the\s+)?sidebar\b/i.test(prompt)||/^\s*(?:please\s+)?(?:add|enable|turn on|remove|disable|turn off|install)\s+(?:the\s+)?(?:stack|layout)(?:\s+plugin)?[.!]?\s*$/i.test(prompt))requested.push('set_sidebar_plugin');
  if(/\b(?:add|enable|turn on|remove|disable|turn off)\b[\s\S]{0,60}\b(?:clock timer|clock|timer) plugin\b/i.test(prompt)||/\b(?:add|enable|turn on|remove|disable|turn off)\b[\s\S]{0,40}\bclock\b[\s\S]{0,30}\b(?:to|on|from)\b/i.test(prompt))requested.push('set_widget_plugin');
  if(!requested.includes('set_widget_plugin')&&!requested.includes('rename_workspace')&&/\b(?:edit|modify|rewrite|rename|change|update)\b[\s\S]{0,80}\b(?:widget|widgets|card|cards|notes?|focus|timer|calculator|apps?|files?|timetable|schedule|assistant|group|tag color|tag status)\b/i.test(prompt))requested.push('edit_widget');
  if(/\bminimi[sz](?:e|ing)?\b/i.test(prompt))requested.push('minimize');
  if(/\brestore\b/i.test(prompt))requested.push('restore');
  const opensSaved=(/\b(?:open|add|load|bring|reopen)\b[\s\S]{0,100}\b(?:saved|tray|shortcut|widgets?)\b[\s\S]{0,80}\b(?:widgets?|shortcut|group|tray)?\b/i.test(prompt)&&/\b(?:saved|tray|shortcut)\b/i.test(prompt))||savedTrayItems.some(item=>/^\s*(?:please\s+)?(?:open|load|reopen|bring)\b/i.test(prompt)&&prompt.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()));
  if(opensSaved)requested.push('open_saved');
  else if(/\b(?:save|put|move|send|store|copy|add|collect)\b[\s\S]{0,120}\btray\b/i.test(prompt))requested.push('save_to_tray');
  const namedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type));
  const clearCreation=/^(?:(?:please|can(?:\s+you)?|could(?:\s+you)?|would(?:\s+you)?|will(?:\s+you)?|I want you to|I'd like you to)\s+)*(?:add|create|make|build|insert|spawn|new|open)\b/i.test(prompt)&&!/\bmake\b[\s\S]*\b(?:smaller|larger|bigger|wider|narrower|shorter|taller|minimi[sz]ed|fullscreen)\b/i.test(prompt);
  if(!opensSaved&&!requested.includes('set_widget_plugin')&&!requested.includes('set_sidebar_plugin')&&!requested.includes('rename_workspace')&&clearCreation&&(namedTypes.length||/\b(?:add|create|insert|spawn)\b[\s\S]*\b(?:widgets?|cards?)\b/i.test(prompt)||/\b(?:a|an|one|\d+)\s+(?:new\s+)?(?:widgets?|cards?)\b/i.test(prompt)))requested.push('add_widget');
  if(!requested.includes('set_widget_plugin')&&!unsupportedAssistantRequest(prompt)&&/\b(?:remove|delete|close)\b[\s\S]{0,60}\b(?:widgets?|cards?|notes?|focus|timer|calculator|apps?|files?|timetable|assistant|group)\b/i.test(prompt))requested.push('remove_widget');
  if(/\b(?:set|start|begin)\b[\s\S]{0,40}\btimer\b/i.test(prompt)&&extractAssistantTimerSeconds(prompt)!==null)requested.push('set_timer');
  return [...new Set(requested)];
}
export function assistantEditClarification(text:string):string|null{
  const prompt=text.trim();
  const change=prompt.match(/\b(edit|modify|rewrite|change|update|adjust|revise|fix|make)\b/i);
  if(!change||/^\s*(?:how|why|what does|explain)\b/i.test(prompt))return null;
  const vague=/\b(?:better|nicer|more organized|more readable|more useful|properly|somehow)\b/i.test(prompt);
  const changeDetails=/\b(?:to|as|with|about|into|from|by|on|at|for)\s+(?!the\b|my\b|me\b|it\b|this\b|that\b|be\b)[\w'“]/i.test(prompt.slice(change.index!+change[0].length));
  const concreteOperation=/\b(?:add|remove|delete|replace|append|include|move|reschedule|set|clear|write)\b.{2,}/i.test(prompt.slice(change.index!+change[0].length));
  const likelyCreation=assistantActionRequest(prompt).includes('add_widget')&&!vague;
  if((changeDetails||concreteOperation)&&!vague||likelyCreation)return null;
  const target=widgetTypes.find(type=>widgetNameMentioned(prompt,type));
  if(target==='timetable')return 'Sure—what should I change in the timetable? Tell me which class or event and the new details.';
  if(target==='notes')return 'Sure—what should I change in the note: its title, formatting, or text?';
  if(target==='tagStatus')return 'Sure—which Tag Color Status setting should I change, and what should its new value be?';
  return 'Sure—what exact change should I make, and in which widget?';
}
export function assistantReplyNeedsClarification(reply:string):boolean{
  return reply.includes('?')&&/\b(?:what|which|where|when|who|how|do you mean|could you clarify|please specify|would you like me to|should I)\b/i.test(reply);
}
function widgetNameMentioned(text:string,type:WidgetType):boolean{
  const aliases:Partial<Record<WidgetType,string[]>>={notes:['note','notes'],focus:['focus','timer'],desmos:['calculator','calculators'],files:['file','files'],apps:['app','apps'],group:['group','groups'],timetable:['timetable','schedule'],ai:['assistant','ai'],tagStatus:['tag color status','tag status']};
  const names=[type,widgetCatalog[type].name,...(aliases[type]??[])];
  return names.some(name=>new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(text));
}
export function assistantLayoutRequested(text:string):boolean{
  if(isQuestionOrExplanation(text)||unsupportedAssistantRequest(text)||assistantActionRequest(text).length)return false;
  return /\b(?:arrange|layout|rearrange|organize|organise|snap|tile|reposition)\b/i.test(text)||/\b(?:move|place|position)\b[\s\S]{0,100}\b(?:widget|widgets|card|cards|next to|above|below|left of|right of)\b/i.test(text);
}
export function unsupportedAssistantRequest(text:string):'clear_tray'|'delete_widgets'|'delete_workspace'|null{
  if(isQuestionOrExplanation(text))return null;
  if(/\b(?:delete|remove|clear|empty|erase|purge)\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b[\s\S]{0,100}\b(?:widget\s+)?tray\b/i.test(text)||/\b(?:delete|remove|clear|empty|erase|purge)\b[\s\S]{0,100}\b(?:widget\s+)?tray\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b/i.test(text))return 'clear_tray';
  const namesSpecificWidget=widgetTypes.some(type=>widgetNameMentioned(text,type));
  if((/\b(?:delete|remove|clear|erase)\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b[\s\S]{0,100}\bwidgets?\b(?:[\s\S]{0,60}\b(?:on|in|from)\s+(?:the\s+)?(?:current\s+)?(?:workspace|canvas))?/i.test(text)&&!namesSpecificWidget)||(/\b(?:delete|remove|clear|erase)\b[\s\S]{0,100}\bwidgets?\b[\s\S]{0,60}\b(?:on|in|from)\s+(?:the\s+)?(?:current\s+)?(?:workspace|canvas)\b/i.test(text)&&!namesSpecificWidget))return 'delete_widgets';
  if(/\b(?:delete|remove)\b[\s\S]{0,40}\b(?:this|current|active|the)?\s*workspace\b/i.test(text))return 'delete_workspace';
  return null;
}
/** Resolve unambiguous local commands without asking the language model to reconstruct workspace IDs. */
export function resolveDirectAssistantActions(text:string,workspace:Workspace,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[]):AssistantAction[]|null{
  const types=assistantActionRequest(text,savedTrayItems);
  if(!types.length)return null;
  const all=/\b(?:all|every|each)\b/i.test(text);
  const amount=assistantRequestedItemCount(text);
  if(assistantRequestLimitError(text,savedTrayItems))return null;
  if(types.includes('open_saved')){
    const matched=all?savedTrayItems:savedTrayItems.filter(item=>text.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()));
    if(!matched.length)return null;
    if(matched.length>MAX_ASSISTANT_BATCH)return null;
    return [{type:'open_saved',ids:matched.map(item=>item.id)}];
  }
  if(types.includes('rename_workspace')){
    const name=text.match(/\brename\b[\s\S]{0,30}\bworkspace\b[\s\S]{0,20}\b(?:to|as)\s+["'“”]?(.+?)["'“”]?[.!?]*$/i)?.[1]?.trim();
    if(!name||name.length>60)return null;
    return [{type:'rename_workspace',ids:[workspace.id],title:name}];
  }
  if(types.includes('set_sidebar_plugin')){
    const plugins=(['stack','layout'] as const).filter(plugin=>new RegExp(`\\b${plugin}\\b`,'i').test(text));
    if(!plugins.length)return null;
    const enabled=!/\b(?:remove|disable|turn off)\b/i.test(text);
    return [{type:'set_sidebar_plugin',ids:[...plugins],enabled}];
  }
  if(types.includes('set_widget_plugin')){
    const allWidgets=/\b(?:all|every|each)\b/i.test(text),namedTypes=widgetTypes.filter(type=>widgetNameMentioned(text,type));
    const named=workspace.widgets.filter(widget=>namedTypes.includes(widget.type)||text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
    const eligible=(widgets:WidgetInstance[])=>widgets.filter(widget=>widget.type!=='group');
    const targets=eligible(allWidgets?workspace.widgets:selectedWidgetIds.length?workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id)):named);
    if(!targets.length||targets.length>MAX_ASSISTANT_BATCH)return null;
    const enabled=/\b(?:add|enable|turn on)\b/i.test(text);
    return [{type:'set_widget_plugin',ids:targets.map(widget=>widget.id),plugin:'clock-timer',enabled}];
  }
  if(types.includes('add_widget')){
    const matched=widgetTypes.filter(type=>widgetNameMentioned(text,type));
    if(types.length>1)return null;
    if(matched.length===1&&matched[0]==='notes'){
      const details=resolveNamedNotesCreation(text);
      if(details){
        return [{type:'add_widget',ids:['notes'],title:details.title,...(details.topic?{text:details.topic}:{})}];
      }
    }
    if(/\b(?:called|named|titled|containing|with|about|saying)\b/i.test(text))return null;
    if(matched.length){if(matched.length>MAX_ASSISTANT_BATCH)return null;const count=amount??1;if(count>1&&matched.length===1)return [{type:'add_widget',ids:Array(count).fill(matched[0])}];if(count>1&&matched.length>1)return null;return [{type:'add_widget',ids:matched}];}
  }
  if(types.includes('remove_widget')){
    const matchedTypes=widgetTypes.filter(type=>widgetNameMentioned(text,type));
    const named=workspace.widgets.filter(widget=>matchedTypes.includes(widget.type)||text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
    const candidates=selectedWidgetIds.length?workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id)):named;
    if(!candidates.length||(!all&&candidates.length!==1))return null;
    return [{type:'remove_widget',ids:candidates.map(widget=>widget.id)}];
  }
  if(types.includes('edit_widget'))return null;
  if(!all&&!selectedWidgetIds.length&&!types.every(type=>type==='set_timer'))return null;
  const selected=new Set(selectedWidgetIds);
  const timerWidgets=workspace.widgets.filter(widget=>widget.type==='focus'||widget.clockPluginEnabled);
  const targets=workspace.widgets.filter(widget=>all||selected.has(widget.id));
  const seconds=extractAssistantTimerSeconds(text);
  const actions=types.map(type=>{
    if(type==='add_widget'||type==='open_saved')return {type,ids:[]};
    const eligible=type==='save_to_tray'?targets.filter(widget=>widget.type!=='group'):type==='set_timer'?(selectedWidgetIds.length===1?timerWidgets.filter(widget=>selected.has(widget.id)):!selectedWidgetIds.length&&timerWidgets.length===1?timerWidgets:[]):targets;
    return {type,ids:eligible.map(widget=>widget.id),...(type==='set_timer'&&seconds!==null?{seconds}:{})};
  }).filter(action=>action.ids.length);
  return actions.length===types.length?actions:null;
}
export function validateAssistantActions(workspace:Workspace,actions:AssistantAction[],savedTrayItems:AssistantTrayItem[]=[]):void{
  const widgets=new Map(workspace.widgets.map(widget=>[widget.id,widget]));
  const savedItems=new Set(savedTrayItems.map(item=>item.id));
  if(!actions.length)throw new Error('The AI returned no workspace actions. Nothing was changed. Try again.');
  const batchSize=actions.filter(action=>action.type==='add_widget'||action.type==='open_saved').reduce((total,action)=>total+action.ids.length,0);
  if(batchSize>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can add or open at most ${MAX_ASSISTANT_BATCH} items in one request. Nothing was changed.`);
  const changeBatch=actions.filter(action=>action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin').reduce((total,action)=>total+action.ids.length,0);
  if(changeBatch>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can change at most ${MAX_ASSISTANT_BATCH} items in one request. Nothing was changed.`);
  for(const action of actions){
    validateAssistantActionFields(action);
    if(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))throw new Error('Choose a timer duration between one second and one year. Nothing was changed.');
    if((action.type==='add_widget'||action.type==='open_saved')&&action.ids.length>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can change at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`);
    for(const id of action.ids){if(action.type==='add_widget'){if(!widgetTypes.includes(id as WidgetType))throw new Error('Choose a widget type from Still’s built-in gallery. Nothing was changed.');continue}if(action.type==='open_saved'){if(!savedItems.has(id))throw new Error('A saved tray item changed before the action could run. Nothing was changed. Try again.');continue}if(action.type==='rename_workspace'){if(id!==workspace.id)throw new Error('Still can rename only the current workspace from this chat. Nothing was changed.');continue}if(action.type==='set_sidebar_plugin')continue;const widget=widgets.get(id);if(!widget)throw new Error('A workspace widget changed before the action could run. Nothing was changed. Try again.');if(action.type==='remove_widget'&&widget.lockPluginEnabled&&widget.locked)throw new Error('Unlock a locked widget before removing it. Nothing was changed.');if(action.type==='set_timer'&&widget.type!=='focus'&&!widget.clockPluginEnabled)throw new Error('Add the Clock timer to that widget, or select a Focus widget. Nothing was changed.');if(action.type==='set_widget_plugin'&&action.plugin==='clock-timer'&&widget.type==='group')throw new Error('Clock cannot be added to a Group collection. Nothing was changed.');if(action.type==='edit_widget'&&(action.text!==undefined&&widget.type!=='notes'||action.schedule!==undefined&&widget.type!=='timetable'||action.pluginControls!==undefined&&widget.type!=='tagStatus'))throw new Error('That field cannot be edited on this widget. Nothing was changed.');}
  }
}
export function applyAssistantWidgetActions(workspace:Workspace,actions:AssistantAction[],width:number,height:number,now=Date.now(),savedTrayItems:AssistantTrayItem[]=[]):Workspace{
  validateAssistantActions(workspace,actions,savedTrayItems);
  let next=workspace;
  for(const action of actions){
    if(action.type==='save_to_tray'||action.type==='set_sidebar_plugin')continue;
    if(action.type==='open_saved')continue;
    if(action.type==='remove_widget')continue;
    if(action.type==='rename_workspace')continue;
    if(action.type==='add_widget'){
      if(next.widgets.length+action.ids.length>MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
      let widgets=[...next.widgets],groups=[...next.groups];
      for(const id of action.ids){const type=id as WidgetType,widget=createWidget(type);if(action.title!==undefined)widget.title=action.title.trim();if(action.text!==undefined)widget.text=action.text;widget.instanceNumber=nextInstanceNumber(type,widgets);widget.placement=constrainPlacement(type,nextPlacement(type,widgets,width),width,{},height);if(type==='group'){const groupId=crypto.randomUUID();widget.groupId=groupId;groups.push({id:groupId,name:action.title?.trim()??'',shortcuts:[],widgets:[],expanded:false})}widgets.push(widget)}
      next={...next,widgets,groups};continue;
    }
    const ids=new Set(action.ids);
    if(action.type==='edit_widget'&&action.title!==undefined){const groupIds=new Set(next.widgets.filter(widget=>ids.has(widget.id)&&widget.type==='group'&&widget.groupId).map(widget=>widget.groupId!));if(groupIds.size)next={...next,groups:next.groups.map(group=>groupIds.has(group.id)?{...group,name:action.title!.trim()}:group)}}
    const widgets=next.widgets.map(widget=>{
      if(!ids.has(widget.id)||(action.type==='minimize'&&widget.minimized)||(action.type==='restore'&&!widget.minimized)||(action.type==='set_timer'&&widget.end!==null&&widget.end>now&&Math.ceil((widget.end-now)/1000)===action.seconds))return widget;
      if(action.type==='set_timer')return {...widget,remaining:action.seconds!,end:now+action.seconds!*1000};
      if(action.type==='set_widget_plugin')return action.plugin==='clock-timer'?{...widget,clockPluginEnabled:action.enabled!}:widget;
      if(action.type==='edit_widget')return {...widget,...(action.title!==undefined?{title:action.title.trim()}:{}),...(action.text!==undefined?{text:action.text}:{}),...(action.schedule!==undefined?{schedule:structuredClone(action.schedule)}:{}),...(action.tagColor!==undefined?{tagColor:action.tagColor==='none'?null:action.tagColor as WidgetInstance['tagColor']}:{}),...(action.pluginControls!==undefined?{pluginControls:[...action.pluginControls]}:{})};
      return action.type==='minimize'?minimizeWidgetInstance(widget,width,height):restoreWidgetInstance(widget,width,height);
    });
    if(widgets.some((widget,index)=>widget!==next.widgets[index]))next={...next,widgets};
  }
  return next;
}
export function addFocusForAssistantTimer(workspace:Workspace,width:number,height:number,seconds:number,now=Date.now()):Workspace{
  if(!Number.isSafeInteger(seconds)||seconds<1||seconds>31536000)throw new Error('Choose a timer duration between one second and one year.');
  if(workspace.widgets.some(widget=>widget.type==='focus'||widget.clockPluginEnabled))throw new Error('A timer control already exists. Select it with @ to use that widget.');
  if(workspace.widgets.length>=MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
  const widget=createWidget('focus');widget.instanceNumber=nextInstanceNumber('focus',workspace.widgets);
  widget.placement=constrainPlacement('focus',nextPlacement('focus',workspace.widgets,width),width,{},height);
  widget.remaining=seconds;widget.end=now+seconds*1000;
  return {...workspace,widgets:[...workspace.widgets,widget]};
}
export function validateAssistantActionIntent(prompt:string,workspace:Workspace,actions:AssistantAction[],savedTrayItems:AssistantTrayItem[]=[]):void{
  const expected=assistantActionRequest(prompt,savedTrayItems);
  if(!expected.length)return;
  const supplied=new Set(actions.map(action=>action.type));
  if(expected.some(type=>!supplied.has(type)))throw new Error('No widgets were changed. The AI did not return every requested workspace action. Try again.');
  if([...supplied].some(type=>!expected.includes(type)))throw new Error('The suggested actions include changes beyond the direct request. Review them before applying.');
  if(expected.includes('remove_widget')){
    const removal=actions.find(action=>action.type==='remove_widget');
    const namedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type));
    if(!removal||namedTypes.length&&removal.ids.some(id=>!workspace.widgets.some(widget=>widget.id===id&&namedTypes.includes(widget.type))))throw new Error('No widgets were removed. Still AI selected a widget that does not match your request. Try again.');
  }
  if(expected.includes('rename_workspace')){
    const action=actions.find(item=>item.type==='rename_workspace');
    const match=prompt.match(/\brename\b[\s\S]{0,30}\bworkspace\b[\s\S]{0,20}\b(?:to|as)\s+["'“”]?(.+?)["'“”]?[.!?]*$/i);
    if(!action||action.ids[0]!==workspace.id||match?.[1]?.trim().toLocaleLowerCase()!==action.title?.trim().toLocaleLowerCase())throw new Error('The workspace name did not match your request. Nothing was changed.');
  }
  if(expected.includes('set_sidebar_plugin')){
    const action=actions.find(item=>item.type==='set_sidebar_plugin');
    const requested=(['stack','layout'] as const).filter(plugin=>new RegExp(`\\b${plugin}\\b`,'i').test(prompt));
    const enable=!/\b(?:remove|disable|turn off)\b/i.test(prompt);
    if(!action||requested.length!==action.ids.length||requested.some(plugin=>!action.ids.includes(plugin))||action.enabled!==enable)throw new Error('The sidebar plugin changes did not match your request. Nothing was changed.');
  }
  if(expected.includes('set_widget_plugin')){
    const action=actions.find(item=>item.type==='set_widget_plugin');
    const enable=/\b(?:add|enable|turn on)\b/i.test(prompt);
    const namedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type));
    const targets=workspace.widgets.filter(widget=>widget.type!=='group'&&namedTypes.length&&namedTypes.includes(widget.type)).map(widget=>widget.id);
    if(!action||action.plugin!=='clock-timer'||action.enabled!==enable||targets.some(id=>!action.ids.includes(id)))throw new Error('The Clock plugin changes did not match your request. Nothing was changed.');
  }
  const amount=assistantRequestedItemCount(prompt);
  if(amount!==null)for(const type of ['add_widget','open_saved'] as const)if(expected.includes(type)){
    const action=actions.find(item=>item.type===type);
    if(action&&action.ids.length!==amount)throw new Error('No widgets were changed. Still AI did not include the requested number of widgets. Try again.');
  }
  const asksForAll=/\b(?:all|every|each)\b/i.test(prompt);
  if(asksForAll)for(const type of expected){
    if(type==='add_widget')continue;
    const action=actions.find(item=>item.type===type);
    const selectedTypes=widgetTypes.filter(widgetType=>widgetNameMentioned(prompt,widgetType));
    const targets=type==='open_saved'?savedTrayItems.map(item=>item.id):workspace.widgets.filter(widget=>type==='save_to_tray'||type==='set_widget_plugin'?widget.type!=='group':type==='set_timer'?widget.type==='focus'||widget.clockPluginEnabled:type==='remove_widget'&&selectedTypes.length?selectedTypes.includes(widget.type):true).map(widget=>widget.id);
    if(!action||targets.some(id=>!action.ids.includes(id)))throw new Error('No widgets were changed. The AI did not include every widget in the requested action. Try again.');
  }
}
export function validateLayout(workspace:Workspace,items:LayoutItem[],width:number,height:number):void {
  const movable=workspace.widgets.filter(w=>!w.minimized),ids=new Set<string>();
  if(!movable.length||items.length!==movable.length)throw new Error('The proposal must include every expanded widget exactly once.');
  for(const item of items){
    const widget=movable.find(w=>w.id===item.id);
    if(!widget||ids.has(item.id))throw new Error('The proposal contains a missing or duplicate widget.');
    ids.add(item.id);
    const meta=widgetCatalog[widget.type],minimumWidth=Math.max(meta.minWidth,widget.appPanelOpen?widget.appMinWidth??0:0),minimumHeight=Math.max(meta.minHeight,widget.appPanelOpen?widget.appMinHeight??0:0);
    if(widget.lockPluginEnabled&&widget.locked&&(item.x!==widget.placement.x||item.y!==widget.placement.y))throw new Error('Unlock locked widgets before moving them in a layout. Nothing was changed.');
    if([item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n))||item.x<0||item.y<0||item.width<minimumWidth||item.height<minimumHeight||item.width>3000||item.height>3000||item.x+item.width>width-20||item.y+item.height>height-20)throw new Error('The proposed layout does not fit the canvas or widget minimum sizes. Try requesting a different arrangement.');
  }
  const rectangles=[...items,...workspace.widgets.filter(w=>w.minimized).map(w=>({...w.placement,id:w.id}))];
  for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
    const a=rectangles[i],b=rectangles[j];
    if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)throw new Error('The proposed layout overlaps widgets. Nothing was changed. Try a different arrangement.');
  }
}
export function applyLayoutPlan(workspace:Workspace,plan:LayoutPlan,width:number,height:number):Workspace {
  if(workspace.id!==plan.workspaceId||layoutFingerprint(workspace)!==plan.fingerprint||width!==plan.width||height!==plan.height)throw new Error('The workspace changed. Request a fresh layout before applying it.');
  validateLayout(workspace,plan.items,width,height);
  const positions=new Map(plan.items.map(({id,...p})=>[id,p]));
  return {...workspace,widgets:workspace.widgets.map(w=>positions.has(w.id)?{...w,placement:positions.get(w.id)!,lectureRestore:null}:w)};
}
