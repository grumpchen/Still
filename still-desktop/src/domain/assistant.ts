import {createWidget,minimizeWidgetInstance,nextInstanceNumber,restoreWidgetInstance,type WidgetInstance,type Workspace} from './workspaces.ts';
import {widgetCatalog,widgetTypes,type WidgetType} from './widgetCatalog.ts';
import type {WidgetPreset} from './presets.ts';
import type {SavedGroup} from './workspaces.ts';
import {constrainPlacement,nextPlacement,type Placement} from './layout.ts';

export type AssistantProvider = 'gemini' | 'openai';
export type ChatMessage = {role:'user'|'model'; text:string};
export type LayoutItem = Placement & {id:string};
export type AssistantActionType = 'minimize'|'restore'|'save_to_tray'|'set_timer'|'add_widget'|'open_saved';
export type AssistantAction = {type:AssistantActionType;ids:string[];seconds?:number};
export type AssistantTrayItem={id:string;name:string;type:WidgetType;kind:'preset'|'group'};
export const MAX_ASSISTANT_BATCH=10;
export const MAX_ASSISTANT_WIDGETS=100;
export type AssistantReply = {reply:string; layout:LayoutItem[]; actions:AssistantAction[]};
export type LayoutPlan = {workspaceId:string; fingerprint:string; width:number; height:number; items:LayoutItem[]};
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_MODELS:Record<AssistantProvider,string> = {gemini:DEFAULT_MODEL,openai:'gpt-4o-mini'};
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

export function widgetLabel(widget:WidgetInstance):string {
  return widget.title || widgetCatalog[widget.type].name+' '+widget.instanceNumber;
}
// No resource grants, local paths, bookmarks, or content from other widgets.
export function widgetContext(widget:WidgetInstance):Record<string,unknown> {
  const result:Record<string,unknown> = {type:widget.type, title:widgetLabel(widget)};
  if(widget.type==='notes'||widget.type==='ai')result.text=widget.text.slice(0,12000);
  if(widget.type==='timetable')result.schedule=widget.schedule.slice(0,80);
  if(widget.type==='focus')result.remainingSeconds=widget.end?Math.max(0,Math.ceil((widget.end-Date.now())/1000)):widget.remaining;
  if(widget.type==='apps'||widget.type==='desmos'||widget.type==='files')result.reading='Only metadata is available unless a visible screenshot is included. Do not infer unseen window or file contents.';
  return result;
}
export function layoutFingerprint(workspace:Workspace):string {
  return JSON.stringify(workspace.widgets.map(w=>[w.id,w.type,w.minimized,w.placement,w.appPanelOpen,w.appMinWidth,w.appMinHeight]));
}
export function layoutContext(workspace:Workspace,width:number,height:number) {
  return {canvas:{width,height,padding:20},widgets:workspace.widgets.map(w=>({
    id:w.id,title:widgetLabel(w),type:w.type,placement:w.placement,minimized:w.minimized,
    minimumWidth:Math.max(widgetCatalog[w.type].minWidth,w.appPanelOpen?w.appMinWidth??0:0),
    minimumHeight:Math.max(widgetCatalog[w.type].minHeight,w.appPanelOpen?w.appMinHeight??0:0),
  }))};
}
/** Layout metadata is always available for arrangement requests; widget contents are shared only by explicit @ mention. */
export function assistantWorkspaceContext(workspace:Workspace,width:number,height:number,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[]):Record<string,unknown> {
  const unique=[...new Set(selectedWidgetIds)];
  const selected=unique.map(id=>workspace.widgets.find(widget=>widget.id===id)).filter((widget):widget is WidgetInstance=>!!widget);
  return {canvasAndWidgets:layoutContext(workspace,width,height),selectedWidgets:selected.map(widgetContext),savedTrayItems:savedTrayItems.map(({id,name,type,kind})=>({id,name,type,kind}))};
}
export function assistantTrayItems(presets:WidgetPreset[],groups:SavedGroup[]):AssistantTrayItem[]{
  return [
    ...presets.map(item=>({id:`preset-${item.id}`,name:item.name,type:item.type,kind:'preset' as const})),
    ...groups.map(item=>({id:`group-${item.id}`,name:item.name||'Group',type:'group' as const,kind:'group' as const})),
  ];
}
export function assistantRequestLimitError(text:string,savedTrayItems:AssistantTrayItem[]=[]):string|null{
  const types=assistantActionRequest(text,savedTrayItems),amount=text.match(/\b(\d+)\s+(?:saved\s+)?(?:[a-z-]+\s+)?widgets?\b/i);
  if(types.includes('add_widget')&&amount&&Number(amount[1])>MAX_ASSISTANT_BATCH)return `Still AI can add at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`;
  if(types.includes('open_saved')&&amount&&Number(amount[1])>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Nothing was changed.`;
  if(types.includes('open_saved')&&/\b(?:all|every|each)\b/i.test(text)&&savedTrayItems.length>MAX_ASSISTANT_BATCH)return `Still AI can open at most ${MAX_ASSISTANT_BATCH} saved items per request. Open a smaller group at a time.`;
  return null;
}
export function parseAssistantReply(value:unknown):AssistantReply {
  if(!value||typeof value!=='object')throw new Error('The AI returned an invalid response. Try again.');
  const {reply,layout}=value as AssistantReply,rawActions=(value as Partial<AssistantReply>).actions??[];
  if(typeof reply!=='string'||!reply.trim()||reply.length>24000||!Array.isArray(layout)||layout.length>100||!Array.isArray(rawActions)||rawActions.length>100)throw new Error('The AI returned an incomplete response. Try again.');
  const items=layout.map(item=>{
    if(!item||typeof item.id!=='string'||item.id.length>80||[item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n)))throw new Error('The AI returned an invalid layout. Try again.');
    return {id:item.id,x:item.x,y:item.y,width:item.width,height:item.height};
  });
  const actions:AssistantAction[]=rawActions.map(action=>{
    const newWidgets=action?.type==='add_widget',openSaved=action?.type==='open_saved';
    if(!action||!['minimize','restore','save_to_tray','set_timer','add_widget','open_saved'].includes(action.type)||!Array.isArray(action.ids)||!action.ids.length||action.ids.length>(newWidgets||openSaved?MAX_ASSISTANT_BATCH:100)||action.ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id))||(!newWidgets&&new Set(action.ids).size!==action.ids.length)||(newWidgets&&action.ids.some(id=>!widgetTypes.includes(id as WidgetType)))||(openSaved&&action.ids.some(id=>!id.startsWith('preset-')&&!id.startsWith('group-')))||(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))||(action.type!=='set_timer'&&action.seconds!==undefined))throw new Error('The AI returned an invalid workspace action. Nothing was changed. Try again.');
    return {type:action.type,ids:[...action.ids],...(action.type==='set_timer'?{seconds:action.seconds}:{})};
  });
  if(actions.filter(action=>action.type==='add_widget'||action.type==='open_saved').reduce((total,action)=>total+action.ids.length,0)>MAX_ASSISTANT_BATCH)throw new Error('The AI returned too many widget actions. Nothing was changed. Try a smaller request.');
  if(items.length&&actions.length)throw new Error('The AI mixed a layout proposal with workspace actions. Nothing was changed. Try again.');
  return {reply,layout:items,actions};
}
function isQuestionOrExplanation(text:string):boolean{
  const prompt=text.trim();
  return !prompt||/^(?:what|why|how|where|when|which)\b/i.test(prompt)||/^(?:please\s+)?(?:explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt)||/^(?:can|could|would) you (?:explain|describe|teach me|tell me about|help me understand)\b/i.test(prompt);
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
  if(/\bminimi[sz](?:e|ing)?\b/i.test(prompt))requested.push('minimize');
  if(/\brestore\b/i.test(prompt))requested.push('restore');
  const opensSaved=(/\b(?:open|add|load|bring|reopen)\b[\s\S]{0,100}\b(?:saved|tray|shortcut|widgets?)\b[\s\S]{0,80}\b(?:widgets?|shortcut|group|tray)?\b/i.test(prompt)&&/\b(?:saved|tray|shortcut)\b/i.test(prompt))||savedTrayItems.some(item=>/^\s*(?:please\s+)?(?:open|load|reopen|bring)\b/i.test(prompt)&&prompt.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()));
  if(opensSaved)requested.push('open_saved');
  else if(/\b(?:save|put|move|send|store|copy|add|collect)\b[\s\S]{0,120}\btray\b/i.test(prompt))requested.push('save_to_tray');
  if(!opensSaved&&/\b(?:add|create|insert)\b[\s\S]{0,60}\b(?:widgets?|cards?)\b/i.test(prompt))requested.push('add_widget');
  if(/\b(?:set|start|begin)\b[\s\S]{0,40}\btimer\b/i.test(prompt)&&extractAssistantTimerSeconds(prompt)!==null)requested.push('set_timer');
  return [...new Set(requested)];
}
export function assistantLayoutRequested(text:string):boolean{
  if(isQuestionOrExplanation(text)||unsupportedAssistantRequest(text)||assistantActionRequest(text).length)return false;
  return /\b(?:arrange|layout|rearrange|organize|organise|snap|tile|reposition)\b/i.test(text)||/\b(?:move|place|position)\b[\s\S]{0,100}\b(?:widget|widgets|card|cards|next to|above|below|left of|right of)\b/i.test(text);
}
export function unsupportedAssistantRequest(text:string):'clear_tray'|'delete_widgets'|null{
  if(isQuestionOrExplanation(text))return null;
  if(/\b(?:delete|remove|clear|empty|erase|purge)\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b[\s\S]{0,100}\b(?:widget\s+)?tray\b/i.test(text)||/\b(?:delete|remove|clear|empty|erase|purge)\b[\s\S]{0,100}\b(?:widget\s+)?tray\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b/i.test(text))return 'clear_tray';
  if(/\b(?:delete|remove|clear|erase)\b[\s\S]{0,100}\b(?:all|every|entire|whole)\b[\s\S]{0,100}\bwidgets?\b(?:[\s\S]{0,60}\b(?:on|in|from)\s+(?:the\s+)?(?:current\s+)?(?:workspace|canvas))?/i.test(text)||/\b(?:delete|remove|clear|erase)\b[\s\S]{0,100}\bwidgets?\b[\s\S]{0,60}\b(?:on|in|from)\s+(?:the\s+)?(?:current\s+)?(?:workspace|canvas)\b/i.test(text))return 'delete_widgets';
  return null;
}
/** Resolve unambiguous local commands without asking the language model to reconstruct workspace IDs. */
export function resolveDirectAssistantActions(text:string,workspace:Workspace,selectedWidgetIds:string[],savedTrayItems:AssistantTrayItem[]=[]):AssistantAction[]|null{
  const types=assistantActionRequest(text,savedTrayItems);
  if(!types.length)return null;
  const all=/\b(?:all|every|each)\b/i.test(text);
  const amount=text.match(/\b(\d+)\s+(?:saved\s+)?(?:[a-z-]+\s+)?widgets?\b/i);
  if(assistantRequestLimitError(text,savedTrayItems))return null;
  if(types.includes('open_saved')){
    const matched=all?savedTrayItems:savedTrayItems.filter(item=>text.toLocaleLowerCase().includes(item.name.toLocaleLowerCase()));
    if(!matched.length)return null;
    if(matched.length>MAX_ASSISTANT_BATCH)return null;
    return [{type:'open_saved',ids:matched.map(item=>item.id)}];
  }
  if(types.includes('add_widget')){
    const normalized=text.toLocaleLowerCase();
    const matched=widgetTypes.filter(type=>normalized.includes(type.toLocaleLowerCase())||normalized.includes(widgetCatalog[type].name.toLocaleLowerCase()));
    if(matched.length){if(matched.length>MAX_ASSISTANT_BATCH)return null;const count=amount?Number(amount[1]):1;if(count>1&&matched.length===1)return [{type:'add_widget',ids:Array(count).fill(matched[0])}];return [{type:'add_widget',ids:matched}];}
  }
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
  for(const action of actions){
    if(action.type==='set_timer'&&(!Number.isSafeInteger(action.seconds)||action.seconds!<1||action.seconds!>31536000))throw new Error('Choose a timer duration between one second and one year. Nothing was changed.');
    if((action.type==='add_widget'||action.type==='open_saved')&&action.ids.length>MAX_ASSISTANT_BATCH)throw new Error(`Still AI can change at most ${MAX_ASSISTANT_BATCH} widgets in one request. Nothing was changed.`);
    for(const id of action.ids){if(action.type==='add_widget'){if(!widgetTypes.includes(id as WidgetType))throw new Error('Choose a widget type from Still’s built-in gallery. Nothing was changed.');continue}if(action.type==='open_saved'){if(!savedItems.has(id))throw new Error('A saved tray item changed before the action could run. Nothing was changed. Try again.');continue}const widget=widgets.get(id);if(!widget)throw new Error('A workspace widget changed before the action could run. Nothing was changed. Try again.');if(action.type==='set_timer'&&widget.type!=='focus'&&!widget.clockPluginEnabled)throw new Error('Add the Clock timer to that widget, or select a Focus widget. Nothing was changed.');}
  }
}
export function applyAssistantWidgetActions(workspace:Workspace,actions:AssistantAction[],width:number,height:number,now=Date.now(),savedTrayItems:AssistantTrayItem[]=[]):Workspace{
  validateAssistantActions(workspace,actions,savedTrayItems);
  let next=workspace;
  for(const action of actions){
    if(action.type==='save_to_tray')continue;
    if(action.type==='open_saved')continue;
    if(action.type==='add_widget'){
      if(next.widgets.length+action.ids.length>MAX_ASSISTANT_WIDGETS)throw new Error(`This workspace is limited to ${MAX_ASSISTANT_WIDGETS} widgets so it stays responsive. Nothing was changed.`);
      let widgets=[...next.widgets],groups=[...next.groups];
      for(const id of action.ids){const type=id as WidgetType,widget=createWidget(type);widget.instanceNumber=nextInstanceNumber(type,widgets);widget.placement=constrainPlacement(type,nextPlacement(type,widgets,width),width,{},height);if(type==='group'){const groupId=crypto.randomUUID();widget.groupId=groupId;groups.push({id:groupId,name:'',shortcuts:[],widgets:[],expanded:false})}widgets.push(widget)}
      next={...next,widgets,groups};continue;
    }
    const ids=new Set(action.ids);
    const widgets=next.widgets.map(widget=>{
      if(!ids.has(widget.id)||(action.type==='minimize'&&widget.minimized)||(action.type==='restore'&&!widget.minimized)||(action.type==='set_timer'&&widget.end!==null&&widget.end>now&&Math.ceil((widget.end-now)/1000)===action.seconds))return widget;
      if(action.type==='set_timer')return {...widget,remaining:action.seconds!,end:now+action.seconds!*1000};
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
  const amount=prompt.match(/\b(\d+)\s+(?:saved\s+)?(?:[a-z-]+\s+)?widgets?\b/i);
  if(amount)for(const type of ['add_widget','open_saved'] as const)if(expected.includes(type)){
    const action=actions.find(item=>item.type===type);
    if(action&&action.ids.length!==Number(amount[1]))throw new Error('No widgets were changed. Still AI did not include the requested number of widgets. Try again.');
  }
  const asksForAll=/\b(?:all|every|each)\b/i.test(prompt);
  if(asksForAll)for(const type of expected){
    if(type==='add_widget')continue;
    const action=actions.find(item=>item.type===type);
    const targets=type==='open_saved'?savedTrayItems.map(item=>item.id):workspace.widgets.filter(widget=>type==='save_to_tray'?widget.type!=='group':type==='set_timer'?widget.type==='focus'||widget.clockPluginEnabled:true).map(widget=>widget.id);
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
    if([item.x,item.y,item.width,item.height].some(n=>!Number.isSafeInteger(n))||item.x<0||item.y<0||item.width<minimumWidth||item.height<minimumHeight||item.width>3000||item.height>3000||item.x+item.width>width-20||item.y+item.height>height-20)throw new Error('The proposed layout does not fit the canvas or widget minimum sizes. Try requesting a different arrangement.');
  }
  const rectangles=[...items,...workspace.widgets.filter(w=>w.minimized).map(w=>({...w.placement,id:w.id}))];
  for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
    const a=rectangles[i],b=rectangles[j];
    if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)throw new Error('The proposed layout overlaps widgets. Ask Gemini to leave more space.');
  }
}
export function applyLayoutPlan(workspace:Workspace,plan:LayoutPlan,width:number,height:number):Workspace {
  if(workspace.id!==plan.workspaceId||layoutFingerprint(workspace)!==plan.fingerprint||width!==plan.width||height!==plan.height)throw new Error('The workspace changed. Request a fresh layout before applying it.');
  validateLayout(workspace,plan.items,width,height);
  const positions=new Map(plan.items.map(({id,...p})=>[id,p]));
  return {...workspace,widgets:workspace.widgets.map(w=>positions.has(w.id)?{...w,placement:positions.get(w.id)!,lectureRestore:null}:w)};
}
