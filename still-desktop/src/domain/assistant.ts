import {createWidget,minimizeWidgetInstance,nextInstanceNumber,restoreWidgetInstance,type WidgetInstance,type Workspace,type ScheduleEntry} from './workspaces.ts';
import {widgetCatalog,widgetTypes,type WidgetType} from './widgetCatalog.ts';
import {checkedNoteTags,createNoteDocument,NOTE_DOCUMENT_LIMIT,NOTE_DOCUMENT_TOTAL_LIMIT,NOTE_TAG_LENGTH_LIMIT,NOTE_TAG_LIMIT,updatedNoteDocument} from './noteDocuments.ts';
import type {WidgetPreset} from './presets.ts';
import type {SavedGroup} from './workspaces.ts';
import {constrainPlacement,nextPlacement,type Placement} from './layout.ts';
import {widgetTagColors} from './widgetTags.ts';
import {checkedStudyCalendarDrafts,type StudyCalendarEventDraft} from './studyCalendar.ts';
import {shortcutError,shortcutsError,type Shortcut,type WorkspaceShortcuts} from './shortcuts.ts';

export type AssistantProvider = 'gemini' | 'openai' | 'opencode' | 'chatgpt';
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
export const ASSISTANT_ACTION_TYPES=['minimize','restore','save_to_tray','set_timer','control_timer','add_widget','create_note_document','open_note_document','close_note_document','open_saved','remove_widget','edit_widget','set_widget_plugin','set_sidebar_plugin','set_ui_visibility','set_course_auto_open','set_course_environment','rename_workspace','open_settings','set_setting','create_workspace','switch_workspace','undo','set_shortcut','run_tutorial','move_widget'] as const;
export const ASSISTANT_SHORTCUT_IDS=['up','down','overview','clickThrough','commandPalette','undo',...Array.from({length:9},(_,index)=>`workspace-${index+1}`)] as const;
export type AssistantActionType = typeof ASSISTANT_ACTION_TYPES[number];
export type AssistantAction = {type:AssistantActionType;ids:string[];seconds?:number;operation?:'pause'|'resume'|'reset';noteFont?:'sans'|'serif'|'mono';noteFontSize?:number;noteDocumentId?:string;noteTags?:string[];title?:string;text?:string;schedule?:ScheduleEntry[];tagColor?:string;pluginControls?:string[];plugin?:'clock-timer'|'lock';enabled?:boolean;locked?:boolean;settingValue?:string;shortcut?:Shortcut;workspaceId?:string};
export type AssistantTrayItem={id:string;name:string;type:WidgetType;kind:'preset'|'group'};
export type AssistantWorkspaceChoice={id:string;name:string};
export type AssistantResponseIntent='chat'|'clarification'|'workspace_action'|'layout';
export type AssistantLibraryOperation={version:1;id:string;reason:string}&(
  {type:'create_folder';parentId:string;name:string}|
  {type:'rename';entryId:string;expectedRevision:string;name:string}|
  {type:'move';entryId:string;expectedRevision:string;destinationFolderId:string}
);
export type AssistantLibraryProposal={version:1;rootId:string;operations:AssistantLibraryOperation[]};
/** Names-only snapshot; callers must obtain explicit root selection and sharing consent first. */
export type AssistantLibraryOrganisationContext={version:1;rootId:string;rootName:string;entries:{id:string;path:string;name:string;directory:boolean;size:number;revision:string}[];truncated:boolean;contentShared:false};
export type AssistantFileProposal={sourceWidgetId:string;sourcePath:string;destinationFolder:string;reason:string};
export const MAX_ASSISTANT_BATCH=10;
export const MAX_ASSISTANT_WIDGETS=100;
export const MAX_ASSISTANT_WORKSPACES=30;
/** Reject an AI edit if the data it would replace changed while the request was in flight. */
export function assistantEditTargetsUnchanged(before:Workspace,current:Workspace,actions:AssistantAction[]):boolean{
  if(before.id!==current.id)return false;
  return actions.filter(action=>action.type==='edit_widget').every(action=>action.ids.every(id=>{
    const old=before.widgets.find(widget=>widget.id===id),now=current.widgets.find(widget=>widget.id===id);
    if(!old||!now||old.type!==now.type)return false;
    const fields=(['title','text','tagColor','pluginControls','noteFont','noteFontSize','schedule'] as const).filter(field=>action[field]!==undefined);
    if(fields.some(field=>JSON.stringify(old[field])!==JSON.stringify(now[field])))return false;
    if(old.type==='notes'&&(action.title!==undefined||action.text!==undefined)&&(old.activeNoteDocumentId!==now.activeNoteDocumentId||JSON.stringify(old.noteDocuments)!==JSON.stringify(now.noteDocuments)))return false;
    if(old.type==='notes'&&action.noteTags!==undefined){const previous=old.noteDocuments.find(doc=>doc.id===action.noteDocumentId),next=now.noteDocuments.find(doc=>doc.id===action.noteDocumentId);return !!previous&&!!next&&JSON.stringify(previous.tags??[])===JSON.stringify(next.tags??[])}
    return true;
  }));
}
export function resolveNamedNotesCreation(prompt:string):{title:string;topic:string}|null{
  const details=prompt.trim().match(/^(?:(?:please|can|could|would|will)\s+)*(?:you\s+)?(?:make|create|add)\s+(?:a\s+)?(?:new\s+)?notes?\s+(?:widget\s+)?(?:named|called|titled)\s+["'“]?([^,"'”\n]+?)\s*["'”]?(?:\s*,?\s*(?:and\s+)?(?:write|put|add|include)\s+(?:some\s+)?notes?\s+(?:about|on|for|covering)\s+([\s\S]+?))?[.!?]*$/i);
  if(!details)return null;
  const title=details[1].trim(),topic=details[2]?.trim().replace(/[.!?]+$/,'').trim()??'';
  if(!title||title.length>60||topic.length>12000)return null;
  return {title,topic};
}
export type AssistantReply = {intent?:AssistantResponseIntent;reply:string; layout:LayoutItem[]; actions:AssistantAction[];fileProposals?:AssistantFileProposal[];calendarProposals?:StudyCalendarEventDraft[];libraryProposal?:AssistantLibraryProposal};
export type LayoutPlan = {workspaceId:string; fingerprint:string; width:number; height:number; items:LayoutItem[]};
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_MODELS:Record<AssistantProvider,string> = {gemini:DEFAULT_MODEL,openai:'gpt-4o-mini',opencode:'mimo-v2.6-flash',chatgpt:''};
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
/** Cap provider history at a user turn and repair empty legacy messages. */
export function prepareAssistantHistory(messages:ChatMessage[]):ChatMessage[]{
  const recent=messages.slice(-HISTORY_LIMIT);
  const firstUser=recent.findIndex(message=>message.role==='user');
  if(firstUser===-1)return [];
  return recent.slice(firstUser).map(message=>({
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
export function assistantActionsDescription(actions:AssistantAction[],workspace:Workspace,tray:AssistantTrayItem[],copy?:{types?:Partial<Record<AssistantActionType,string>>;widget?:string;widgetType?:(type:WidgetType)=>string;widgetLabel?:(widget:WidgetInstance)=>string;named?:string;withInitialNote?:string;seconds?:string;off?:string;join?:string}):string{
  const labels:Record<AssistantActionType,string>={add_widget:'Create',create_note_document:'Create note in',open_note_document:'Open note in',close_note_document:'Close note in',open_saved:'Open saved',remove_widget:'Remove',minimize:'Minimize',restore:'Restore',save_to_tray:'Save to tray',set_timer:'Start timer on',control_timer:'Control timer on',edit_widget:'Edit',set_widget_plugin:'Change plugin on',set_sidebar_plugin:'Change sidebar plugin',set_ui_visibility:'Change Still interface visibility',set_course_auto_open:'Change course automatic opening',set_course_environment:'Change course environment',rename_workspace:'Rename workspace',open_settings:'Open settings',set_setting:'Change setting',create_workspace:'Create workspace',switch_workspace:'Switch workspace',undo:'Undo',set_shortcut:'Change shortcut',run_tutorial:'Run tutorial',move_widget:'Move widget'};
  return actions.map(action=>{
    const names=action.type==='open_note_document'||action.type==='close_note_document'?[workspace.widgets.find(item=>item.id===action.ids[0]&&item.type==='notes')?.noteDocuments.find(document=>document.id===action.ids[1])?.title??copy?.widget??'note']:action.ids.map(id=>action.type==='add_widget'?copy?.widgetType?.(id as WidgetType)??widgetCatalog[id as WidgetType]?.name:action.type==='open_saved'?tray.find(item=>item.id===id)?.name:action.type==='rename_workspace'?workspace.name:action.type==='set_sidebar_plugin'||action.type==='set_ui_visibility'||action.type==='set_shortcut'||action.type==='run_tutorial'?id:workspace.widgets.find(item=>item.id===id)).map(value=>typeof value==='string'?value:value?copy?.widgetLabel?.(value)??widgetLabel(value):copy?.widget??'widget');
    const named=copy?.named?.replace('{name}',action.title??'')??` named “${action.title}”`;
    const seconds=copy?.seconds?.replace('{count}',String(action.seconds??''))??` for ${action.seconds} seconds`;
    return `${copy?.types?.[action.type]??labels[action.type]} ${names.join(', ')}${action.type==='control_timer'&&action.operation?` (${action.operation})`:''}${action.type==='set_ui_visibility'?(action.enabled?' visible':' hidden'):''}${action.type==='move_widget'&&action.workspaceId?` to workspace ${action.workspaceId}`:''}${action.title?named:''}${action.text!==undefined?(copy?.withInitialNote??' with initial note text'):''}${action.seconds!==undefined?seconds:''}${action.enabled===false&&action.type!=='set_ui_visibility'?(copy?.off??' off'):''}`;
  }).join(copy?.join??'; ');
}

export function widgetLabel(widget:WidgetInstance):string {
  return widget.title || widgetCatalog[widget.type].name+' '+widget.instanceNumber;
}
// No resource grants, local paths, bookmarks, or content from other widgets.
export function widgetContext(widget:WidgetInstance):Record<string,unknown> {
  const result:Record<string,unknown> = {type:widget.type, title:widgetLabel(widget),tagColor:widget.tagColor??null};
  if(widget.type==='notes'){result.text=widget.text.slice(0,12000);result.noteDocuments=widget.noteDocuments.map(document=>({id:document.id,title:document.title,tags:document.tags??[],active:document.id===widget.activeNoteDocumentId,libraryFile:!!document.sourcePath}))}
  if(widget.type==='ai')result.text=widget.text.slice(0,12000);
  if(widget.type==='timetable')result.schedule=widget.schedule.slice(0,80);
  if(widget.type==='calendar')result.calendarEvents=widget.calendarEvents.slice(0,80).map(event=>({date:event.date,title:event.title,time:event.time,category:event.category}));
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
export function assistantWorkspaceContext(workspace:Workspace,width:number,height:number,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[],installedSidebarPlugins:string[]=[],workspaces:AssistantWorkspaceChoice[]=[]):Record<string,unknown> {
  const unique=[...new Set(selectedWidgetIds)];
  const selected=new Set(unique);
  const widgetData:Record<string,unknown>[]=workspace.widgets.map(widget=>({id:widget.id,...widgetContext(widget),quickSelected:selected.has(widget.id)}));
  const context:Record<string,unknown>={canvasAndWidgets:layoutContext(workspace,width,height),widgetData,savedTrayItems:savedTrayItems.map(({id,name,type,kind})=>({id,name,type,kind})),workspaces:workspaces.map(({id,name})=>({id,name,active:id===workspace.id})),installedSidebarPlugins,capabilities:{actions:[...ASSISTANT_ACTION_TYPES],workspaceActions:{set_course_environment:'Link or unlink one timetable course to an existing workspace. Use the timetable widget id and course id in ids; set enabled true with workspaceId to link or enabled false without workspaceId to unlink. Ask if ambiguous.',set_course_auto_open:'Change automatic opening for one linked timetable course using its timetable widget id, course id, and enabled boolean. Ask when the course is ambiguous.',set_ui_visibility:'Show or hide exactly one Still UI area: sidebar or apps-bar. Use enabled true to show and false to hide. This does not control the Windows taskbar or native app windows.',switch_workspace:'Switch to one workspace by using its exact id from workspaces; ask which one when the name is missing or ambiguous.',move_widget:'Move one existing widget from the active workspace to another exact workspace id; ask for the widget or destination if ambiguous, and do not move an attached native app window.',create_note_document:'Create one local note document inside one existing Notes widget. Use its exact widget id, a clear title and optional text. Ask which Notes widget when ambiguous; never exceed 40 documents in one Notes widget or 10 created per request.',open_note_document:'Open an existing note document by its exact supplied id and switch its Notes widget to that tab. Ask which note if its title is ambiguous.',close_note_document:'Close one open note tab in one Notes widget. Use the exact Notes widget and note document IDs from noteDocuments. If multiple tabs match or the active note is unclear, ask which one; closing a tab does not delete its library file.',edit_note_tags:'For a clear request to add/remove tags on one note, use edit_widget with its Notes widget id, that document exact noteDocumentId, and the resulting complete noteTags array. Use the existing noteDocuments metadata. Ask which note when there are multiple candidates or none is identifiable. Empty noteTags removes all tags. Max 12 tags, 32 characters each.',control_timer:'Pause, resume, or reset exactly one existing Focus or Clock timer using control_timer with one exact widget id and operation pause, resume, or reset. Ask which timer if more than one is available; never create or change other widgets as part of timer control.',undo:'Undo one previous reversible Still change when the user directly asks.',set_shortcut:'Change one supported Still shortcut using a valid, conflict-free key binding.',run_tutorial:'Open the built-in Still tutorial when the user asks to replay it.'},creatableWidgets:widgetTypes.map(id=>({id,name:widgetCatalog[id].name})),editableFields:{allWidgets:['title','tagColor'],notes:['text','create_note_document','open_note_document','close_note_document','noteFont','noteFontSize','noteTags'],timetable:['schedule'],tagStatus:['pluginControls'],focusAndClock:['timer','control_timer'],limits:{titleMaxLength:60,notesTextMaxLength:12000,notesFont:['sans','serif','mono'],notesFontSize:[12,14,16,18,20,24,28],noteTags:{max:NOTE_TAG_LIMIT,tagLengthMax:NOTE_TAG_LENGTH_LIMIT},scheduleEntriesMax:80,groupControlsMax:20,noteDocumentsPerWidget:NOTE_DOCUMENT_LIMIT,noteDocumentsTotalCharacters:NOTE_DOCUMENT_TOTAL_LIMIT}},settings:{theme:['light','dark'],density:['comfortable','compact'],background:['solid','dots','transparent'],appearance:['minimal','liquid-glass'],glassOpacity:{min:45,max:90},glassBackgroundEffect:['liquid-chrome','line-waves','wave-wallpaper'],canvasFrameRate:['30','60','display'],followWidgetToWorkspace:['on','off'],autoOpenCourseEnvironments:['on','off'],locale:['en','zh-CN'],launchAtSignIn:['on','off'],appShutdownBehavior:['minimize','close','leaveOpen'],closeAppOnWidgetClose:['on','off'],saveAppShortcutsOnAttach:['on','off'],appWidgetButtons:['showAppAttachAction','showAppDetachAction','showAppSaveAction','showWidgetExportPngAction'],clickThrough:['passThroughTransparentBackground','enableWholeWindowClickThrough'],widgetRelaunch:{mode:['automatic','manual'],pluginStatus:['enabled','disabled','removed'],tagColor:['follow','automatic','manual']},screenshotPlugin:{mode:['global','tag-colors','off'],tagColor:['on','off'],tagColorOverride:['follow','on','off']},clockPlugin:{mode:['global','tag-colors','off'],tagColor:['on','off'],tagColorOverride:['follow','on','off']}},plugins:{widget:['clock-timer','lock'],sidebar:['stack','layout'],tagStatus:['widget-relaunch.global-mode','widget-relaunch.tag-colors','screenshot.settings','clock-timer.settings']},contentEditingRequiresWidgetSelection:false,externalContentEditing:['apps','files','calculator'],maxBatchItems:MAX_ASSISTANT_BATCH,maxAddOrOpenItems:MAX_ASSISTANT_BATCH,maxWorkspaceWidgets:MAX_ASSISTANT_WIDGETS,confirmationRequired:['remove_widget','open_saved_apps','delete_workspace','unclear_action_intent']}};
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
  if(types.includes('create_note_document')&&amount!==null&&amount>MAX_ASSISTANT_BATCH)return `Still AI can create at most ${MAX_ASSISTANT_BATCH} note documents in one request. Nothing was changed.`;
  if((types.includes('add_widget')||types.includes('open_saved'))&&amount===0)return `Choose between 1 and ${MAX_ASSISTANT_BATCH} widgets. Nothing was changed.`;
  if(types.includes('add_widget')&&amount!==null&&amount>MAX_ASSISTANT_BATCH)return `Still AI can add at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`;
  if(types.includes('open_saved')&&amount!==null&&amount>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Nothing was changed.`;
  if(types.includes('open_saved')&&/\b(?:all|every|each)\b/i.test(text)&&savedTrayItems.length>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Open a smaller group at a time.`;
  return null;
}
function assistantRequestedItemCount(text:string):number|null{
  const phrase=assistantRequestedItemCountPhrase(text);
  return phrase===null?null:parseAssistantCount(phrase);
}
function assistantRequestedItemCountPhrase(text:string):string|null{
  const numberWord='(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen|and)';
  const phrase=`${numberWord}(?:[ -]${numberWord}){0,5}`;
  const amount=text.match(new RegExp(`(?<![-.\\d])\\b(${phrase})\\s+(?:saved\\s+)?(?:(?:note|notes)\\s+(?:files?|documents?)|(?:[a-z-]+\\s+)?(?:widgets?|cards?|notes?|focus|calculators?|files?|apps?|timetables?|groups?))\\b`,'i'));
  if(!amount||/^and\b/i.test(amount[1]))return null;
  return amount[1].trim();
}
function parseAssistantCount(value:string):number|null{
  const scales:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
  const words=value.toLowerCase().replace(/-/g,' ').trim().split(/\s+/).filter(word=>word!=='and');
  if(words.length===1&&/^\d+$/.test(words[0]))return Number(words[0]);
  let total=0,current=0;
  for(const word of words){
    if(/^\d+$/.test(word)){current+=Number(word);continue}
    if(scales[word]!==undefined){current+=scales[word];continue}
    if(word==='dozen'){current+=12;continue}
    if(word==='hundred'){current=Math.max(1,current)*100;continue}
    if(word==='thousand'||word==='million'){const scale=word==='thousand'?1000:1000000;total+=Math.max(1,current)*scale;current=0;continue}
    return null;
  }
  const result=total+current;
  return Number.isSafeInteger(result)?result:null;
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
    const newWorkspace=action?.type==='create_workspace',switchWorkspace=action?.type==='switch_workspace',undoAction=action?.type==='undo',singleControl=action?.type==='set_shortcut'||action?.type==='run_tutorial'||action?.type==='control_timer';
    if(!action||!ASSISTANT_ACTION_TYPES.includes(action.type)||!Array.isArray(action.ids)||(!action.ids.length&&!newWorkspace)||action.ids.length>(newWidgets||openSaved||action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin'||newWorkspace?MAX_ASSISTANT_BATCH:100)||(switchWorkspace||undoAction||singleControl||action.type==='set_ui_visibility')&&action.ids.length!==1||action.ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id))||(!newWidgets&&!newWorkspace&&new Set(action.ids).size!==action.ids.length)||(newWidgets&&action.ids.some(id=>!widgetTypes.includes(id as WidgetType)))||(newWorkspace&&action.ids.some(id=>!widgetTypes.includes(id as WidgetType)))||(openSaved&&action.ids.some(id=>!id.startsWith('preset-')&&!id.startsWith('group-')))||(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))||(action.type!=='set_timer'&&action.seconds!==undefined)||(action.type==='control_timer'&&!['pause','resume','reset'].includes(action.operation??''))||(action.type!=='control_timer'&&action.operation!==undefined))throw new Error('The AI returned an invalid workspace action. Nothing was changed. Try again.');
    validateAssistantActionFields(action);
    return {type:action.type,ids:[...action.ids],...(action.type==='set_timer'?{seconds:action.seconds}:{}),...(action.type==='control_timer'?{operation:action.operation}:{}),...(action.noteFont!==undefined?{noteFont:action.noteFont}:{}),...(action.noteFontSize!==undefined?{noteFontSize:action.noteFontSize}:{}),...(action.noteDocumentId!==undefined?{noteDocumentId:action.noteDocumentId}:{}),...(action.noteTags!==undefined?{noteTags:[...action.noteTags]}:{}),...(action.title!==undefined?{title:action.title.trim()}:{}),...(action.text!==undefined?{text:action.text}:{}),...(action.schedule!==undefined?{schedule:action.schedule.map(entry=>({...entry,title:entry.title.trim(),location:entry.location.trim()}))}:{}),...(action.tagColor!==undefined?{tagColor:action.tagColor}:{}),...(action.pluginControls!==undefined?{pluginControls:[...action.pluginControls]}:{}),...(action.plugin!==undefined?{plugin:action.plugin}:{}),...(action.enabled!==undefined?{enabled:action.enabled}:{}),...(action.locked!==undefined?{locked:action.locked}:{}),...(action.settingValue!==undefined?{settingValue:action.settingValue}:{}),...(action.shortcut!==undefined?{shortcut:{...action.shortcut}}:{}),...(action.workspaceId!==undefined?{workspaceId:action.workspaceId}:{})};
  });
  const rawLibrary=(value as Partial<AssistantReply>).libraryProposal;
  const libraryProposal=rawLibrary===undefined?undefined:checkedAssistantLibraryProposal(rawLibrary);
  const rawFileProposals=(value as Partial<AssistantReply>).fileProposals??[];
   if(!Array.isArray(rawFileProposals)||rawFileProposals.length>5)throw new Error('The AI returned an invalid file filing proposal. Nothing was moved. Try again.');
   const proposedSources=new Set<string>();
  const fileProposals:AssistantFileProposal[]=rawFileProposals.map(proposal=>{
     if(!proposal||typeof proposal.sourceWidgetId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(proposal.sourceWidgetId)||typeof proposal.sourcePath!=='string'||!isSafeResourcePath(proposal.sourcePath)||typeof proposal.destinationFolder!=='string'||!isSafeFilingFolder(proposal.destinationFolder)||typeof proposal.reason!=='string'||!proposal.reason.trim()||Array.from(proposal.reason).length>600)throw new Error('The AI returned an unsafe file filing proposal. Nothing was moved. Try again.');
     const sourceKey=proposal.sourceWidgetId+'::'+proposal.sourcePath;if(proposedSources.has(sourceKey))throw new Error('The AI returned duplicate filing proposals for one file. Nothing was moved. Try again.');proposedSources.add(sourceKey);
     return {sourceWidgetId:proposal.sourceWidgetId,sourcePath:proposal.sourcePath,destinationFolder:proposal.destinationFolder,reason:proposal.reason.trim()};
  });
  let calendarProposals:StudyCalendarEventDraft[]=[];
  try{calendarProposals=checkedStudyCalendarDrafts((value as Partial<AssistantReply>).calendarProposals??[])}catch(error){throw new Error(error instanceof Error?error.message:'The AI returned invalid calendar events. Nothing was added.')}
  if(libraryProposal&&(items.length||actions.length||fileProposals.length||calendarProposals.length))throw new Error('The AI mixed Library proposals with other changes. Nothing was changed.');
  if(fileProposals.length&&(items.length||actions.length||calendarProposals.length))throw new Error('The AI mixed a file filing proposal with workspace changes. Nothing was moved. Try again.');
  if(calendarProposals.length&&(items.length||actions.length))throw new Error('The AI mixed calendar event proposals with workspace changes. Nothing was changed. Try again.');
  if(actions.filter(action=>action.type==='add_widget'||action.type==='open_saved').reduce((total,action)=>total+action.ids.length,0)>MAX_ASSISTANT_BATCH)throw new Error('The AI returned too many widget actions. Nothing was changed. Try a smaller request.');
  if(actions.filter(action=>action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin').reduce((total,action)=>total+action.ids.length,0)>MAX_ASSISTANT_BATCH)throw new Error('The AI returned too many workspace changes. Nothing was changed. Try a smaller request.');
  const conflictingLegacyProposal=!intent&&items.length>0&&actions.length>0;
  const safeIntent:AssistantResponseIntent|undefined=conflictingLegacyProposal?'clarification':intent;
  const safeLayout=safeIntent==='chat'||safeIntent==='clarification'||safeIntent==='workspace_action'?[]:items;
  const safeActions=safeIntent==='chat'||safeIntent==='clarification'||safeIntent==='layout'?[]:actions;
  if(!reply.trim()&&!safeActions.length&&!safeLayout.length&&!calendarProposals.length&&!libraryProposal)throw new Error('The AI returned no reply. Try again.');
  const normalizedReply=conflictingLegacyProposal
    ?'I received conflicting workspace suggestions, so I did not change anything. What would you like me to do?'
    :reply.trim()?reply:libraryProposal?'Review the proposed Library changes before applying them.':safeActions.length?'Workspace actions requested.':calendarProposals.length?'Review the proposed calendar events before adding them.':'Workspace layout proposal.';
   const safeFileProposals=safeIntent==='clarification'?[]:fileProposals;
   const safeCalendarProposals=safeIntent==='clarification'?[]:calendarProposals;
   return {...(safeIntent?{intent:safeIntent}:{}),...(libraryProposal&&safeIntent!=='clarification'?{libraryProposal}:{}),reply:normalizedReply,layout:safeLayout,actions:safeActions,...(safeFileProposals.length?{fileProposals:safeFileProposals}:{}),...(safeCalendarProposals.length?{calendarProposals:safeCalendarProposals}:{})};
}
/** Structural validation only: snapshot binding and native authorization remain mandatory at review/apply. */
export function checkedAssistantLibraryProposal(value:unknown):AssistantLibraryProposal{
  const fail=():never=>{throw new Error('The AI returned an unsafe Library proposal. Nothing was changed.');};
  const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const opaque=(v:unknown):v is string=>typeof v==='string'&&v.length>=1&&v.length<=200&&/^[\x20-\x7e]+$/.test(v)&&!/[\\/]/.test(v);
  if(!object(value)||Object.keys(value).some(k=>!['version','rootId','operations'].includes(k))||value.version!==1||!opaque(value.rootId)||!Array.isArray(value.operations)||!value.operations.length||value.operations.length>20)return fail();
  const ids=new Set<string>(),sources=new Set<string>();
  const rawOperations=value.operations;
  const operations=rawOperations.map(raw=>{
    if(!object(raw)||raw.version!==1||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id)||ids.has(raw.id)||typeof raw.reason!=='string'||!raw.reason.trim()||Array.from(raw.reason).length>600)return fail();
    const fields=raw.type==='create_folder'?['parentId','name']:raw.type==='rename'?['entryId','expectedRevision','name']:raw.type==='move'?['entryId','expectedRevision','destinationFolderId']:null;
    if(!fields||Object.keys(raw).some(k=>!['version','id','type','reason',...fields].includes(k))||fields.some(k=>!(k in raw)))return fail();
    if(raw.type==='create_folder'){if(!opaque(raw.parentId))return fail();}
    else{if(!opaque(raw.entryId)||!opaque(raw.expectedRevision)||raw.entryId===value.rootId||sources.has(raw.entryId))return fail();sources.add(raw.entryId);}
    if(raw.type==='move'){if(!opaque(raw.destinationFolderId)||raw.destinationFolderId===raw.entryId)return fail();}
    else if(typeof raw.name!=='string'||new TextEncoder().encode(raw.name).length>100||!isSafeFilingFolder(raw.name)||/[\/\u007f-\u009f]/.test(raw.name)||/^(?:COM|LPT)[¹²³]$/i.test(raw.name.split('.')[0].replace(/[ .]+$/,'')))return fail();
    const target=raw.type==='create_folder'?raw.parentId:raw.type==='move'?raw.destinationFolderId:undefined;
    // A proposal ID can only refer to an earlier create-folder, never a future operation.
    if(typeof target==='string'&&rawOperations.some((op:unknown)=>object(op)&&op.id===target)&&!ids.has(target))return fail();
    if(typeof target==='string'&&ids.has(target)&&!rawOperations.some((op:unknown)=>object(op)&&op.id===target&&op.type==='create_folder'))return fail();
    ids.add(raw.id);
    return {...raw} as AssistantLibraryOperation;
  });
  return {version:1,rootId:value.rootId,operations};
}
function isSafeFilingFolder(value:string):boolean{
  const segments=value.split('/');
  if(!value||new TextEncoder().encode(value).length>240||segments.length>8)return false;
  return segments.every(segment=>{
    if(!segment||segment==='.'||segment==='..'||new TextEncoder().encode(segment).length>100||/[ .]$/.test(segment)||/[<>:"/\\|?*\u0000-\u001f]/.test(segment))return false;
    const device=segment.split('.')[0].replace(/[ .]+$/,'');
    return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(device);
  });
}
function isSafeResourcePath(value:string):boolean{return !!value&&new TextEncoder().encode(value).length<=1000&&!value.startsWith('/')&&!value.includes(':')&&!value.includes('\\')&&value.split('/').every(segment=>!!segment&&segment!=='.'&&segment!=='..')}
function validateAssistantActionFields(action:AssistantAction):void{
  if(action.type==='control_timer'&&(action.ids.length!==1||!['pause','resume','reset'].includes(action.operation??'')))throw new Error('Choose one timer and a pause, resume, or reset operation. Nothing was changed.');
  if(action.type!=='control_timer'&&action.operation!==undefined)throw new Error('A timer operation is supported only for timer controls. Nothing was changed.');
  if(action.noteFont!==undefined&&(action.type!=='edit_widget'||!['sans','serif','mono'].includes(action.noteFont)))throw new Error('Choose Sans serif, Serif, or Monospace for a Notes widget. Nothing was changed.');
  if(action.noteFontSize!==undefined&&(action.type!=='edit_widget'||![12,14,16,18,20,24,28].includes(action.noteFontSize)))throw new Error('Choose a Notes text size from 12px to 28px. Nothing was changed.');
  if(action.noteTags!==undefined&&(action.type!=='edit_widget'||!Array.isArray(action.noteTags)||action.noteTags.length>NOTE_TAG_LIMIT||action.noteTags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.length>NOTE_TAG_LENGTH_LIMIT||/[\u0000-\u001f\u007f]/.test(tag))||checkedNoteTags(action.noteTags).length!==action.noteTags.length||!action.noteDocumentId||!/^[a-zA-Z0-9-]{1,500}$/.test(action.noteDocumentId)))throw new Error('Choose a valid note tag and one existing note document. Nothing was changed.');
  if(action.noteDocumentId!==undefined&&(action.type!=='edit_widget'||action.noteTags===undefined))throw new Error('A note document ID is supported only with Notes tag changes. Nothing was changed.');
  if(action.shortcut!==undefined){if(action.type!=='set_shortcut'||!action.shortcut||Object.keys(action.shortcut).some(key=>!['key','ctrl','alt','shift'].includes(key))||shortcutError(action.shortcut))throw new Error('Choose a valid shortcut and key combination. Nothing was changed.')}
  if(action.type==='set_shortcut'&&(action.ids.length!==1||!ASSISTANT_SHORTCUT_IDS.includes(action.ids[0] as typeof ASSISTANT_SHORTCUT_IDS[number])||!action.shortcut))throw new Error('Choose one supported shortcut and key combination. Nothing was changed.');
  if(action.type==='run_tutorial'&&(action.ids.length!==1||action.ids[0]!=='tutorial'))throw new Error('Choose the Still tutorial to open. Nothing was changed.');
  if(action.type==='move_widget'&&(action.ids.length!==1||!action.workspaceId||!/^[a-zA-Z0-9-]{1,80}$/.test(action.workspaceId)))throw new Error('Choose one widget and an existing destination workspace. Nothing was changed.');
  if(action.type!=='set_shortcut'&&action.shortcut!==undefined)throw new Error('Shortcut data is supported only for shortcut actions. Nothing was changed.');
  if(action.type!=='move_widget'&&action.type!=='set_course_environment'&&action.workspaceId!==undefined)throw new Error('A destination workspace is supported only for widget moves. Nothing was changed.');
  if(action.title!==undefined&&(action.type!=='add_widget'&&action.type!=='create_note_document'&&action.type!=='edit_widget'&&action.type!=='rename_workspace'&&action.type!=='create_workspace'||typeof action.title!=='string'||!action.title.trim()||action.title.length>60))throw new Error('Invalid names: use between 1 and 60 characters. Nothing was changed.');
  if(action.text!==undefined&&(action.type!=='add_widget'&&action.type!=='create_note_document'&&action.type!=='edit_widget'||typeof action.text!=='string'||action.text.length>12000||action.type==='add_widget'&&action.ids.some(id=>id!=='notes')))throw new Error('Text changes are supported only for Notes widgets, up to 12,000 characters. Nothing was changed.');
  if(action.type==='create_note_document'&&(action.ids.length!==1||action.title===undefined))throw new Error('Choose one Notes widget and a title for the new document. Nothing was changed.');
  if((action.type==='open_note_document'||action.type==='close_note_document')&&action.ids.length!==2)throw new Error('Choose one Notes widget and one existing note document. Nothing was changed.');
  if(action.schedule!==undefined&&(action.type!=='edit_widget'||!Array.isArray(action.schedule)||action.schedule.length>80||action.schedule.some(entry=>!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(entry.id)||!Number.isInteger(entry.day)||entry.day<0||entry.day>6||typeof entry.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>80||typeof entry.location!=='string'||entry.location.length>100||entry.autoOpen!==undefined&&typeof entry.autoOpen!=='boolean')||new Set(action.schedule.map(entry=>entry.id)).size!==action.schedule.length))throw new Error('Timetable edits need up to 80 valid entries with a day, time, class name, and location. Nothing was changed.');
  if(action.tagColor!==undefined&&(action.type!=='edit_widget'||action.tagColor!=='none'&&!widgetTagColors.includes(action.tagColor as typeof widgetTagColors[number])))throw new Error('Choose a valid widget tag color. Nothing was changed.');
  if(action.pluginControls!==undefined&&(action.type!=='edit_widget'||!Array.isArray(action.pluginControls)||action.pluginControls.length>20||action.pluginControls.some(id=>!['widget-relaunch.global-mode','widget-relaunch.tag-colors','screenshot.settings','clock-timer.settings'].includes(id))))throw new Error('Tag Color Status can use only supported widget plugin controls. Nothing was changed.');
  if(action.type==='edit_widget'&&action.title===undefined&&action.text===undefined&&action.schedule===undefined&&action.tagColor===undefined&&action.pluginControls===undefined&&action.noteFont===undefined&&action.noteFontSize===undefined&&action.noteTags===undefined)throw new Error('Choose a widget field to edit. Nothing was changed.');
  if(action.type==='set_widget_plugin'&&(!['clock-timer','lock'].includes(action.plugin??'')||typeof action.enabled!=='boolean'||action.plugin==='lock'&&action.enabled&&action.locked!==undefined&&typeof action.locked!=='boolean'||action.plugin!=='lock'&&action.locked!==undefined))throw new Error('Choose a supported widget plugin and turn it on or off. Nothing was changed.');
  if(action.type==='set_sidebar_plugin'&&(action.ids.some(id=>!['stack','layout'].includes(id))||typeof action.enabled!=='boolean'||action.plugin!==undefined))throw new Error('Choose Stack or Layout and turn it on or off. Nothing was changed.');
  if(action.type==='set_course_environment'&&(action.ids.length!==2||typeof action.enabled!=='boolean'||action.enabled&&(!action.workspaceId||!/^[a-zA-Z0-9-]{1,80}$/.test(action.workspaceId))||!action.enabled&&action.workspaceId!==undefined||action.plugin!==undefined||action.locked!==undefined))throw new Error('Choose one course and an existing environment.');
  if(action.type==='set_course_auto_open'&&(action.ids.length!==2||typeof action.enabled!=='boolean'||action.plugin!==undefined||action.locked!==undefined))throw new Error('Choose one course and set automatic opening on or off.');
  if(action.type==='set_ui_visibility'&&(action.ids.length!==1||!['sidebar','apps-bar'].includes(action.ids[0])||typeof action.enabled!=='boolean'||action.plugin!==undefined))throw new Error('Choose the Still sidebar or Apps bar and set it visible or hidden. Nothing was changed.');
  if(action.type==='open_settings'&&(action.ids.length!==1||!['general','appearance','plugins'].includes(action.ids[0])))throw new Error('Choose a Still settings page. Nothing was changed.');
  if(action.type==='set_setting'&&(action.ids.length!==1||!isSupportedSettingValue(action.ids[0],action.settingValue)))throw new Error('Choose a supported Still setting and value. Nothing was changed.');
  if(action.type!=='set_widget_plugin'&&action.type!=='set_sidebar_plugin'&&action.type!=='set_ui_visibility'&&action.type!=='set_course_auto_open'&&action.type!=='set_course_environment'&&(action.plugin!==undefined||action.enabled!==undefined||action.locked!==undefined)||action.type==='set_sidebar_plugin'&&action.locked!==undefined||action.type==='set_ui_visibility'&&action.locked!==undefined)throw new Error('Plugin settings are supported only for plugin actions. Nothing was changed.');
  if(action.type==='rename_workspace'&&(action.ids.length!==1||action.title===undefined))throw new Error('Choose one workspace name to save. Nothing was changed.');
  if(action.type==='create_workspace'&&(action.title===undefined||action.ids.length>MAX_ASSISTANT_BATCH||action.ids.some(id=>!widgetTypes.includes(id as WidgetType))))throw new Error('Choose a name and at most 10 valid starting widgets for the new workspace. Nothing was changed.');
  if(action.type==='switch_workspace'&&action.ids.length!==1)throw new Error('Choose exactly one workspace to switch to. Nothing was changed.');
  if(action.type==='undo'&&action.ids.length!==1)throw new Error('Choose the current workspace before undoing its latest change. Nothing was changed.');
  if((action.type==='set_shortcut'||action.type==='run_tutorial')&&action.ids.length!==1)throw new Error('These controls must be requested one at a time. Nothing was changed.');
  if(action.type!=='add_widget'&&action.type!=='create_note_document'&&action.type!=='edit_widget'&&action.type!=='rename_workspace'&&action.type!=='create_workspace'&&(action.title!==undefined||action.text!==undefined||action.schedule!==undefined||action.tagColor!==undefined||action.pluginControls!==undefined||action.noteFont!==undefined||action.noteFontSize!==undefined||action.noteTags!==undefined||action.noteDocumentId!==undefined))throw new Error('These fields are supported only for widget editing. Nothing was changed.');
  if(action.type!=='set_setting'&&action.settingValue!==undefined)throw new Error('A setting value is supported only for setting actions. Nothing was changed.');
}
const assistantSettings:Record<string,string[]>={
  theme:['light','dark'],density:['comfortable','compact'],background:['solid','dots','transparent'],appearance:['minimal','liquid-glass'],canvasFrameRate:['30','60','display'],followWidgetToWorkspace:['on','off'],autoOpenCourseEnvironments:['on','off'],locale:['en','zh-CN'],
  glassOpacity:Array.from({length:46},(_,index)=>String(index+45)),glassBackgroundEffect:['liquid-chrome','line-waves','wave-wallpaper'],
  appShutdownBehavior:['minimize','close','leaveOpen'],launchAtSignIn:['on','off'],closeAppOnWidgetClose:['on','off'],saveAppShortcutsOnAttach:['on','off'],showAppAttachAction:['on','off'],showAppDetachAction:['on','off'],showAppSaveAction:['on','off'],showWidgetExportPngAction:['on','off'],passThroughTransparentBackground:['on','off'],enableWholeWindowClickThrough:['on','off'],
  widgetRelaunchMode:['automatic','manual'],widgetRelaunchPluginStatus:['enabled','disabled','removed'],screenshotPluginMode:['global','tag-colors','off'],clockPluginMode:['global','tag-colors','off'],
  ...Object.fromEntries(widgetTagColors.flatMap(color=>[[`widgetRelaunchColor-${color}`,['follow','automatic','manual']],[`screenshotPluginColor-${color}`,['on','off']],[`screenshotPluginOverride-${color}`,['follow','on','off']],[`clockPluginColor-${color}`,['on','off']],[`clockPluginOverride-${color}`,['follow','on','off']]])),
};
function isSupportedSettingValue(key:string,value:unknown):value is string{return Object.hasOwn(assistantSettings,key)&&typeof value==='string'&&assistantSettings[key].includes(value)}
function isQuestionOrExplanation(text:string):boolean{
  const prompt=text.trim();
  return !prompt||/\b(?:don't|do not|never)\s+(?:add|make|create|build|insert|spawn|open|remove|delete|close|enable|disable|turn on|turn off|set|change)\b/i.test(prompt)||/^(?:what|why|how|where|when|which)\b/i.test(prompt)||/^(?:please\s+)?(?:write|draft|summari[sz]e|translate|research|compare|discuss|explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt)||/^(?:can|could|would) you (?:write|draft|summari[sz]e|translate|research|compare|discuss|explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt)||/^(?:can|could|would) you (?:edit|modify|change|update|rename)\s+(?:(?:the|this|that)\s+)?(?:widget|card|notes?|timetable|schedule|workspace|it|this|that)[?.!]*$/i.test(prompt)||/^(?:can|could|would) you make (?:an?\s+)?(?:edit|change|modification)s?\b/i.test(prompt)||/^(?:(?:can|could|would) you\s+)?make edits? to (?:the\s+)?(?:timetable|schedule|notes?|widget|workspace)\b/i.test(prompt);
}
export function assistantRemovedControlReply(text:string):string|null{
  if(isQuestionOrExplanation(text))return null;
  return /\b(?:enable|disable|show|hide|turn on|turn off)\b[\s\S]{0,40}\b(?:relaunch|reopen)\s+button\b/i.test(text)?'The widget reopen button has been removed, so there is no setting for it to change.':null;
}
const TIMER_DURATION=/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i;
export function extractAssistantTimerSeconds(text:string):number|null{
  const match=text.match(TIMER_DURATION);
  if(!match)return null;
  const unit=match[2].toLowerCase(),multiplier=/^(?:s|sec|secs|second|seconds)$/.test(unit)?1:/^(?:m|min|mins|minute|minutes)$/.test(unit)?60:3600;
  const seconds=Number(match[1])*multiplier;
  return Number.isSafeInteger(seconds)&&seconds>=1&&seconds<=31536000?seconds:null;
}
export function assistantTimerStartRequested(text:string):boolean{
  return !isQuestionOrExplanation(text)&&/^(?:(?:please|can you|could you|would you|will you|i want you to|i'd like you to)\s+)*(?:set(?:\s+up)?|setup|start|begin|make|create)\s+(?:(?:a|an|the|my|new)\s+)*(?:\d+(?:\.\d+)?\s*[a-z]+[- ]+)?(?:focus(?:\s+\d+)?\s+)?timer\b/i.test(text.trim());
}
export function resolveAssistantTimerDurationReply(request:string,reply:string):string|null{
  const match=reply.trim().match(/^(?:for\s+)?(\d+(?:\.\d+)?|[a-z][a-z -]{0,40}?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)(?:\s+please)?[.!]?$/i);
  if(!match)return null;
  const amount=/^\d/.test(match[1])?Number(match[1]):parseAssistantCount(match[1]);
  if(amount===null)return null;
  const seconds=extractAssistantTimerSeconds(`${amount} ${match[2]}`);
  if(seconds===null)return null;
  return TIMER_DURATION.test(request)?request.replace(TIMER_DURATION,`${seconds} seconds`):`${request.replace(/[.!?]+$/,'')} for ${seconds} seconds`;
}
function requestedTimerOperation(text:string):AssistantAction['operation']|null{
  if(/\b(?:pause|stop)\b/i.test(text))return 'pause';
  if(/\b(?:resume|continue)\b/i.test(text))return 'resume';
  if(/\b(?:reset|restart)\b/i.test(text))return 'reset';
  return null;
}
function assistantTimerTargets(text:string,workspace:Workspace,selectedWidgetIds:string[]){
  const timers=workspace.widgets.filter(widget=>widget.type==='focus'||widget.clockPluginEnabled);
  const focusNumber=text.match(/\bfocus\s+(\d+)\b(?!\s*(?:seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b)/i);
  if(focusNumber)return timers.filter(widget=>widgetLabel(widget).toLocaleLowerCase()===`focus ${focusNumber[1]}`);
  const named=timers.filter(widget=>text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
  if(named.length)return named;
  if(selectedWidgetIds.length)return timers.filter(widget=>selectedWidgetIds.includes(widget.id));
  return /\bfocus\b/i.test(text)?timers.filter(widget=>widget.type==='focus'):timers;
}
export function assistantTimerControlClarification(text:string,workspace:Workspace,selectedWidgetIds:string[]=[]):string|null{
  const actions=assistantActionRequest(text);
  const operation=actions.includes('control_timer')?requestedTimerOperation(text):actions.length===1&&actions[0]==='set_timer'?'start':null;
  if(!operation)return null;
  const candidates=assistantTimerTargets(text,workspace,selectedWidgetIds);
  if(!candidates.length&&(operation!=='start'||selectedWidgetIds.length||/\bfocus\b/i.test(text)))return 'I couldn’t find the requested timer in this workspace. Choose a Focus widget or a widget with the Clock timer enabled.';
  if(candidates.length>1)return `Which timer should I ${operation}? I found ${candidates.slice(0,8).map(widgetLabel).join(', ')}. Please choose one; I control one timer at a time.`;
  return null;
}
function isNotesStyleRequest(text:string):boolean{
  const mentionsNotes=/\bnotes?\b/i.test(text),style=/\b(?:font|typeface|text\s+(?:size|larger|bigger|smaller)|sans(?:[- ]serif)?|serif|mono(?:space)?)\b/i.test(text);
  return mentionsNotes&&style;
}
function isNotesTagRequest(text:string):boolean{
  return /\b(?:add|remove|delete|clear)\s+(?:the\s+)?(?:tag|tags)\b/i.test(text)||/\b(?:tag|tags)\b[\s\S]{0,35}\b(?:to|on|from|in)\s+(?:this|the|my)?\s*notes?\b/i.test(text);
}
function requestedNotesStyle(text:string,widget:WidgetInstance):Pick<AssistantAction,'noteFont'|'noteFontSize'>|null{
  const style:Pick<AssistantAction,'noteFont'|'noteFontSize'>={};
  if(/\b(?:font|typeface)\b/i.test(text)){
    const font=text.match(/\b(sans(?:[- ]serif)?|serif|mono(?:space)?)\b/i)?.[1]?.toLowerCase();
    if(font)style.noteFont=font.startsWith('sans')?'sans':font.startsWith('mono')?'mono':'serif';
  }
  if(/\b(?:font\s*size|text\s*size|notes?\s+size)\b/i.test(text)||/\b(?:larger|bigger|smaller)\b/i.test(text)){
    const explicit=text.match(/\b(?:font\s*size|text\s*size|notes?\s+size)\b[\s\S]{0,28}?\b(?:to\s+)?(\d{1,2})\s*(?:px|pixels?)?\b/i)?.[1]??text.match(/\b(\d{1,2})\s*px\b/i)?.[1];
    const size=explicit?Number(explicit):/\b(?:larger|bigger)\b/i.test(text)?widget.noteFontSize+2:/\bsmaller\b/i.test(text)?widget.noteFontSize-2:NaN;
    if([12,14,16,18,20,24,28].includes(size))style.noteFontSize=size;
  }
  return Object.keys(style).length?style:null;
}
function notesStyleTargets(text:string,workspace:Workspace,selectedWidgetIds:string[]):WidgetInstance[]{
  const notes=workspace.widgets.filter(widget=>widget.type==='notes'),named=notes.filter(widget=>widget.title.trim()&&text.toLocaleLowerCase().includes(widget.title.trim().toLocaleLowerCase()));
  if(named.length)return named;
  const selected=notes.filter(widget=>selectedWidgetIds.includes(widget.id));
  if(selected.length)return selected;
  return notes;
}
export function assistantNoteStyleClarification(text:string,workspace:Workspace,selectedWidgetIds:string[]=[]):string|null{
  if(!isNotesStyleRequest(text))return null;
  const targets=notesStyleTargets(text,workspace,selectedWidgetIds);
  if(!targets.length)return 'There is no Notes widget in this workspace to format. Add a Notes widget first.';
  if(targets.length>1)return `Which Notes widget should I format? I found ${targets.slice(0,8).map(widgetLabel).join(', ')}. Please choose one.`;
  if(!requestedNotesStyle(text,targets[0]))return 'Which font or text size should I use? Choose Sans serif, Serif, or Monospace, or a text size of 12, 14, 16, 18, 20, 24, or 28px.';
  return null;
}
export function assistantNoteTagClarification(text:string,workspace:Workspace,selectedWidgetIds:string[]=[]):string|null{
  if(!isNotesTagRequest(text))return null;
  const notes=workspace.widgets.filter(widget=>widget.type==='notes'),named=notes.filter(widget=>widget.title.trim()&&text.toLocaleLowerCase().includes(widget.title.trim().toLocaleLowerCase())),selected=notes.filter(widget=>selectedWidgetIds.includes(widget.id)),targets=named.length?named:selected.length?selected:notes;
  if(!targets.length)return 'There is no Notes widget in this workspace yet. Add one first, then I can tag its note.';
  if(targets.length!==1)return `Which Notes widget should I tag? I found ${targets.slice(0,8).map(widgetLabel).join(', ')}.`;
  const docs=targets[0].noteDocuments,matching=docs.filter(document=>document.title.trim()&&text.toLocaleLowerCase().includes(document.title.trim().toLocaleLowerCase()));
  if(matching.length>1)return `Which note should I tag in ${widgetLabel(targets[0])}? I found more than one match.`;
  if(!docs.length)return `There are no note documents in ${widgetLabel(targets[0])} to tag.`;
  if(!matching.length&&docs.length>1&&!/\b(?:this|current|active)\s+note\b/i.test(text))return `Which note in ${widgetLabel(targets[0])} should I tag? Open notes: ${docs.map(document=>document.title||'Untitled note').slice(0,8).join(', ')}.`;
  return null;
}
export function resolveAssistantSetting(text:string):{key:string;value:string}|null{
  const prompt=text.trim().replace(/[.!?]+$/,'');
  const patterns:[RegExp,string,(value:string)=>string|null][]=[
    [/\b(?:set|change|switch)\s+(?:the\s+)?(?:colour|color\s+)?(?:theme|colour mode|color mode)\s+(?:to\s+)?(light|dark)(?:\s+mode)?\b/i,'theme',value=>value.toLowerCase()],
    [/\b(?:set|change|switch)\s+(?:the\s+)?appearance\s+(?:to\s+)?(minimal|liquid\s+glass|glass)\b/i,'appearance',value=>/minimal/i.test(value)?'minimal':'liquid-glass'],
    [/\b(?:set|change|make)\s+(?:the\s+)?background\s+(?:to\s+)?(solid|dots?|transparent)\b/i,'background',value=>value.toLowerCase().startsWith('dot')?'dots':value.toLowerCase()],
    [/\b(?:set|change)\s+(?:the\s+)?(?:spacing|density)\s+(?:to\s+)?(comfortable|compact)\b/i,'density',value=>value.toLowerCase()],
    [/\b(?:set|change)\s+(?:the\s+)?(?:motion|frame)\s+rate\s+(?:to\s+)?(30|60|display refresh|smoothest)(?:\s*fps)?\b/i,'canvasFrameRate',value=>value==='30'||value==='60'?value:'display'],
    [/\b(?:set|change)\s+(?:the\s+)?language\s+(?:to\s+)?(english|simplified chinese|chinese)\b/i,'locale',value=>/^english$/i.test(value)?'en':'zh-CN'],
    [/\b(?:turn|switch)\s+(?:the\s+)?(?:follow widget to workspace|workspace following)\s+(on|off)\b/i,'followWidgetToWorkspace',value=>value.toLowerCase()],
    [/\b(?:set|change)\s+(?:the\s+)?(?:(?:liquid\s+)?glass\s+)?opacity\s+(?:to\s+)?(\d{2})\s*%?\b/i,'glassOpacity',value=>value],
    [/\b(?:set|change)\s+(?:the\s+)?background\s+effect\s+(?:to\s+)?(liquid\s+chrome|line\s*waves?|wave\s+wallpaper|wave\s+metal)\b/i,'glassBackgroundEffect',value=>/line\s*waves?/i.test(value)?'line-waves':/wave\s+(?:wallpaper|metal)/i.test(value)?'wave-wallpaper':'liquid-chrome'],
    [/\b(?:set|change)\s+(?:the\s+)?(?:when still closes|still closing|attached app close behavior)\s+(?:to\s+)?(minimize(?: attached apps)?|close(?: attached apps)?|leave(?: attached apps)? open)\b/i,'appShutdownBehavior',value=>/^minimize/i.test(value)?'minimize':/^close/i.test(value)?'close':'leaveOpen'],
    [/\b(close|minimize|leave) attached apps? when still closes\b/i,'appShutdownBehavior',value=>value.toLowerCase()==='minimize'?'minimize':value.toLowerCase()==='close'?'close':'leaveOpen'],
    [/\b(?:set|change)\s+(?:still )?(?:launch at|start at|open at)\s+(?:windows )?sign[- ]?in\s+(on|off|enabled|disabled)\b/i,'launchAtSignIn',value=>/on|enabled/i.test(value)?'on':'off'],
    [/\b(?:launch|start|open) still (?:automatically )?(?:at|when) (?:windows )?sign[- ]?in\b/i,'launchAtSignIn',()=> 'on'],
    [/\b(?:launch|start|open) still (?:automatically )?(?:at|when) (?:windows )?sign[- ]?in\s+(on|off|enabled|disabled)\b/i,'launchAtSignIn',value=>/on|enabled/i.test(value)?'on':'off'],
    [/\b(?:when an? apps? widget closes?,?\s*)?(close the app too|leave (?:the )?app open|keep (?:the )?app open)\b/i,'closeAppOnWidgetClose',value=>/close the app/i.test(value)?'on':'off'],
    [/\b(?:set|change)\s+(?:the\s+)?(?:widget relaunch|automatic relaunch)\s+(?:mode\s+)?(?:to\s+)?(automatic|manual)\b/i,'widgetRelaunchMode',value=>value.toLowerCase()],
    [/\b(enable|disable|remove)\s+(?:the\s+)?widget relaunch plugin\b/i,'widgetRelaunchPluginStatus',value=>value.toLowerCase()==='enable'?'enabled':value.toLowerCase()==='remove'?'removed':'disabled'],
    [/\b(?:set|change)\s+(?:the\s+)?(?:screenshot|camera) plugin mode\s+(?:to\s+)?(global|tag[- ]colors?|off)\b/i,'screenshotPluginMode',value=>/tag/i.test(value)?'tag-colors':value.toLowerCase()],
    [/\b(?:set|change)\s+(?:the\s+)?clock plugin mode\s+(?:to\s+)?(global|tag[- ]colors?|off)\b/i,'clockPluginMode',value=>/tag/i.test(value)?'tag-colors':value.toLowerCase()],
  ];
  for(const [pattern,key,normalize] of patterns){const match=prompt.match(pattern);if(match){const value=normalize(match[1]);return value&&isSupportedSettingValue(key,value)?{key,value}:null}}
  const toggled=prompt.match(/\b(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(.+?)\s*$/i),enabled=prompt.match(/\b(enable|disable)\s+(?:the\s+)?(.+?)\s*$/i),toggle=toggled??enabled;
  if(toggle){const verb=toggle[1].toLowerCase(),label=toggle[2].toLowerCase().replace(/\s+/g,' ').trim(),value=verb==='on'||verb==='enable'?'on':'off';let key:string|null=null;
    if(/^(?:automatic course environments|automatic(?:ally)? open(?:ing)? (?:linked )?course environments)$/.test(label))key='autoOpenCourseEnvironments';
    else if(/\b(?:launch|start|open) still\b[\s\S]*\bsign[- ]?in\b|\b(?:launch|start|open) at (?:windows )?sign[- ]?in\b|^still (?:at|when) (?:windows )?sign[- ]?in\b/.test(label))key='launchAtSignIn';
    else if(/save (?:app )?shortcut on attach/.test(label))key='saveAppShortcutsOnAttach';
    else if(/attach button/.test(label))key='showAppAttachAction';else if(/detach button/.test(label))key='showAppDetachAction';else if(/save(?: to tray)? button/.test(label))key='showAppSaveAction';else if(/export(?: png)? button/.test(label))key='showWidgetExportPngAction';
    else if(/transparent (?:background )?clicks?/.test(label))key='passThroughTransparentBackground';else if(/whole window click through/.test(label))key='enableWholeWindowClickThrough';
    if(key)return{key,value};
  }
  const colorRule=prompt.match(/\b(?:set|change)\s+(red|orange|yellow|green|blue|purple|gray)\s+tag\s+(?:widget\s+)?relaunch\s+(?:behavior|mode)\s+(?:to\s+)?(follow global|follow|automatic|manual)\b/i);
  if(colorRule){const key=`widgetRelaunchColor-${colorRule[1].toLowerCase()}`,value=/follow/i.test(colorRule[2])?'follow':colorRule[2].toLowerCase();return isSupportedSettingValue(key,value)?{key,value}:null}
  const overrideRule=prompt.match(/\b(?:set|change)\s+(red|orange|yellow|green|blue|purple|gray)\s+(screenshot|camera|clock)\s+(?:plugin\s+)?(?:override|setting)\s+(?:to\s+)?(follow|on|off|enabled|disabled)\b/i);
  if(overrideRule){const key=`${overrideRule[2].toLowerCase()==='clock'?'clockPluginOverride':'screenshotPluginOverride'}-${overrideRule[1].toLowerCase()}`,value=/follow/i.test(overrideRule[3])?'follow':/on|enabled/i.test(overrideRule[3])?'on':'off';return isSupportedSettingValue(key,value)?{key,value}:null}
  const pluginColorSet=prompt.match(/\b(?:set|change)\s+(red|orange|yellow|green|blue|purple|gray)\s+(screenshot|camera|clock)\s+(?:button|control|plugin)\s+(?:to\s+)?(on|off|enabled|disabled)\b/i);
  if(pluginColorSet){const key=`${pluginColorSet[2].toLowerCase()==='clock'?'clockPluginColor':'screenshotPluginColor'}-${pluginColorSet[1].toLowerCase()}`,value=/on|enabled/i.test(pluginColorSet[3])?'on':'off';return isSupportedSettingValue(key,value)?{key,value}:null}
  const pluginColor=prompt.match(/\b(?:turn|switch)\s+(on|off)\s+(red|orange|yellow|green|blue|purple|gray)\s+(screenshot|camera|clock)\s+(?:button|control|plugin)\b/i);
  if(pluginColor){const key=`${pluginColor[3].toLowerCase()==='clock'?'clockPluginColor':'screenshotPluginColor'}-${pluginColor[2].toLowerCase()}`,value=pluginColor[1].toLowerCase();return{key,value}}
  return null;
}
function isAssistantSettingRequest(text:string):boolean{return !!resolveAssistantSetting(text)||/\b(?:set|change|switch|turn on|turn off|enable|disable|remove|close|minimize|leave|launch|start|open)\b[\s\S]{0,90}\b(?:theme|colour mode|color mode|appearance|background|opacity|glass|spacing|density|motion rate|frame rate|language|follow widget to workspace|relaunch|attached apps?|apps? widget|attach button|detach button|save button|relaunch button|export button|transparent clicks|click through|screenshot plugin|clock plugin|sign[- ]?in)\b/i.test(text)}
function assistantWorkspaceName(text:string):string|null{
  const match=text.match(/\b(?:workspace|space)\s+(?:named|called|to)\s+["'“]?([\s\S]+?)\s*["'”]?[.!?]*$/i);
  const name=match?.[1]?.split(/\s+(?:with|including)\b/i)[0]?.trim();
  return name&&name.length<=60?name:null;
}
function resolveWorkspaceTarget(text:string,workspaces:AssistantWorkspaceChoice[]):AssistantWorkspaceChoice|null{
  const target=text.match(/\b(?:switch|change)\s+(?:the\s+)?workspace\s+(?:to|into)\s+(.+?)\s*[.!?]*$/i)?.[1]
    ??text.match(/\b(?:switch|go|move|open|select|activate)\s+(?:me\s+)?(?:to\s+)?(?:the\s+)?(.+?)\s+workspace\s*[.!?]*$/i)?.[1]
    ??text.match(/\b(?:go|switch)\s+to\s+(?:the\s+)?workspace\s+(.+?)\s*[.!?]*$/i)?.[1];
  const name=target?.trim().replace(/^["'“]|["'”]$/g,'').trim();
  if(name){const matches=workspaces.filter(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase());return matches.length===1?matches[0]:null;}
  const normalized=text.trim().replace(/[.!?]+$/,'').toLocaleLowerCase();
  const named=workspaces.filter(item=>new RegExp(`^(?:please\\s+)?(?:switch|change|go|move|open|select|activate)\\s+(?:to\\s+)?(?:the\\s+)?${item.name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*$`,'i').test(normalized));
  return named.length===1?named[0]:null;
}
function resolveAssistantMoveDestination(text:string,workspaces:AssistantWorkspaceChoice[]):AssistantWorkspaceChoice|null{
  const prompt=text.trim();
  const matches=workspaces.filter(item=>new RegExp(`\\b(?:to|into)\\s+(?:(?:the\\s+)?(?:workspace|space)\\s+)?(?:the\\s+)?${item.name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\s+(?:workspace|space))?\\s*[.!?]*$`,'i').test(prompt));
  return matches.length===1?matches[0]:null;
}
function assistantMoveRequested(text:string,workspaces:AssistantWorkspaceChoice[]):boolean{
  return /^\s*(?:please\s+)?move\b/i.test(text)&&/\b(?:widget|card|notes?|focus|timer|calculator|apps?|files?|timetable|group|assistant|it|this|that|selected)\b/i.test(text)&&/\b(?:to|into)\b[\s\S]{0,100}\b(?:workspace|space)\b/i.test(text)||/^\s*(?:please\s+)?move\b/i.test(text)&&!!resolveAssistantMoveDestination(text,workspaces)&&widgetTypes.some(type=>widgetNameMentioned(text,type));
}
function resolveAssistantMove(text:string,workspace:Workspace,selectedWidgetIds:string[],workspaces:AssistantWorkspaceChoice[]):AssistantAction|null{
  const target=resolveAssistantMoveDestination(text,workspaces);if(!target||target.id===workspace.id)return null;
  const all=/\b(?:all|every|each)\b/i.test(text),selected=workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id));
  const types=widgetTypes.filter(type=>widgetNameMentioned(text,type)),named=workspace.widgets.filter(widget=>types.includes(widget.type)||text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
  const candidates=all?workspace.widgets:named.length?named:selected;
  if(candidates.length!==1||candidates[0].type==='apps'&&candidates[0].appPanelOpen)return null;
  return {type:'move_widget',ids:[candidates[0].id],workspaceId:target.id};
}
export function assistantWorkspaceClarification(text:string,workspaces:AssistantWorkspaceChoice[]=[]):string|null{
  const requested=assistantActionRequest(text,[],workspaces);
  if(requested.includes('create_workspace')&&!assistantWorkspaceName(text))return 'What would you like to name the new workspace? I will leave it unchanged until you tell me.';
  if(requested.includes('switch_workspace')&&!resolveWorkspaceTarget(text,workspaces)){const names=workspaces.map(item=>item.name);const list=names.length?` Available workspaces: ${names.join(', ')}.`:'';return `Which workspace should I switch to? Tell me its name and I will leave the current workspace unchanged until I know the target.${list}`;}
  return null;
}
export function assistantNoteDocumentClarification(text:string,workspace:Workspace,selectedWidgetIds:string[]=[]):string|null{
  const requested=assistantActionRequest(text),opensDocument=requested.includes('open_note_document'),closesDocument=requested.includes('close_note_document');
  if(!opensDocument&&!closesDocument&&!requested.includes('create_note_document'))return null;
  const notes=workspace.widgets.filter(widget=>widget.type==='notes');
  if(!notes.length)return opensDocument?'There is no Notes widget in this workspace yet. Add one first, then I can open a note in it.':closesDocument?'There is no Notes widget in this workspace yet.':'There is no Notes widget in this workspace yet. Add one first, then I can create note files inside it.';
  const selected=notes.filter(widget=>selectedWidgetIds.includes(widget.id));
  const named=notes.filter(widget=>text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
  const targets=selected.length===1?selected:named.length===1?named:notes.length===1?notes:[];
  if(closesDocument&&!targets.length)return 'Which Notes widget contains the note tab you want to close? I found '+notes.slice(0,8).map(widgetLabel).join(', ')+'.';
  if(closesDocument){const documents=targets[0].noteDocuments,titleMatches=documents.filter(document=>document.title&&text.toLocaleLowerCase().includes(document.title.toLocaleLowerCase())),active=documents.find(document=>document.id===targets[0].activeNoteDocumentId)??documents[0],explicitCurrent=/\b(?:this|current|active)\s+(?:note|tab)\b/i.test(text);if(titleMatches.length>1)return 'I found multiple open notes matching that title in '+widgetLabel(targets[0])+'. Which one should I close?';if(titleMatches.length===1||explicitCurrent||documents.length===1)return null;if(!documents.length)return 'There are no open note tabs in '+widgetLabel(targets[0])+'.';return 'Which note tab should I close in '+widgetLabel(targets[0])+'? Open notes: '+documents.map(document=>document.title||'Untitled note').slice(0,8).join(', ')+'. '+(active?'You can say “close the current note” to close the selected tab.':'')}
  if(!targets.length)return opensDocument?`Which Notes widget contains the note? I found ${notes.slice(0,8).map(widgetLabel).join(', ')}. You can also select one with @.`:`Which Notes widget should I put the new note file in? I found ${notes.slice(0,8).map(widgetLabel).join(', ')}. You can also select one with @.`;
  if(opensDocument){const documents=targets[0].noteDocuments,titleMatches=documents.filter(document=>document.title&&text.toLocaleLowerCase().includes(document.title.toLocaleLowerCase())),namesSpecificNote=/\b(?:named|called|titled)\b/i.test(text)||/\b(?!the\b|this\b|that\b|a\b|my\b)[\w'’-]{2,60}\s+note\b/i.test(text);if(titleMatches.length>1)return `I found multiple notes matching that title in ${widgetLabel(targets[0])}. Which one should I open?`;if(titleMatches.length===1)return null;if(!documents.length)return `There are no open note documents in ${widgetLabel(targets[0])} yet.`;if(documents.length===1&&!namesSpecificNote)return null;return `Which note should I open in ${widgetLabel(targets[0])}? Open notes: ${documents.map(document=>document.title||'Untitled note').slice(0,8).join(', ')}.`}
  const amount=assistantRequestedItemCount(text)??1;
  if(targets[0].noteDocuments.length+amount>NOTE_DOCUMENT_LIMIT)return `That Notes widget already has ${targets[0].noteDocuments.length} open documents. It supports up to ${NOTE_DOCUMENT_LIMIT}; close a tab before adding more.`;
  return null;
}
const shortcutTargets:Record<string,typeof ASSISTANT_SHORTCUT_IDS[number]>={
  'previous workspace':'up','next workspace':'down','workspace up':'up','workspace down':'down','up':'up','down':'down','workspace overview':'overview','overview':'overview','click through':'clickThrough','click-through':'clickThrough','command palette':'commandPalette','command search':'commandPalette','undo':'undo',
};
function resolveAssistantShortcut(text:string):{id:typeof ASSISTANT_SHORTCUT_IDS[number];shortcut:Shortcut}|null{
  const match=text.trim().match(/\b(?:shortcut|hotkey|key binding)\b[\s\S]{0,60}?\b(?:for|of|to)\s+(.+?)\s+\b(?:to|as)\s+((?:(?:ctrl|control|alt|shift)\s*\+\s*)+(?:[a-z0-9]|arrow\s*(?:up|down|left|right)|home|end|page\s*(?:up|down)))\s*[.!?]*$/i)
    ??text.trim().match(/\b(?:shortcut|hotkey|key binding)\b\s+((?:(?:ctrl|control|alt|shift)\s*\+\s*)+(?:[a-z0-9]|arrow\s*(?:up|down|left|right)|home|end|page\s*(?:up|down)))\s+for\s+(.+?)[.!?]*$/i)?.slice(0);
  if(!match)return null;
  let target:string,combo:string;
  if(/\b(?:shortcut|hotkey|key binding)\b[\s\S]{0,60}?\b(?:for|of|to)\s+/i.test(text)){target=match[1];combo=match[2]}
  else{combo=match[1];target=match[2]}
  target=target.toLocaleLowerCase().replace(/^(?:the\s+)?(?:workspace\s+)?/,'').trim();
  const workspace=target.match(/^(?:workspace\s*)?(?:#\s*)?(\d)$/);
  const id=workspace?`workspace-${workspace[1]}`:shortcutTargets[target];
  if(!id||!ASSISTANT_SHORTCUT_IDS.includes(id))return null;
  const parts=combo.toLowerCase().replace(/\s+/g,'').split('+'),keyToken=parts.pop()!;
  const modifiers=new Set(parts.map(part=>part==='control'?'ctrl':part));
  if(modifiers.size!==parts.length||parts.some(part=>!['ctrl','control','alt','shift'].includes(part)))return null;
  const key=keyToken.startsWith('arrow')?'Arrow'+keyToken.slice(5,6).toUpperCase()+keyToken.slice(6):keyToken==='pageup'?'PageUp':keyToken==='pagedown'?'PageDown':keyToken.length===1?keyToken.toUpperCase():keyToken[0].toUpperCase()+keyToken.slice(1);
  const shortcut={key,ctrl:modifiers.has('ctrl')||modifiers.has('control'),alt:modifiers.has('alt'),shift:modifiers.has('shift')};
  return shortcutError(shortcut)?null:{id,shortcut};
}
export function assistantShortcutClarification(text:string):string|null{
  if(!assistantActionRequest(text).includes('set_shortcut'))return null;
  return resolveAssistantShortcut(text)?null:'Which Still shortcut should I change, and what key combination should it use? For example: “Set the shortcut for workspace 2 to Ctrl+Alt+K.” I will leave it unchanged until both are clear.';
}
export function updateAssistantShortcut(shortcuts:WorkspaceShortcuts,id:string,value:Shortcut):WorkspaceShortcuts{
  if(!ASSISTANT_SHORTCUT_IDS.includes(id as typeof ASSISTANT_SHORTCUT_IDS[number])||shortcutError(value))throw new Error('Choose one supported shortcut and key combination. Nothing was changed.');
  const next:WorkspaceShortcuts={...shortcuts,numbered:shortcuts.numbered.map(item=>({...item})),minimizeModifiers:{...shortcuts.minimizeModifiers}};
  if(id.startsWith('workspace-'))next.numbered[Number(id.slice('workspace-'.length))-1]={...value};
  else next[id as keyof Omit<WorkspaceShortcuts,'numbered'|'minimizeModifiers'>]={...value};
  const error=shortcutsError(next);if(error)throw new Error(error+' Nothing was changed.');
  return next;
}
export function assistantMoveClarification(text:string,workspace:Workspace,selectedWidgetIds:string[],workspaces:AssistantWorkspaceChoice[]=[]):string|null{
  if(!assistantMoveRequested(text,workspaces))return null;
  const target=resolveAssistantMoveDestination(text,workspaces);
  if(!target){const names=workspaces.filter(item=>item.id!==workspace.id).map(item=>item.name);return `Which workspace should I move it to?${names.length?` Available workspaces: ${names.join(', ')}.`:''} I will leave it where it is until you choose.`}
  const selected=workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id)),types=widgetTypes.filter(type=>widgetNameMentioned(text,type)),named=workspace.widgets.filter(widget=>types.includes(widget.type)||text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase())),candidates=/\b(?:all|every|each)\b/i.test(text)?workspace.widgets:named.length?named:selected;
  if(target.id===workspace.id)return 'That widget is already in this workspace. Choose a different destination workspace.';
  if(candidates.length===0)return `Which widget in ${workspace.name} should I move to ${target.name}? I will leave the workspace unchanged until you identify it.`;
  if(candidates.length>1)return `Which widget should I move to ${target.name}? I found ${candidates.slice(0,8).map(widgetLabel).join(', ')}. Please choose one; I move one at a time.`;
  if(candidates[0].type==='apps'&&candidates[0].appPanelOpen)return 'I can move the workspace card, but I cannot move or control an attached native app window. Close or detach that app first.';
  return null;
}
function courseEnvironmentRequest(text:string):{title:string;destination:string|null}|null{
  const prompt=text.trim().replace(/^@.{1,80}?\s+(?=(?:please|link|unlink)\b)/i,'');
  const link=prompt.match(/^(?:please\s+)?link\s+(?:course\s+)?(.+?)\s+to\s+(?:the\s+)?(.+?)\s+workspace[.!?]*$/i),unlink=prompt.match(/^(?:please\s+)?unlink\s+(?:course\s+)?(.+?)\s+from\s+(?:its|the)\s+(?:course\s+)?environment[.!?]*$/i);
  const clean=(value:string)=>value.trim().replace(/^["'“‘]|["'”’]$/g,'').trim().toLocaleLowerCase();
  return link?{title:clean(link[1]),destination:clean(link[2])}:unlink?{title:clean(unlink[1]),destination:null}:null;
}
function resolveCourseEnvironment(text:string,workspace:Workspace,selectedIds:string[],workspaces:AssistantWorkspaceChoice[]):AssistantAction|null{
  const request=courseEnvironmentRequest(text);if(!request)return null;
  const courses=workspace.widgets.filter(widget=>widget.type==='timetable'&&(!selectedIds.length||selectedIds.includes(widget.id))).flatMap(widget=>widget.schedule.filter(entry=>entry.title.trim().toLocaleLowerCase()===request.title).map(entry=>({widget,entry})));
  const destinations=request.destination===null?[]:workspaces.filter(item=>item.name.trim().toLocaleLowerCase()===request.destination);
  if(courses.length!==1||request.destination!==null&&destinations.length!==1||request.destination===null&&!courses[0].entry.workspaceId)return null;
  return {type:'set_course_environment',ids:[courses[0].widget.id,courses[0].entry.id],enabled:request.destination!==null,...(request.destination!==null?{workspaceId:destinations[0].id}:{})};
}
export function assistantCourseEnvironmentClarification(text:string,workspace:Workspace,selectedIds:string[],workspaces:AssistantWorkspaceChoice[]):string|null{
  return courseEnvironmentRequest(text)&&!resolveCourseEnvironment(text,workspace,selectedIds,workspaces)?'Which course and workspace should I use? Check the exact names and select a Timetable if more than one course matches.':null;
}
function courseAutoOpenRequest(text:string):{title:string;enabled:boolean}|null{
  const prompt=text.trim().replace(/^@.{1,80}?\s+(?=(?:please|can you|could you|would you|enable|disable|turn on|turn off|switch on|switch off)\b)/i,'');
  const match=prompt.match(/^(?:(?:please|can you|could you|would you)\s+)*(enable|disable|turn on|turn off|switch on|switch off)\s+(?:the\s+)?(?:automatic course environments?|automatic(?:ally)? opening|auto[- ]open(?:ing)?|automatic opening of (?:linked )?course environments?)\s+for\s+(.+?)[.!?]*$/i);
  return match?{title:match[2].trim().replace(/^["'“‘]|["'”’]$/g,'').trim().toLocaleLowerCase(),enabled:/^(?:enable|turn on|switch on)$/i.test(match[1])}:null;
}
function resolveCourseAutoOpen(text:string,workspace:Workspace,selectedIds:string[]):AssistantAction|null{
  const request=courseAutoOpenRequest(text);if(!request)return null;
  const matches=workspace.widgets.filter(widget=>widget.type==='timetable'&&(!selectedIds.length||selectedIds.includes(widget.id))).flatMap(widget=>widget.schedule.filter(entry=>entry.workspaceId&&entry.title.trim().toLocaleLowerCase()===request.title).map(entry=>({widget,entry})));
  return matches.length===1?{type:'set_course_auto_open',ids:[matches[0].widget.id,matches[0].entry.id],enabled:request.enabled}:null;
}
export function assistantCourseAutoOpenClarification(text:string,workspace:Workspace,selectedIds:string[]):string|null{
  return courseAutoOpenRequest(text)&&!resolveCourseAutoOpen(text,workspace,selectedIds)?'Which linked course should I change? Use its exact name and select its Timetable if more than one matches.':null;
}
export function assistantActionRequest(text:string,savedTrayItems:AssistantTrayItem[]=[],workspaces:AssistantWorkspaceChoice[]=[]):AssistantActionType[]{
  const prompt=text.trim();
  if(isQuestionOrExplanation(prompt))return [];
  const requested:AssistantActionType[]=[];
  if(courseEnvironmentRequest(prompt))requested.push('set_course_environment');
  if(courseAutoOpenRequest(prompt))requested.push('set_course_auto_open');
  if(isNotesStyleRequest(prompt))requested.push('edit_widget');
  if(isNotesTagRequest(prompt))requested.push('edit_widget');
  if(/\b(?:pause|stop|resume|continue|reset|restart)\b[\s\S]{0,70}\b(?:timer|focus|clock)\b/i.test(prompt)||/\b(?:timer|focus|clock)\b[\s\S]{0,70}\b(?:pause|stop|resume|continue|reset|restart)\b/i.test(prompt))requested.push('control_timer');
  if(/\b(?:make|create|add|write)\b[\s\S]{0,45}\bnotes?\s+(?:files?|documents?)\b/i.test(prompt)||/\b(?:make|create|add)\b[\s\S]{0,35}\b(?:a|an|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:new|blank|empty)\s+)*notes?\b(?!\s+(?:widget|card)\b)[\s\S]{0,50}\b(?:inside|in)\b[\s\S]{0,25}\bnotes?\b/i.test(prompt))requested.push('create_note_document');
  if(/\b(?:open|show|switch to|go to|view)\b[\s\S]{0,60}\bnotes?\s+(?:files?|documents?)\b/i.test(prompt)||/\b(?:open|show|switch to|go to|view)\b[\s\S]{0,50}\b(?:a|the|this|that)\s+note\b/i.test(prompt)||/\b(?:open|show|switch to|go to|view)\b[\s\S]{0,60}\bnote\s+(?:named|called|titled)\b/i.test(prompt)||/\b(?:open|show|switch to|go to|view)\b[\s\S]{0,50}\b[\w'’-]{2,60}\s+note\b/i.test(prompt))requested.push('open_note_document');
  if(/\b(?:create|make|add|new)\s+(?:(?:a|an)\s+)?(?:(?:new|blank|empty)\s+)?workspace\b/i.test(prompt))requested.push('create_workspace');
  if(assistantMoveRequested(prompt,workspaces))requested.push('move_widget');
  if(!requested.includes('create_workspace')&&!requested.includes('move_widget')&&!requested.includes('set_course_environment')&&( /\b(?:switch|change|go|move|open|select|activate)\b[\s\S]{0,50}\b(?:workspace|workspaces|space)\b/i.test(prompt)||!!resolveWorkspaceTarget(prompt,workspaces)))requested.push('switch_workspace');
  if(/^(?:(?:please|can you|could you|would you)\s+)?undo(?:\s+(?:the\s+)?(?:last|previous)?\s*(?:change|action|step))?[.!?]*$/i.test(prompt))requested.push('undo');
  if(/\b(?:run|show|replay|start|open)\b[\s\S]{0,35}\b(?:tutorial|tour|guide)\b/i.test(prompt))requested.push('run_tutorial');
  if(/\b(?:change|set|update|customi[sz]e|assign)\b[\s\S]{0,60}\b(?:shortcut|hotkey|key binding)\b/i.test(prompt)||/\b(?:shortcut|hotkey|key binding)\b[\s\S]{0,60}\b(?:change|set|update|customi[sz]e|assign)\b/i.test(prompt))requested.push('set_shortcut');
  if(/\b(?:hide|collapse|close|show|reveal|open|expand)\b[\s\S]{0,30}\b(?:the\s+)?(?:sidebar|(?:bottom\s+)?apps?\s+bar)\b/i.test(prompt)||/\b(?:sidebar|(?:bottom\s+)?apps?\s+bar)\b[\s\S]{0,30}\b(?:hide|collapse|close|show|reveal|open|expand)\b/i.test(prompt))requested.push('set_ui_visibility');
  if(isAssistantSettingRequest(prompt))requested.push('set_setting');
  if(/\brename\b[\s\S]{0,30}\bworkspace\b[\s\S]{0,20}\b(?:to|as)\s+.+/i.test(prompt))requested.push('rename_workspace');
  if(/\b(?:open|show|go to|view|bring up)\b[\s\S]{0,30}\bsettings?\b/i.test(prompt))requested.push('open_settings');
  if(/\b(?:add|enable|turn on|remove|disable|turn off|install)\b[\s\S]{0,40}\b(?:sidebar\s+)?(?:stack|layout)\s+plugin\b/i.test(prompt)||/\b(?:add|enable|turn on|remove|disable|turn off)\b[\s\S]{0,30}\b(?:stack|layout)\b[\s\S]{0,25}\b(?:to|in)\s+(?:the\s+)?sidebar\b/i.test(prompt)||/^\s*(?:please\s+)?(?:add|enable|turn on|remove|disable|turn off|install)\s+(?:the\s+)?(?:stack|layout)(?:\s+plugin)?[.!]?\s*$/i.test(prompt))requested.push('set_sidebar_plugin');
  if(/\b(?:add|enable|turn on|remove|disable|turn off|install)\b[\s\S]{0,60}\b(?:clock timer|clock|timer|lock) plugin\b/i.test(prompt)||/\b(?:add|enable|turn on|remove|disable|turn off)\b[\s\S]{0,40}\bclock\b[\s\S]{0,30}\b(?:to|on|from)\b/i.test(prompt)||/\b(?:lock|unlock)\b[\s\S]{0,50}\b(?:widget|card|notes?|files?|timetable|calculator|focus|apps?)\b/i.test(prompt))requested.push('set_widget_plugin');
  if(!requested.includes('edit_widget')&&!requested.includes('set_widget_plugin')&&!requested.includes('rename_workspace')&&/\b(?:edit|modify|rewrite|rename|change|update)\b[\s\S]{0,80}\b(?:widget|widgets|card|cards|notes?|focus|timer|calculator|apps?|files?|timetable|schedule|assistant|group|tag color|tag status)\b/i.test(prompt))requested.push('edit_widget');
  if(/\bminimi[sz](?:e|ing)?\b/i.test(prompt))requested.push('minimize');
  if(/\brestore\b/i.test(prompt))requested.push('restore');
  const opensSaved=(/\b(?:open|add|load|bring|reopen)\b[\s\S]{0,100}\b(?:saved|tray|shortcut|widgets?)\b[\s\S]{0,80}\b(?:widgets?|shortcut|group|tray)?\b/i.test(prompt)&&/\b(?:saved|tray|shortcut)\b/i.test(prompt))||savedTrayItems.some(item=>/^\s*(?:please\s+)?(?:open|load|reopen|bring)\b/i.test(prompt)&&prompt.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()));
  if(opensSaved)requested.push('open_saved');
  else if(/\b(?:save|put|move|send|store|copy|add|collect)\b[\s\S]{0,120}\btray\b/i.test(prompt))requested.push('save_to_tray');
  const namedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type));
  if(/\b(?:close|shut)\b[\s\S]{0,60}\b(?:note|document|tab)\b/i.test(prompt)&&!/\b(?:notes?|documents?|tabs?)\s+(?:widget|card)\b/i.test(prompt))requested.push('close_note_document');
  const addressedOpenCreation=/^\s*(?:(?:please|can(?:\s+you)?|could(?:\s+you)?|would(?:\s+you)?)\s+)?open\s+(?:(?:a|an|new|blank|empty)\s+)*(?:[\w'’-]+\s+)*(?:widget|card)\b/i.test(prompt);
  const clearCreation=/^(?:(?:please|can(?:\s+you)?|could(?:\s+you)?|would(?:\s+you)?|will(?:\s+you)?|I want you to|I'd like you to)\s+)*(?:add|create|make|build|insert|spawn|new)\b/i.test(prompt)&&!/\bmake\b[\s\S]*\b(?:smaller|larger|bigger|wider|narrower|shorter|taller|minimi[sz]ed|fullscreen)\b/i.test(prompt)||addressedOpenCreation;
  const createsNoteDocument=requested.includes('create_note_document');
  const addWidgetTypes=createsNoteDocument?namedTypes.filter(type=>type!=='notes'&&(type!=='files'||/\bfiles?\s+(?:widget|card)\b/i.test(prompt))):namedTypes;
  const genericWidgetCreation=!createsNoteDocument&&(/\b(?:add|create|insert|spawn)\b[\s\S]*\b(?:widgets?|cards?)\b/i.test(prompt)||/\b(?:a|an|one|\d+)\s+(?:new\s+)?(?:widgets?|cards?)\b/i.test(prompt));
  const startsTimer=assistantTimerStartRequested(prompt);
  if(!(startsTimer&&addWidgetTypes.every(type=>type==='focus'))&&!isNotesTagRequest(prompt)&&!requested.includes('create_workspace')&&!requested.includes('open_note_document')&&!opensSaved&&!requested.includes('set_widget_plugin')&&!requested.includes('set_sidebar_plugin')&&!requested.includes('rename_workspace')&&clearCreation&&(addWidgetTypes.length||genericWidgetCreation))requested.push('add_widget');
  if(!isNotesTagRequest(prompt)&&!requested.includes('close_note_document')&&!requested.includes('set_widget_plugin')&&!requested.includes('set_setting')&&!unsupportedAssistantRequest(prompt)&&/\b(?:remove|delete|close)\b[\s\S]{0,60}\b(?:widgets?|cards?|notes?|focus|timer|calculator|apps?|files?|timetable|assistant|group)\b/i.test(prompt))requested.push('remove_widget');
  if((startsTimer||/\b(?:set|start|begin)\b[\s\S]{0,40}\btimer\b/i.test(prompt))&&extractAssistantTimerSeconds(prompt)!==null)requested.push('set_timer');
  return [...new Set(requested)];
}
export function assistantCreationClarification(text:string):string|null{
  if(!assistantActionRequest(text).includes('add_widget'))return null;
  const types=widgetTypes.filter(type=>widgetNameMentioned(text,type));
  if(types.length<2)return null;
  const names=types.map(type=>widgetCatalog[type].name);
  const typeList=names.length===2?names[0]+' or '+names[1]:names.slice(0,-1).join(', ')+', or '+names.at(-1);
  const quantity=assistantRequestedItemCount(text);
  const connector=/\b(?:and|or)\b|[,/&]/i.test(text);
  if(quantity!==null||!connector){
    if(types.includes('notes')&&types.includes('files')&&!connector&&/\bnotes?\s+files?\b/i.test(text)){
      const countLabel=assistantRequestedItemCountPhrase(text)??String(quantity??'several');
      return 'Do you mean '+countLabel+' separate note documents in one Notes widget, or '+countLabel+' separate Notes widgets? I will not change anything until you confirm.';
    }
    if(types.includes('notes')&&types.includes('files')){
      const count=quantity??1;
      const plural=count===1?'':'s';
      return 'Do you mean '+count+' Notes widget'+plural+', or '+count+' Files widget'+plural+'? I will not change anything until you confirm.';
    }
    return 'I found more than one possible widget type ('+typeList+'). Which one should I add, and how many? I will not change anything until you confirm.';
  }
  return null;
}
export function assistantEditClarification(text:string):string|null{
  const prompt=text.trim();
  if(assistantResizeRequested(prompt))return null;
  if(assistantActionRequest(prompt).includes('undo'))return null;
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
export function assistantResizeRequested(text:string):boolean{
  const prompt=text.trim().replace(/^@.{1,80}?\s+(?=(?:please|can you|could you|would you|will you|resize|enlarge|shrink|make|set|adjust)\b)/i,'');
  return !isQuestionOrExplanation(prompt)&&!/\b(?:font|text)\b/i.test(prompt)&&/^(?:(?:please|can you|could you|would you|will you)\s+)*(?:resize|enlarge|shrink|make|set|adjust)\b/i.test(prompt)&&(/^(?:(?:please|can you|could you|would you|will you)\s+)*(?:resize|enlarge|shrink)\b/i.test(prompt)||/\b(?:bigger|larger|smaller|wider|narrower|taller|shorter)\b/i.test(prompt));
}
function assistantResizeTargets(text:string,workspace:Workspace,selectedIds:string[]):WidgetInstance[]{
  const available=workspace.widgets.filter(widget=>!widget.minimized),selected=available.filter(widget=>selectedIds.includes(widget.id));
  if(selected.length)return selected;
  const named=available.filter(widget=>text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
  if(named.length)return named;
  const types=widgetTypes.filter(type=>widgetNameMentioned(text,type));
  return types.length?available.filter(widget=>types.includes(widget.type)):available;
}
export function assistantResizeClarification(text:string,workspace:Workspace,selectedIds:string[]):string|null{
  if(!assistantResizeRequested(text))return null;
  return assistantResizeTargets(text,workspace,selectedIds).length===1?null:'Which expanded widget should I resize? Name or select one widget.';
}
export function validateAssistantLayoutIntent(text:string,workspace:Workspace,items:LayoutItem[],selectedIds:string[]):void{
  if(!assistantResizeRequested(text)){
    if(items.some(item=>{const original=workspace.widgets.find(widget=>widget.id===item.id);return original&&(item.width!==original.placement.width||item.height!==original.placement.height)}))throw new Error('The arrangement changed widget sizes without a resize request. Nothing was changed.');
    return;
  }
  const targets=assistantResizeTargets(text,workspace,selectedIds);if(targets.length!==1)throw new Error('Choose one expanded widget to resize. Nothing was changed.');
  const target=targets[0],item=items.find(candidate=>candidate.id===target.id);if(!item)throw new Error('The resize target is missing. Nothing was changed.');
  for(const candidate of items){const original=workspace.widgets.find(widget=>widget.id===candidate.id);if(!original)continue;const p=original.placement;if(candidate.x!==p.x||candidate.y!==p.y||(candidate.id!==target.id&&(candidate.width!==p.width||candidate.height!==p.height)))throw new Error('The resize proposal changed another placement. Nothing was changed.')}
  const p=target.placement;if(item.width===p.width&&item.height===p.height)throw new Error('The proposal did not resize the selected widget.');
  const dimensions=text.match(/\b(\d{2,4})\s*(?:x|×|by)\s*(\d{2,4})\b/i),width=text.match(/\bwidth\s*(?:to|of|=|:)?\s*(\d{2,4})\b/i),height=text.match(/\bheight\s*(?:to|of|=|:)?\s*(\d{2,4})\b/i);
  if(dimensions&&(item.width!==Number(dimensions[1])||item.height!==Number(dimensions[2]))||width&&item.width!==Number(width[1])||height&&item.height!==Number(height[1]))throw new Error('The proposed dimensions do not match your request.');
  if(/\b(?:bigger|larger|enlarge|wider|taller)\b/i.test(text)&&(item.width<p.width||item.height<p.height)||/\b(?:smaller|shrink|narrower|shorter)\b/i.test(text)&&(item.width>p.width||item.height>p.height))throw new Error('The resize proposal changed the size in the opposite direction.');
  if(/\bwider\b/i.test(text)&&item.width<=p.width||/\bnarrower\b/i.test(text)&&item.width>=p.width||/\btaller\b/i.test(text)&&item.height<=p.height||/\bshorter\b/i.test(text)&&item.height>=p.height)throw new Error('The resize proposal did not change the requested dimension.');
}
export function assistantLayoutRequested(text:string):boolean{
  if(isQuestionOrExplanation(text)||unsupportedAssistantRequest(text)||assistantActionRequest(text).length)return false;
  return assistantResizeRequested(text)||/\b(?:arrange|layout|rearrange|organize|organise|snap|tile|reposition)\b/i.test(text)||/\b(?:move|place|position)\b[\s\S]{0,100}\b(?:widget|widgets|card|cards|next to|above|below|left of|right of)\b/i.test(text);
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
export function resolveDirectAssistantActions(text:string,workspace:Workspace,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[],workspaces:AssistantWorkspaceChoice[]=[]):AssistantAction[]|null{
  const types=assistantActionRequest(text,savedTrayItems,workspaces);
  if(!types.length)return null;
  if(types.includes('set_course_environment')){const action=resolveCourseEnvironment(text,workspace,selectedWidgetIds,workspaces);return types.length===1&&action?[action]:null}
  if(types.includes('set_course_auto_open')){const action=resolveCourseAutoOpen(text,workspace,selectedWidgetIds);return types.length===1&&action?[action]:null}
  if(types.includes('set_ui_visibility')){
    if(types.length!==1)return null;
    const sidebar=/\bsidebar\b/i.test(text),appsBar=/\b(?:bottom\s+)?apps?\s+bar\b/i.test(text);
    if(sidebar===appsBar)return null;
    const direction=text.match(/\b(hide|collapse|close|show|reveal|open|expand)\b/ig)?.at(-1)?.toLocaleLowerCase();
    if(!direction)return null;
    return [{type:'set_ui_visibility',ids:[sidebar?'sidebar':'apps-bar'],enabled:['show','reveal','open','expand'].includes(direction)}];
  }
  if(types.includes('minimize')||types.includes('restore')){
    if(types.length!==1)return null;
    const type=types[0] as 'minimize'|'restore',eligible=workspace.widgets.filter(widget=>type==='minimize'?!widget.minimized:widget.minimized),all=/\b(?:all|every|each)\b/i.test(text);
    const named=workspace.widgets.filter(widget=>(widget.title.trim()&&text.toLocaleLowerCase().includes(widget.title.trim().toLocaleLowerCase()))||widgetNameMentioned(text,widget.type));
    const selected=workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id));
    const targets=all?eligible:named.length?named.filter(widget=>eligible.includes(widget)):selected.length?selected.filter(widget=>eligible.includes(widget)):eligible.length===1?eligible:[];
    if(!targets.length||targets.length>MAX_ASSISTANT_BATCH)return null;
    return [{type,ids:targets.map(widget=>widget.id)}];
  }
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
  if(types.includes('create_workspace')){
    if(types.length!==1)return null;
    const name=assistantWorkspaceName(text);if(!name)return null;
    const blank=/\b(?:blank|empty)\s+(?:new\s+)?workspace\b/i.test(text),initialWidgets=blank?[]:widgetTypes.filter(type=>widgetNameMentioned(text,type));
    return [{type:'create_workspace',ids:blank?[]:initialWidgets.length?initialWidgets:['desmos','notes'],title:name}];
  }
  if(types.includes('move_widget')){const move=resolveAssistantMove(text,workspace,selectedWidgetIds,workspaces);return types.length===1&&move?[move]:null}
  if(types.includes('switch_workspace')){
    const target=resolveWorkspaceTarget(text,workspaces);
    return target?[{type:'switch_workspace',ids:[target.id]}]:null;
  }
  if(types.includes('undo'))return [{type:'undo',ids:[workspace.id]}];
  if(types.includes('run_tutorial'))return types.length===1?[{type:'run_tutorial',ids:['tutorial']}]:null;
  if(types.includes('set_shortcut')){const parsed=resolveAssistantShortcut(text);return types.length===1&&parsed?[{type:'set_shortcut',ids:[parsed.id],shortcut:parsed.shortcut}]:null}
  if(types.includes('control_timer')){
    if(types.length!==1)return null;
    const operation=requestedTimerOperation(text);if(!operation)return null;
    const targets=assistantTimerTargets(text,workspace,selectedWidgetIds);
    return targets.length===1?[{type:'control_timer',ids:[targets[0].id],operation}]:null;
  }
  if(types.includes('close_note_document')){
    if(types.length!==1)return null;
    const notes=workspace.widgets.filter(widget=>widget.type==='notes'),namedWidgets=notes.filter(widget=>widget.title.trim()&&text.toLocaleLowerCase().includes(widget.title.trim().toLocaleLowerCase())),selected=notes.filter(widget=>selectedWidgetIds.includes(widget.id)),targets=namedWidgets.length?namedWidgets:selected.length?selected:notes;
    if(targets.length!==1)return null;
    const documents=targets[0].noteDocuments,namedDocs=documents.filter(document=>document.title.trim()&&text.toLocaleLowerCase().includes(document.title.toLocaleLowerCase())),current=documents.find(document=>document.id===targets[0].activeNoteDocumentId)??documents[0],doc=namedDocs.length===1?namedDocs[0]:namedDocs.length===0&&(documents.length===1||/\b(?:this|current|active)\s+(?:note|tab)\b/i.test(text))?current:undefined;
    return doc?[{type:'close_note_document',ids:[targets[0].id,doc.id]}]:null;
  }
  if(types.includes('edit_widget')&&isNotesTagRequest(text)){
    if(types.length!==1)return null;
    const notes=workspace.widgets.filter(widget=>widget.type==='notes'),namedWidgets=notes.filter(widget=>widget.title.trim()&&text.toLocaleLowerCase().includes(widget.title.trim().toLocaleLowerCase())),selected=notes.filter(widget=>selectedWidgetIds.includes(widget.id)),targets=namedWidgets.length?namedWidgets:selected.length?selected:notes;
    if(targets.length!==1)return null;
    const docs=targets[0].noteDocuments,namedDocs=docs.filter(document=>document.title.trim()&&text.toLocaleLowerCase().includes(document.title.trim().toLocaleLowerCase())),doc=namedDocs.length===1?namedDocs[0]:namedDocs.length===0&&(docs.length===1||/\b(?:this|current|active)\s+note\b/i.test(text))?docs.find(item=>item.id===targets[0].activeNoteDocumentId)??docs[0]:undefined;
    if(!doc)return null;
    const clear=/\b(?:clear|remove|delete)\s+(?:all\s+)?tags?\b(?=\s*(?:from\b|in\b|on\b|[.!?]|$))/i.test(text),add=text.match(/\b(?:add|apply)\s+(?:the\s+)?tag\s+["'“#]?([^"'”#\n,]+?)["'”]?\s+(?:to|on)\b/i),remove=text.match(/\b(?:remove|delete)\s+(?:the\s+)?tag\s+["'“#]?([^"'”#\n,]+?)["'”]?\s+from\b/i),withTag=text.match(/\btag\s+(?:this|the|my)\s+note\s+with\s+["'“#]?([^"'”#\n,]+?)["'”]?(?:\s+in\s+.+)?[.!?]*$/i);
    const tag=(add?.[1]??remove?.[1]??withTag?.[1]??'').trim();
    if(clear)return [{type:'edit_widget',ids:[targets[0].id],noteDocumentId:doc.id,noteTags:[]}];
    if(!tag||tag.length>NOTE_TAG_LENGTH_LIMIT)return null;
    const current=checkedNoteTags(doc.tags??[]),existing=current.find(item=>item.toLocaleLowerCase()===tag.toLocaleLowerCase());
    if(remove){if(!existing)return [{type:'edit_widget',ids:[targets[0].id],noteDocumentId:doc.id,noteTags:current}];return [{type:'edit_widget',ids:[targets[0].id],noteDocumentId:doc.id,noteTags:current.filter(item=>item!==existing)}]}
    if(add||withTag)return [{type:'edit_widget',ids:[targets[0].id],noteDocumentId:doc.id,noteTags:existing?current:[...current,tag]}];
    return null;
  }
  if(types.includes('edit_widget')&&isNotesStyleRequest(text)){
    if(types.length!==1)return null;
    const targets=notesStyleTargets(text,workspace,selectedWidgetIds);if(targets.length!==1||targets[0].type!=='notes')return null;
    const style=requestedNotesStyle(text,targets[0]);return style?[{type:'edit_widget',ids:[targets[0].id],...style}]:null;
  }
  if(types.includes('open_settings')){
    const tab=/\b(?:appearance|theme|glass|background)\b/i.test(text)?'appearance':/\bplugin\b/i.test(text)?'plugins':'general';
    return [{type:'open_settings',ids:[tab]}];
  }
  if(types.includes('set_setting')){if(types.length!==1)return null;const setting=resolveAssistantSetting(text);if(!setting)return null;return [{type:'set_setting',ids:[setting.key],settingValue:setting.value}]}
  if(types.includes('set_sidebar_plugin')){
    const plugins=(['stack','layout'] as const).filter(plugin=>new RegExp(`\\b${plugin}\\b`,'i').test(text));
    if(!plugins.length)return null;
    const enabled=!/\b(?:remove|disable|turn off)\b/i.test(text);
    return [{type:'set_sidebar_plugin',ids:[...plugins],enabled}];
  }
  if(types.includes('set_widget_plugin')){
    const plugin:AssistantAction['plugin']=/\b(?:lock|unlock)\b/i.test(text)?'lock':'clock-timer';
    const allWidgets=/\b(?:all|every|each)\b/i.test(text),namedTypes=widgetTypes.filter(type=>widgetNameMentioned(text,type));
    const named=workspace.widgets.filter(widget=>text.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase())),typed=workspace.widgets.filter(widget=>namedTypes.includes(widget.type));
    const eligible=(widgets:WidgetInstance[])=>plugin==='clock-timer'?widgets.filter(widget=>widget.type!=='group'):widgets;
    const targets=eligible(allWidgets?(namedTypes.length?typed:workspace.widgets):selectedWidgetIds.length?workspace.widgets.filter(widget=>selectedWidgetIds.includes(widget.id)):named.length?named:typed);
    if(!targets.length||targets.length>MAX_ASSISTANT_BATCH||!allWidgets&&targets.length!==1)return null;
    const removePlugin=/\b(?:remove|disable|turn off)\b/i.test(text);
    const enabled=plugin==='lock'?!removePlugin:/\b(?:add|enable|turn on|install)\b/i.test(text);
    const locked=plugin==='lock'&&enabled?!/\bunlock\b/i.test(text):undefined;
    return [{type:'set_widget_plugin',ids:targets.map(widget=>widget.id),plugin,enabled,...(locked===undefined?{}:{locked})}];
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
  const targets=workspace.widgets.filter(widget=>all||selected.has(widget.id));
  const seconds=extractAssistantTimerSeconds(text);
  const actions=types.map(type=>{
    if(type==='add_widget'||type==='open_saved')return {type,ids:[]};
    const eligible=type==='save_to_tray'?targets.filter(widget=>widget.type!=='group'):type==='set_timer'?assistantTimerTargets(text,workspace,selectedWidgetIds):targets;
    if(type==='set_timer'&&eligible.length!==1)return {type,ids:[]};
    return {type,ids:eligible.map(widget=>widget.id),...(type==='set_timer'&&seconds!==null?{seconds}:{})};
  }).filter(action=>action.ids.length);
  return actions.length===types.length?actions:null;
}
export function validateAssistantActions(workspace:Workspace,actions:AssistantAction[],savedTrayItems:AssistantTrayItem[]=[],workspaces:AssistantWorkspaceChoice[]=[]):void{
  if(actions.some(action=>action.type==='set_shortcut'||action.type==='run_tutorial'||action.type==='move_widget'||action.type==='control_timer'||action.type==='set_ui_visibility')&&actions.length!==1)throw new Error('Shortcut changes, tutorial controls, timer controls, interface visibility, and workspace moves must be requested one at a time. Nothing was changed.');
  const widgets=new Map(workspace.widgets.map(widget=>[widget.id,widget]));
  const savedItems=new Set(savedTrayItems.map(item=>item.id));
  if(!actions.length)throw new Error('The AI returned no workspace actions. Nothing was changed. Try again.');
  const batchSize=actions.filter(action=>action.type==='add_widget'||action.type==='open_saved').reduce((total,action)=>total+action.ids.length,0);
  if(batchSize>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can add or open at most ${MAX_ASSISTANT_BATCH} items in one request. Nothing was changed.`);
  const changeBatch=actions.filter(action=>action.type==='create_note_document'||action.type==='open_note_document'||action.type==='close_note_document'||action.type==='edit_widget'||action.type==='set_widget_plugin'||action.type==='set_sidebar_plugin').reduce((total,action)=>total+action.ids.length,0);
  if(changeBatch>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can change at most ${MAX_ASSISTANT_BATCH} items in one request. Nothing was changed.`);
  if(actions.some(action=>action.type==='set_setting'&&action.ids[0]==='launchAtSignIn')&&actions.length!==1)throw new Error('Change the Windows sign-in preference separately. Nothing else was changed.');
  if(actions.some(action=>action.type==='set_course_auto_open'||action.type==='set_course_environment')&&actions.length!==1)throw new Error('Change one course environment at a time.');
  for(const action of actions){
    validateAssistantActionFields(action);
    if(action.schedule?.some(entry=>entry.workspaceId!==undefined&&(!/^[a-zA-Z0-9-]{1,80}$/.test(entry.workspaceId)||workspaces.length>0&&!workspaces.some(workspaceChoice=>workspaceChoice.id===entry.workspaceId))))throw new Error('Choose an existing Still workspace for each course environment. Nothing was changed.');
    if(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))throw new Error('Choose a timer duration between one second and one year. Nothing was changed.');
    if((action.type==='add_widget'||action.type==='open_saved')&&action.ids.length>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can change at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`);
    if(action.type==='create_workspace')continue;
    if(action.type==='switch_workspace'){if(action.ids.length!==1||!workspaces.some(item=>item.id===action.ids[0]))throw new Error('That workspace no longer exists. Nothing was changed.');continue;}
    if(action.type==='undo'){if(action.ids.length!==1||action.ids[0]!==workspace.id)throw new Error('Still can undo only the current workspace session from this chat. Nothing was changed.');continue;}
    if(action.type==='move_widget'){const destination=workspaces.find(item=>item.id===action.workspaceId),source=workspace.widgets.find(item=>item.id===action.ids[0]);if(!destination||destination.id===workspace.id)throw new Error('Choose another existing workspace as the move destination. Nothing was changed.');if(!source)throw new Error('That widget is no longer in the active workspace. Nothing was changed.');if(source.lockPluginEnabled&&source.locked)throw new Error('Unlock the widget before moving it. Nothing was changed.');if(source.type==='apps'&&source.appPanelOpen)throw new Error('Close or detach the native app before moving its workspace card. Nothing was changed.');continue;}
    if(action.type==='set_ui_visibility')continue;
    if(action.type==='set_course_environment'){const widget=widgets.get(action.ids[0]),entry=widget?.type==='timetable'?widget.schedule.find(item=>item.id===action.ids[1]):undefined;if(!entry||action.enabled&&workspaces.length>0&&!workspaces.some(item=>item.id===action.workspaceId)||!action.enabled&&!entry.workspaceId)throw new Error('That course or workspace is no longer available. Nothing was changed.');continue}
    if(action.type==='set_course_auto_open'){const widget=widgets.get(action.ids[0]),entry=widget?.type==='timetable'?widget.schedule.find(item=>item.id===action.ids[1]):undefined;if(!entry?.workspaceId||workspaces.length>0&&!workspaces.some(item=>item.id===entry.workspaceId))throw new Error('That course no longer has a linked environment. Nothing was changed.');continue}
    if(action.type==='open_note_document'||action.type==='close_note_document'){const widget=widgets.get(action.ids[0]);if(!widget||widget.type!=='notes')throw new Error('An existing Notes widget is required for this note document action. Nothing was changed.');if(action.ids.length!==2||!widget.noteDocuments.some(document=>document.id===action.ids[1]))throw new Error('That note document is no longer open in this Notes widget. Nothing was changed.');continue;}
    for(const id of action.ids){if(action.type==='add_widget'){if(!widgetTypes.includes(id as WidgetType))throw new Error('Choose a widget type from Still’s built-in gallery. Nothing was changed.');continue}if(action.type==='open_saved'){if(!savedItems.has(id))throw new Error('A saved tray item changed before the action could run. Nothing was changed. Try again.');continue}if(action.type==='rename_workspace'){if(id!==workspace.id)throw new Error('Still can rename only the current workspace from this chat. Nothing was changed.');continue}if(action.type==='set_sidebar_plugin'||action.type==='open_settings'||action.type==='set_setting'||action.type==='set_shortcut'||action.type==='run_tutorial')continue;const widget=widgets.get(id);if(!widget)throw new Error('A workspace widget changed before the action could run. Nothing was changed. Try again.');if(action.type==='create_note_document'&&widget.type!=='notes')throw new Error('New documents can be created only inside a Notes widget. Nothing was changed.');if(action.type==='remove_widget'&&widget.lockPluginEnabled&&widget.locked)throw new Error('Unlock a locked widget before removing it. Nothing was changed.');if((action.type==='set_timer'||action.type==='control_timer')&&widget.type!=='focus'&&!widget.clockPluginEnabled)throw new Error('Add the Clock timer to that widget, or select a Focus widget. Nothing was changed.');if(action.type==='set_widget_plugin'&&action.plugin==='clock-timer'&&widget.type==='group')throw new Error('Clock cannot be added to a Group collection. Nothing was changed.');if(action.type==='edit_widget'&&(action.text!==undefined&&widget.type!=='notes'||action.schedule!==undefined&&widget.type!=='timetable'||action.pluginControls!==undefined&&widget.type!=='tagStatus'||(action.noteFont!==undefined||action.noteFontSize!==undefined||action.noteTags!==undefined)&&widget.type!=='notes'))throw new Error('That field cannot be edited on this widget. Nothing was changed.');if(action.type==='edit_widget'&&action.noteTags!==undefined&&!widget.noteDocuments.some(document=>document.id===action.noteDocumentId))throw new Error('That note document is no longer open in this Notes widget. Nothing was changed.');}
  }
  const noteCounts=new Map<string,number>(),noteTextLengths=new Map<string,number>();for(const widget of workspace.widgets)if(widget.type==='notes'){noteCounts.set(widget.id,widget.noteDocuments.length);noteTextLengths.set(widget.id,widget.noteDocuments.reduce((total,document)=>total+document.text.length,0))}
  for(const action of actions)if(action.type==='create_note_document'){const id=action.ids[0],count=(noteCounts.get(id)??0)+1,total=(noteTextLengths.get(id)??0)+(action.text?.length??0);if(count>NOTE_DOCUMENT_LIMIT)throw new Error(`A Notes widget supports up to ${NOTE_DOCUMENT_LIMIT} open documents. Nothing was changed.`);if(total>NOTE_DOCUMENT_TOTAL_LIMIT)throw new Error('That Notes widget has reached its saved text limit. Nothing was changed.');noteCounts.set(id,count);noteTextLengths.set(id,total)}
}
export function applyAssistantWidgetActions(workspace:Workspace,actions:AssistantAction[],width:number,height:number,now=Date.now(),savedTrayItems:AssistantTrayItem[]=[]):Workspace{
  validateAssistantActions(workspace,actions,savedTrayItems);
  let next=workspace;
  for(const action of actions){
    if(action.type==='save_to_tray'||action.type==='set_sidebar_plugin'||action.type==='set_ui_visibility'||action.type==='open_settings'||action.type==='set_setting'||action.type==='create_workspace'||action.type==='switch_workspace'||action.type==='undo'||action.type==='set_shortcut'||action.type==='run_tutorial'||action.type==='move_widget')continue;
    if(action.type==='open_saved')continue;
    if(action.type==='remove_widget')continue;
    if(action.type==='rename_workspace')continue;
    if(action.type==='set_course_environment'){next={...next,widgets:next.widgets.map(widget=>widget.id===action.ids[0]&&widget.type==='timetable'?{...widget,schedule:widget.schedule.map(entry=>{if(entry.id!==action.ids[1])return entry;if(action.enabled)return {...entry,workspaceId:action.workspaceId!,autoOpen:entry.autoOpen!==false};const {workspaceId:_workspaceId,autoOpen:_autoOpen,...rest}=entry;return rest})}:widget)};continue}
    if(action.type==='set_course_auto_open'){next={...next,widgets:next.widgets.map(widget=>widget.id===action.ids[0]&&widget.type==='timetable'?{...widget,schedule:widget.schedule.map(entry=>entry.id===action.ids[1]?{...entry,autoOpen:action.enabled!}:entry)}:widget)};continue}
    if(action.type==='open_note_document'){
      const [widgetId,documentId]=action.ids,widgets=next.widgets.map(widget=>{
        if(widget.id!==widgetId||widget.type!=='notes')return widget;
        const selected=widget.noteDocuments.find(document=>document.id===documentId);if(!selected)return widget;
        return {...widget,activeNoteDocumentId:selected.id,title:selected.title,text:selected.text};
      });
      next={...next,widgets};continue;
    }
    if(action.type==='close_note_document'){
      const [widgetId,documentId]=action.ids,widgets=next.widgets.map(widget=>{
        if(widget.id!==widgetId||widget.type!=='notes')return widget;
        const remaining=widget.noteDocuments.filter(document=>document.id!==documentId);if(remaining.length===widget.noteDocuments.length)return widget;
        const selected=widget.activeNoteDocumentId===documentId?(remaining[0]??createNoteDocument()):remaining.find(document=>document.id===widget.activeNoteDocumentId)??remaining[0]??createNoteDocument();
        return {...widget,noteDocuments:remaining.length?remaining:[selected],activeNoteDocumentId:selected.id,title:selected.title,text:selected.text};
      });
      next={...next,widgets};continue;
    }
    if(action.type==='create_note_document'){
      const target=action.ids[0],widgets=next.widgets.map(widget=>{
        if(widget.id!==target||widget.type!=='notes')return widget;
        const created=createNoteDocument(action.title!.trim());created.text=action.text??'';
        const noteDocuments=[...widget.noteDocuments,created];
        return {...widget,noteDocuments,activeNoteDocumentId:created.id,title:created.title,text:created.text};
      });
      next={...next,widgets};continue;
    }
    if(action.type==='add_widget'){
      if(next.widgets.length+action.ids.length>MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
      let widgets=[...next.widgets],groups=[...next.groups];
      for(const id of action.ids){const type=id as WidgetType,widget=createWidget(type);if(action.title!==undefined)widget.title=action.title.trim();if(action.text!==undefined){widget.text=action.text;if(type==='notes')widget.noteDocuments=updatedNoteDocument(widget.noteDocuments,widget.activeNoteDocumentId,{text:action.text,title:widget.title})}if(type==='notes'&&action.title!==undefined)widget.noteDocuments=updatedNoteDocument(widget.noteDocuments,widget.activeNoteDocumentId,{title:widget.title});widget.instanceNumber=nextInstanceNumber(type,widgets);widget.placement=constrainPlacement(type,nextPlacement(type,widgets,width),width,{},height);if(type==='group'){const groupId=crypto.randomUUID();widget.groupId=groupId;groups.push({id:groupId,name:action.title?.trim()??'',shortcuts:[],widgets:[],expanded:false})}widgets.push(widget)}
      next={...next,widgets,groups};continue;
    }
    const ids=new Set(action.ids);
    if(action.type==='edit_widget'&&action.title!==undefined){const groupIds=new Set(next.widgets.filter(widget=>ids.has(widget.id)&&widget.type==='group'&&widget.groupId).map(widget=>widget.groupId!));if(groupIds.size)next={...next,groups:next.groups.map(group=>groupIds.has(group.id)?{...group,name:action.title!.trim()}:group)}}
    const widgets=next.widgets.map(widget=>{
      if(!ids.has(widget.id)||(action.type==='minimize'&&widget.minimized)||(action.type==='restore'&&!widget.minimized)||(action.type==='set_timer'&&widget.end!==null&&widget.end>now&&Math.ceil((widget.end-now)/1000)===action.seconds))return widget;
      if(action.type==='set_timer')return {...widget,remaining:action.seconds!,end:now+action.seconds!*1000};
      if(action.type==='control_timer'){
        const remaining=widget.end!==null?Math.max(0,Math.ceil((widget.end-now)/1000)):widget.remaining;
        if(action.operation==='pause')return {...widget,remaining,end:null};
        if(action.operation==='resume')return remaining>0?{...widget,remaining,end:now+remaining*1000}:{...widget,end:null,remaining:0};
        return {...widget,remaining:1500,end:null};
      }
      if(action.type==='set_widget_plugin')return action.plugin==='clock-timer'?{...widget,clockPluginEnabled:action.enabled!}:action.plugin==='lock'?{...widget,lockPluginEnabled:action.enabled!,locked:action.enabled?action.locked??true:false}:widget;
      if(action.type==='edit_widget'){const schedule=action.schedule?.map(entry=>{const existing=widget.type==='timetable'?widget.schedule.find(previous=>previous.id===entry.id):undefined;return{...entry,...(entry.workspaceId?{}:existing?.workspaceId?{workspaceId:existing.workspaceId}:{}),...(existing?{autoOpen:existing.autoOpen!==false}:{})}});const updated={...widget,...(action.title!==undefined?{title:action.title.trim()}:{}),...(action.text!==undefined?{text:action.text}:{}),...(schedule!==undefined?{schedule:structuredClone(schedule)}:{}),...(action.tagColor!==undefined?{tagColor:action.tagColor==='none'?null:action.tagColor as WidgetInstance['tagColor']}:{}),...(action.pluginControls!==undefined?{pluginControls:[...action.pluginControls]}:{}),...(action.noteFont!==undefined?{noteFont:action.noteFont}:{}),...(action.noteFontSize!==undefined?{noteFontSize:action.noteFontSize}:{})};if(widget.type==='notes'&&(action.title!==undefined||action.text!==undefined))updated.noteDocuments=updatedNoteDocument(widget.noteDocuments,widget.activeNoteDocumentId,{...(action.title!==undefined?{title:action.title.trim()}:{}),...(action.text!==undefined?{text:action.text}:{})});if(widget.type==='notes'&&action.noteTags!==undefined)updated.noteDocuments=updatedNoteDocument(updated.noteDocuments,action.noteDocumentId,{tags:action.noteTags});return updated}
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
export function assistantWidgetPluginClarification(prompt:string,workspace:Workspace,selectedWidgetIds:string[]):string|null{
  if(!assistantActionRequest(prompt).includes('set_widget_plugin'))return null;
  if(resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds)?.some(action=>action.type==='set_widget_plugin'))return null;
  return 'Which widget should receive that plugin change? Name or select one widget, or say all widgets.';
}
export function validateAssistantActionIntent(prompt:string,workspace:Workspace,actions:AssistantAction[],savedTrayItems:AssistantTrayItem[]=[],workspaces:AssistantWorkspaceChoice[]=[],selectedWidgetIds:string[]=[]):void{
  const expected=assistantActionRequest(prompt,savedTrayItems,workspaces);
  if(!expected.length)return;
  const supplied=new Set(actions.map(action=>action.type));
  if(actions.some((action,index)=>action.type!=='create_note_document'&&actions.findIndex(item=>item.type===action.type)!==index))throw new Error('The suggested actions contain repeated changes. Nothing was changed.');
  if(expected.some(type=>!supplied.has(type)))throw new Error('No widgets were changed. The AI did not return every requested workspace action. Try again.');
  if([...supplied].some(type=>!expected.includes(type)))throw new Error('The suggested actions include changes beyond the direct request. Review them before applying.');
  if(expected.includes('set_course_environment')){const action=actions.find(item=>item.type==='set_course_environment'),resolved=resolveCourseEnvironment(prompt,workspace,selectedWidgetIds,workspaces);if(expected.length!==1||!action||!resolved||action.enabled!==resolved.enabled||action.workspaceId!==resolved.workspaceId||action.ids.length!==2||action.ids.some((id,index)=>id!==resolved.ids[index]))throw new Error('The course environment did not match your request. Nothing was changed.')}
  if(expected.includes('set_course_auto_open')){const action=actions.find(item=>item.type==='set_course_auto_open'),resolved=resolveCourseAutoOpen(prompt,workspace,selectedWidgetIds);if(expected.length!==1||!action||!resolved||action.enabled!==resolved.enabled||action.ids.length!==2||action.ids.some((id,index)=>id!==resolved.ids[index]))throw new Error('The course automatic-opening change did not match your request. Nothing was changed.')}
  if(expected.includes('add_widget')){
    const action=actions.find(item=>item.type==='add_widget'),requestedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type)&&!(expected.includes('create_note_document')&&(type==='notes'||type==='files'&&!/\bfiles?\s+(?:widget|card)\b/i.test(prompt))));
    if(!action)throw new Error('No widget was added. The AI did not include the requested widget type.');
    if(requestedTypes.length&&action.ids.some(id=>!requestedTypes.includes(id as WidgetType)))throw new Error('The suggested widget type does not match your request.');
    if(requestedTypes.length>1&&requestedTypes.some(type=>!action.ids.includes(type)))throw new Error('The AI did not include every widget type you named.');
    const amount=expected.includes('create_note_document')?null:assistantRequestedItemCount(prompt),expectedCount=amount??(requestedTypes.length||1);
    if(action.ids.length!==expectedCount)throw new Error('The AI did not include the requested number of widgets.');
  }
  if(expected.includes('create_note_document')){
    const created=actions.filter(action=>action.type==='create_note_document'),expectedCount=assistantRequestedItemCount(prompt)??1;
    const noteWidgets=workspace.widgets.filter(widget=>widget.type==='notes'),named=noteWidgets.filter(widget=>prompt.toLocaleLowerCase().includes(widgetLabel(widget).toLocaleLowerCase()));
    const targetIds=new Set(created.flatMap(action=>action.ids));
    if(created.length!==expectedCount||created.some(action=>action.ids.length!==1)||targetIds.size!==1||!noteWidgets.some(widget=>widget.id===[...targetIds][0])||named.length===1&&[...targetIds][0]!==named[0].id)throw new Error('The note documents did not match the requested count or Notes widget. Nothing was changed.');
  }
  if(expected.includes('open_note_document')){
    const action=actions.find(item=>item.type==='open_note_document'),widget=action?.ids.length===2?workspace.widgets.find(item=>item.id===action.ids[0]&&item.type==='notes'):undefined,document=widget?.type==='notes'?widget.noteDocuments.find(item=>item.id===action!.ids[1]):undefined;
    const titleMatches=widget?.type==='notes'?widget.noteDocuments.filter(item=>item.title&&prompt.toLocaleLowerCase().includes(item.title.toLocaleLowerCase())):[];
    if(!action||!document||titleMatches.length===1&&titleMatches[0].id!==document.id||titleMatches.length>1)throw new Error('The opened note did not match the requested Notes document. Nothing was changed.');
  }
  if(expected.includes('close_note_document')){
    const action=actions.find(item=>item.type==='close_note_document'),resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='close_note_document');
    if(!action||!resolved||action.ids.length!==2||action.ids.some((id,index)=>id!==resolved.ids[index]))throw new Error('The closed note did not match your request. Nothing was changed.');
  }
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
  if(expected.includes('open_settings')){
    const action=actions.find(item=>item.type==='open_settings'),tab=/\b(?:appearance|theme|glass|background)\b/i.test(prompt)?'appearance':/\bplugin\b/i.test(prompt)?'plugins':'general';
    if(!action||action.ids.length!==1||action.ids[0]!==tab)throw new Error('The settings page did not match your request.');
  }
  if(expected.includes('set_setting')){const requested=resolveAssistantSetting(prompt),action=actions.find(item=>item.type==='set_setting');if(!requested||!action||action.ids.length!==1||action.ids[0]!==requested.key||action.settingValue!==requested.value)throw new Error('The setting change did not match your request. Nothing was changed.')}
  if(expected.includes('edit_widget')&&isNotesStyleRequest(prompt)){
    const action=actions.find(item=>item.type==='edit_widget'),target=action?.ids.length===1?workspace.widgets.find(widget=>widget.id===action.ids[0]):undefined,style=target?.type==='notes'?requestedNotesStyle(prompt,target):null;
    const resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='edit_widget');
    const mismatchedStyle=!!action&&!!style&&(Object.keys(style).some(key=>action[key as 'noteFont'|'noteFontSize']!==style[key as 'noteFont'|'noteFontSize'])||Object.keys(action).some(key=>['noteFont','noteFontSize'].includes(key)&&!Object.hasOwn(style,key)));
    const mismatchedTarget=resolved?!!action&&action.ids[0]!==resolved.ids[0]:selectedWidgetIds.length!==0;
    if(expected.length!==1||!action||target?.type!=='notes'||!style||mismatchedStyle||mismatchedTarget)throw new Error('The Notes formatting did not match your request. Nothing was changed.')
  }
  if(expected.includes('edit_widget')&&isNotesTagRequest(prompt)){
    const action=actions.find(item=>item.type==='edit_widget'),resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='edit_widget'),widget=action?.ids.length===1?workspace.widgets.find(item=>item.id===action.ids[0]&&item.type==='notes'):undefined,doc=widget?.type==='notes'?widget.noteDocuments.find(item=>item.id===action!.noteDocumentId):undefined;
    const onlyExpectedFields=!!action&&Object.keys(action).every(key=>['type','ids','noteDocumentId','noteTags'].includes(key));
    if(expected.length!==1||!action||!widget||!doc||!Array.isArray(action.noteTags)||!onlyExpectedFields||resolved&&(action.ids[0]!==resolved.ids[0]||action.noteDocumentId!==resolved.noteDocumentId||JSON.stringify(action.noteTags)!==JSON.stringify(resolved.noteTags)))throw new Error('The note tag change did not match your request. Nothing was changed.');
  }
  if(expected.includes('create_workspace')){const action=actions.find(item=>item.type==='create_workspace'),name=assistantWorkspaceName(prompt),types=widgetTypes.filter(type=>widgetNameMentioned(prompt,type)),blank=/\b(?:blank|empty)\s+(?:new\s+)?workspace\b/i.test(prompt);if(expected.length!==1||!action||!name||action.title?.trim().toLocaleLowerCase()!==name.toLocaleLowerCase()||!blank&&types.length&&types.some(type=>!action.ids.includes(type))||blank&&action.ids.length)throw new Error('The workspace creation did not match your request. Nothing was changed.')}
  if(expected.includes('switch_workspace')){const action=actions.find(item=>item.type==='switch_workspace'),resolved=resolveDirectAssistantActions(prompt,workspace,[],savedTrayItems,workspaces)?.find(item=>item.type==='switch_workspace');if(expected.length!==1||!action||!resolved||action.ids.length!==1||action.ids[0]!==resolved.ids[0])throw new Error('The workspace switch did not match a unique workspace name. Nothing was changed.')}
  if(expected.includes('move_widget')){const action=actions.find(item=>item.type==='move_widget'),target=resolveAssistantMoveDestination(prompt,workspaces),namedTypes=widgetTypes.filter(type=>widgetNameMentioned(prompt,type)),source=action?.ids.length===1?workspace.widgets.find(widget=>widget.id===action.ids[0]):undefined;if(expected.length!==1||!action||!target||action.workspaceId!==target.id||!source||namedTypes.length&&!namedTypes.includes(source.type))throw new Error('The widget move did not match the requested source and destination. Nothing was changed.')}
  if(expected.includes('undo')){const action=actions.find(item=>item.type==='undo');if(expected.length!==1||!action||action.ids.length!==1||action.ids[0]!==workspace.id)throw new Error('The undo action did not match the current workspace. Nothing was changed.')}
  if(expected.includes('run_tutorial')){const action=actions.find(item=>item.type==='run_tutorial');if(expected.length!==1||!action||action.ids[0]!=='tutorial')throw new Error('The tutorial action did not match your request.')}
  if(expected.includes('set_shortcut')){const requested=resolveAssistantShortcut(prompt),action=actions.find(item=>item.type==='set_shortcut');if(expected.length!==1||!requested||!action||action.ids[0]!==requested.id||JSON.stringify(action.shortcut)!==JSON.stringify(requested.shortcut))throw new Error('The shortcut change did not match your request. Nothing was changed.')}
  if(expected.includes('control_timer')){const resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='control_timer'),action=actions.find(item=>item.type==='control_timer'),validTarget=action?.ids.length===1&&workspace.widgets.some(widget=>widget.id===action.ids[0]&&(widget.type==='focus'||widget.clockPluginEnabled)),validOperation=action?.operation===requestedTimerOperation(prompt);if(expected.length!==1||!action||!validOperation||!(resolved?action.ids[0]===resolved.ids[0]:selectedWidgetIds.length===0&&validTarget))throw new Error('The timer control did not match your requested operation or timer. Nothing was changed.')}
  if(expected.includes('set_sidebar_plugin')){
    const action=actions.find(item=>item.type==='set_sidebar_plugin');
    const requested=(['stack','layout'] as const).filter(plugin=>new RegExp(`\\b${plugin}\\b`,'i').test(prompt));
    const enable=!/\b(?:remove|disable|turn off)\b/i.test(prompt);
    if(!action||requested.length!==action.ids.length||requested.some(plugin=>!action.ids.includes(plugin))||action.enabled!==enable)throw new Error('The sidebar plugin changes did not match your request. Nothing was changed.');
  }
  if(expected.includes('set_ui_visibility')){
    const action=actions.find(item=>item.type==='set_ui_visibility'),resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='set_ui_visibility');
    if(expected.length!==1||!action||!resolved||action.ids[0]!==resolved.ids[0]||action.enabled!==resolved.enabled)throw new Error('The Still interface visibility change did not match your request. Nothing was changed.');
  }
  if(expected.includes('minimize')||expected.includes('restore')){
    if(expected.length===1){const type=expected.includes('minimize')?'minimize':'restore',action=actions.find(item=>item.type===type),resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type===type);if(resolved&&(!action||JSON.stringify([...action.ids].sort())!==JSON.stringify([...resolved.ids].sort())))throw new Error('The widget visibility change did not match your request. Nothing was changed.');}
  }
  if(expected.includes('set_widget_plugin')){
    const action=actions.find(item=>item.type==='set_widget_plugin');
    const plugin:AssistantAction['plugin']=/\b(?:lock|unlock)\b/i.test(prompt)?'lock':'clock-timer';
    const removePlugin=/\b(?:remove|disable|turn off)\b/i.test(prompt);
    const enable=plugin==='lock'?!removePlugin:/\b(?:add|enable|turn on|install)\b/i.test(prompt);
    const locked=plugin==='lock'&&enable?!/\bunlock\b/i.test(prompt):undefined;
    const resolved=resolveDirectAssistantActions(prompt,workspace,selectedWidgetIds,savedTrayItems,workspaces)?.find(item=>item.type==='set_widget_plugin');
    if(!action||!resolved||action.plugin!==plugin||action.enabled!==enable||action.locked!==locked||action.ids.length!==resolved.ids.length||action.ids.some(id=>!resolved.ids.includes(id)))throw new Error('The requested widget plugin changes did not match your request. Nothing was changed.');
  }
  const amount=expected.includes('create_note_document')?null:assistantRequestedItemCount(prompt);
  if(amount!==null)for(const type of ['add_widget','open_saved'] as const)if(expected.includes(type)){
    const action=actions.find(item=>item.type===type);
    if(action&&action.ids.length!==amount)throw new Error('No widgets were changed. Still AI did not include the requested number of widgets. Try again.');
  }
  const asksForAll=/\b(?:all|every|each)\b/i.test(prompt);
  if(asksForAll)for(const type of expected){
    if(type==='add_widget')continue;
    const action=actions.find(item=>item.type===type);
    const selectedTypes=widgetTypes.filter(widgetType=>widgetNameMentioned(prompt,widgetType));
    const targets=type==='open_saved'?savedTrayItems.map(item=>item.id):workspace.widgets.filter(widget=>type==='save_to_tray'?widget.type!=='group':type==='set_widget_plugin'?(action?.plugin==='lock'||widget.type!=='group')&&(!selectedTypes.length||selectedTypes.includes(widget.type)):type==='set_timer'?widget.type==='focus'||widget.clockPluginEnabled:type==='remove_widget'&&selectedTypes.length?selectedTypes.includes(widget.type):true).map(widget=>widget.id);
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
