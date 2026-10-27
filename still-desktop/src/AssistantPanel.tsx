import {useEffect,useRef,useState,type ChangeEvent,type KeyboardEvent} from 'react';
import type {Workspace,WidgetInstance,SidebarPlugin} from './domain/workspaces.ts';
import {addFocusForAssistantTimer,applyLayoutPlan,assistantActionRequest,assistantActionsDescription,assistantEditClarification,assistantLayoutRequested,assistantKeyError,assistantReplyNeedsClarification,assistantRequestLimitError,assistantWorkspaceContext,DEFAULT_MODELS,extractAssistantTimerSeconds,layoutFingerprint,prepareAssistantHistory,preferredModel,resolveAcceptedNotesOffer,resolveDirectAssistantActions,resolveNamedNotesCreation,safeAssistantReceipt,settleAssistantConfirmation,unsupportedAssistantRequest,validateAssistantActionIntent,validateAssistantActions,validateLayout,widgetLabel,type AssistantAction,type AssistantFileProposal,type AssistantProvider,type AssistantTrayItem,type ChatMessage,type LayoutPlan} from './domain/assistant.ts';
import {checkedStudyCalendarDrafts,type StudyCalendarEventDraft} from './domain/studyCalendar.ts';
import {geminiAssistant,widgetImage,workspaceImage} from './platform/assistant.ts';
import {readAssistantChat,saveAssistantChat} from './domain/assistantChat.ts';
import {Icon} from './widgets.tsx';
import './assistant.css';

type AssistantConfirmation='clear_tray'|'delete_widgets'|'delete_workspace'|'open_saved_apps'|'remove_widgets'|'workspace_actions';
type Props={workspace:Workspace;canDeleteWorkspace:boolean;sidebarPlugins:SidebarPlugin[];trayItems:AssistantTrayItem[];open:boolean;close:()=>void;dimensions:()=>{width:number;height:number};apply:(plan:LayoutPlan)=>void;act:(workspaceId:string,actions:AssistantAction[],prompt:string)=>Promise<string>;moveFile?:(workspaceId:string,widgetId:string,sourcePath:string,destinationFolder:string)=>Promise<string>;addCalendarEvents:(workspaceId:string,widgetId:string,events:StudyCalendarEventDraft[])=>Promise<string>;startTimer:(workspaceId:string,seconds:number)=>Promise<string>;clearTray:(workspaceId:string)=>Promise<string>;deleteWidgets:(workspaceId:string)=>Promise<string>;deleteWorkspace:(workspaceId:string)=>Promise<string>;undo:()=>void};
type Mention={id:string;label:string};
type LibraryResourceContext={name:string;path:string;size:number;text:string;notes:string;prompt:string;fileWidgetId:string|null;fileActionAllowed:boolean;noteTarget?:NoteTarget};
type NoteTarget={widgetId:string;noteId:string;expectedText:string;workspaceId:string};
type NoteDraftReview=NoteTarget&{draft:string};
type ResourceFilingProposal=AssistantFileProposal&{fileName:string;widgetId:string;sourcePath:string};
type CalendarProposalReview={widgetId:string;events:StudyCalendarEventDraft[]};
const PROVIDERS:AssistantProvider[]=['gemini','openai','opencode'];
const PROVIDER_NAMES:Record<AssistantProvider,string>={gemini:'Gemini',openai:'OpenAI',opencode:'OpenCode Go'};
const PREFERENCE_KEY='still-assistant-model';
const WORKSPACE_IMAGE_PREFERENCE_KEY='still-assistant-share-workspace-image';
function readPreference():{provider:AssistantProvider;model:string}{
  try{const [provider,model]=localStorage.getItem(PREFERENCE_KEY)?.split('::')??[];if((provider==='gemini'||provider==='openai'||provider==='opencode')&&model)return{provider,model}}catch{/* preview storage can be disabled */}
  return{provider:'gemini',model:DEFAULT_MODELS.gemini};
}
function savePreference(provider:AssistantProvider,model:string){try{localStorage.setItem(PREFERENCE_KEY,`${provider}::${model}`)}catch{/* preference is optional */}}
function readWorkspaceImagePreference(){try{return localStorage.getItem(WORKSPACE_IMAGE_PREFERENCE_KEY)!=='false'}catch{return true}}
function saveWorkspaceImagePreference(enabled:boolean){try{localStorage.setItem(WORKSPACE_IMAGE_PREFERENCE_KEY,String(enabled))}catch{/* preference is optional */}}
function canScreenshot(widget:WidgetInstance){return widget.type==='apps'||widget.type==='desmos'||widget.type==='files'}
import {removeAssistantWidgetMention,resolveAssistantWidgetMentions} from './domain/assistantMentions.ts';
import {translate,useLocale,useT} from './localization.tsx';

function formatAssistantText(template:string,values:Record<string,string>){return template.replace(/\{(\w+)\}/g,(_,key:string)=>values[key]??'')}

export default function AssistantPanel({workspace,canDeleteWorkspace,sidebarPlugins,trayItems,open,close,dimensions,apply,act,moveFile,addCalendarEvents,startTimer,clearTray,deleteWidgets,deleteWorkspace,undo}:Props){
  const t=useT();
  const locale=useLocale();
  const [initial]=useState(readPreference);
  const [configured,setConfigured]=useState(false),[settings,setSettings]=useState(false),[key,setKey]=useState('');
  const [provider,setProvider]=useState<AssistantProvider>(initial.provider),[model,setModel]=useState(initial.model),[modelsByProvider,setModelsByProvider]=useState<Record<AssistantProvider,string[]>>({gemini:[],openai:[],opencode:[]});
  const [input,setInput]=useState(''),[mentions,setMentions]=useState<Mention[]>([]),[mentionOpen,setMentionOpen]=useState(false),[mentionQuery,setMentionQuery]=useState(''),[mentionRange,setMentionRange]=useState({start:0,end:0}),[mentionIndex,setMentionIndex]=useState(0),[libraryResource,setLibraryResource]=useState<LibraryResourceContext|null>(null),[fileProposal,setFileProposal]=useState<ResourceFilingProposal|null>(null),[calendarProposal,setCalendarProposal]=useState<CalendarProposalReview|null>(null),[noteDraftProposal,setNoteDraftProposal]=useState<NoteDraftReview|null>(null);
  const [screenshot,setScreenshot]=useState(false),[shareWorkspaceImage,setShareWorkspaceImage]=useState(readWorkspaceImagePreference),[chatState,setChatState]=useState(()=>({workspaceId:workspace.id,messages:readAssistantChat(workspace.id)})),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(''),[plan,setPlan]=useState<LayoutPlan|null>(null),[confirmation,setConfirmation]=useState<AssistantConfirmation|null>(null);
  const alive=useRef(true),sending=useRef(false),latest=useRef(workspace),textarea=useRef<HTMLTextAreaElement>(null),log=useRef<HTMLDivElement>(null),pendingActions=useRef<AssistantAction[]|null>(null),pendingPrompt=useRef('');
  latest.current=workspace;
  const messages=chatState.workspaceId===workspace.id?chatState.messages:readAssistantChat(workspace.id);
  function setMessages(update:ChatMessage[]|((current:ChatMessage[])=>ChatMessage[])){
    const workspaceId=latest.current.id;
    setChatState(current=>{
      const base=current.workspaceId===workspaceId?current.messages:readAssistantChat(workspaceId);
      return{workspaceId,messages:typeof update==='function'?update(base):update};
    });
  }
  const selectedIds=resolveAssistantWidgetMentions(input,workspace,mentions.map(item=>item.id));
  const selectedWidgets=selectedIds.map(id=>workspace.widgets.find(widget=>widget.id===id)).filter((widget):widget is WidgetInstance=>!!widget);
  const screenshotWidgets=mentions.some(item=>item.id==='__all__')?[]:selectedWidgets.filter(canScreenshot),screenshotWidget=screenshotWidgets.length===1?screenshotWidgets[0]:null;
  const selectedMentions=mentions.some(item=>item.id==='__all__')?[{id:'__all__',label:t('allWidgets')}]:selectedIds.map(id=>workspace.widgets.find(widget=>widget.id===id)).filter((widget):widget is WidgetInstance=>!!widget).map(widget=>({id:widget.id,label:widgetLabel(widget)}));
  const requestLimit=assistantRequestLimitError(input,trayItems),directActions=resolveDirectAssistantActions(input,workspace,selectedIds,trayItems);
  const confirmationRequest=unsupportedAssistantRequest(input);
  const directTimerRequest=assistantActionRequest(input,trayItems).includes('set_timer');
  const visibleMentions=mentionOpen?[
    {id:'__all__',label:t('allWidgets')},
    ...workspace.widgets.map(widget=>({id:widget.id,label:widgetLabel(widget)+(widget.minimized?' ('+t('minimized')+')':'')})),
  ].filter((item,index)=>index===0?(!mentionQuery||item.label.toLowerCase().includes(mentionQuery.toLowerCase())):item.label.toLowerCase().includes(mentionQuery.toLowerCase())):[];
  const currentModels=modelsByProvider[provider];
  function describeActions(actions:AssistantAction[],owner:Workspace,items:AssistantTrayItem[]){return assistantActionsDescription(actions,owner,items,{types:{add_widget:t('assistantActionAddWidget'),open_saved:t('assistantActionOpenSaved'),remove_widget:t('assistantActionRemoveWidget'),minimize:t('assistantActionMinimize'),restore:t('assistantActionRestore'),save_to_tray:t('assistantActionSaveToTray'),set_timer:t('assistantActionStartTimer'),edit_widget:t('assistantActionEditWidget'),set_widget_plugin:t('assistantActionChangeWidgetPlugin'),set_sidebar_plugin:t('assistantActionChangeSidebarPlugin'),rename_workspace:t('assistantActionRenameWorkspace')},widget:t('assistantActionUnknownWidget'),widgetType:type=>t('widget_'+type),widgetLabel:widget=>widget.title||t('widget_'+widget.type)+' '+widget.instanceNumber,named:t('assistantActionNamed'),withInitialNote:t('assistantActionWithNote'),seconds:t('assistantActionSeconds'),off:t('assistantActionOff'),join:t('assistantActionJoin')})}

  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  useEffect(()=>{const attach=(event:Event)=>{const detail=(event as CustomEvent<Partial<LibraryResourceContext>&{noteTarget?:Partial<NoteTarget>}>).detail;if(!detail||typeof detail.name!=='string'||typeof detail.path!=='string')return;const path=detail.path.slice(0,1000),fileWidgetId=typeof detail.fileWidgetId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(detail.fileWidgetId)?detail.fileWidgetId:null,safeRelativePath=!!path&&!path.startsWith('/')&&!path.includes(':')&&!path.includes('\\')&&path.split('/').every(segment=>!!segment&&segment!=='.'&&segment!=='..'),target=detail.noteTarget,noteTarget=target&&typeof target.widgetId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(target.widgetId)&&typeof target.noteId==='string'&&/^[a-zA-Z0-9-]{1,500}$/.test(target.noteId)&&typeof target.expectedText==='string'&&target.expectedText.length<=256000?{widgetId:target.widgetId,noteId:target.noteId,expectedText:target.expectedText,workspaceId:latest.current.id}:undefined;const resource:LibraryResourceContext={name:detail.name.slice(0,260),path,size:typeof detail.size==='number'?Math.max(0,detail.size):0,text:typeof detail.text==='string'?detail.text.slice(0,24000):'',notes:typeof detail.notes==='string'?detail.notes.slice(0,4000):'',prompt:typeof detail.prompt==='string'?detail.prompt.slice(0,8000):'',fileWidgetId,fileActionAllowed:detail.fileActionAllowed===true&&!!fileWidgetId&&safeRelativePath,...(noteTarget?{noteTarget}:{})};setLibraryResource(resource);setFileProposal(null);setCalendarProposal(null);setNoteDraftProposal(null);setInput(resource.prompt||formatAssistantText(translate(locale,'classifyResourcePrompt'),{name:resource.name}));setMentions([]);setError('')};window.addEventListener('still-assistant-resource',attach);return()=>window.removeEventListener('still-assistant-resource',attach)},[locale]);
  useEffect(()=>{const receive=(event:Event)=>{const prompt=(event as CustomEvent<unknown>).detail;if(typeof prompt!=='string'||!prompt.trim())return;setLibraryResource(null);setFileProposal(null);setCalendarProposal(null);setNoteDraftProposal(null);setInput(prompt.slice(0,8000));setMentions([]);setScreenshot(false);setPlan(null);setConfirmation(null);setError('')};window.addEventListener('still-assistant-prompt',receive);return()=>window.removeEventListener('still-assistant-prompt',receive)},[]);
  useEffect(()=>{if(chatState.workspaceId===workspace.id)saveAssistantChat(workspace.id,chatState.messages)},[chatState,workspace.id]);
  useEffect(()=>{if(chatState.workspaceId!==workspace.id){setChatState({workspaceId:workspace.id,messages:readAssistantChat(workspace.id)});setConfirmation(null);pendingActions.current=null;pendingPrompt.current=''}},[workspace.id,chatState.workspaceId]);
  useEffect(()=>{let cancelled=false;setConfigured(false);setModelsByProvider(value=>({...value,[provider]:[]}));setError('');
    if(!geminiAssistant.available){setSettings(false);return()=>{cancelled=true}}
    void geminiAssistant.configured(provider).then(async value=>{
      if(cancelled||!alive.current)return;setConfigured(value);setSettings(!value);
      if(value){try{const available=await geminiAssistant.models(provider);if(cancelled||!alive.current)return;setModelsByProvider(current=>({...current,[provider]:available}));setModel(current=>{const next=available.includes(current)?current:preferredModel(available,provider);savePreference(provider,next);return next})}
        catch(reason){if(!cancelled&&alive.current){setError(assistantKeyError(reason));setSettings(true)}}}
    }).catch(()=>{if(!cancelled&&alive.current){setSettings(true);setError('AI settings could not be loaded.')}});
    return()=>{cancelled=true};
  },[provider]);
  useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
  useEffect(()=>{if(screenshotWidget===null)setScreenshot(false)},[screenshotWidget?.id]);

  async function connect(){
    setError('');
    try{const available=await geminiAssistant.setKey(provider,key);if(!alive.current)return;setKey('');setModelsByProvider(value=>({...value,[provider]:available}));const next=preferredModel(available,provider);setModel(next);savePreference(provider,next);setConfigured(true);setSettings(false)}catch(reason){if(alive.current)setError(assistantKeyError(reason))}
  }
  async function disconnect(){
    try{await geminiAssistant.setKey(provider,'');if(alive.current){setKey('');setModelsByProvider(value=>({...value,[provider]:[]}));setConfigured(false);setSettings(true)}}catch{if(alive.current)setError(`Could not clear the ${PROVIDER_NAMES[provider]} key.`)}
  }
  function changeProvider(value:AssistantProvider){setProvider(value);setModel(DEFAULT_MODELS[value]);savePreference(value,DEFAULT_MODELS[value]);setKey('');setError('')}
  function chooseModel(value:string){const [nextProvider,nextModel]=value.split('::') as [AssistantProvider,string];if(!PROVIDERS.includes(nextProvider)||!nextModel)return;setProvider(nextProvider);setModel(nextModel);savePreference(nextProvider,nextModel);setError('')}
  function selectMention(item:Mention){
    const next=mentions.some(value=>value.id==='__all__')||item.id==='__all__'?[item]:[...mentions.filter(value=>value.id!==item.id),item];
    const label=item.id==='__all__'?'All widgets':item.label.replace(/\s\(minimized\)$/,'');
    setMentions(next);setInput(value=>value.slice(0,mentionRange.start)+`@${label} `+value.slice(mentionRange.end));setMentionOpen(false);setMentionQuery('');setScreenshot(false);
    requestAnimationFrame(()=>{const node=textarea.current;if(node){const caret=mentionRange.start+label.length+2;node.focus();node.setSelectionRange(caret,caret)}});
  }
  function onInputChange(event:ChangeEvent<HTMLTextAreaElement>){
    const value=event.target.value,caret=event.target.selectionStart;setInput(value);
    const start=value.lastIndexOf('@',caret-1),before=start<=0?' ':value[start-1],tail=value.slice(start+1,caret);
    if(start>=0&&/\s/.test(before)&&!/[\r\n]/.test(tail)&&! /\s/.test(tail)){
      setMentionRange({start,end:caret});setMentionQuery(tail);setMentionOpen(true);setMentionIndex(0);
    }else setMentionOpen(false);
  }
  function onInputKeyDown(event:KeyboardEvent<HTMLTextAreaElement>){
    if(event.nativeEvent.isComposing)return;
    if(mentionOpen&&event.key==='Escape'){event.preventDefault();setMentionOpen(false);return}
    if(mentionOpen&&event.key==='ArrowDown'){event.preventDefault();setMentionIndex(index=>Math.min(index+1,Math.max(visibleMentions.length-1,0)));return}
    if(mentionOpen&&event.key==='ArrowUp'){event.preventDefault();setMentionIndex(index=>Math.max(index-1,0));return}
    if(event.key!=='Enter'||event.shiftKey)return;
    event.preventDefault();
    if(mentionOpen){if(visibleMentions.length)selectMention(visibleMentions[mentionIndex]??visibleMentions[0]);return}
    void send();
  }
  async function send(){
    if(sending.current||!input.trim())return;
    if(requestLimit)return;
    const owner=latest.current,prompt=input.trim(),clarification=assistantEditClarification(prompt);
    if(clarification){setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:clarification}]);setInput('');setMentions([]);setScreenshot(false);setError('');setPlan(null);return}
    const acceptedOffer=resolveAcceptedNotesOffer(prompt,messages),notesRequest=resolveNamedNotesCreation(prompt),localActions=acceptedOffer?[acceptedOffer.action]:resolveDirectAssistantActions(prompt,owner,selectedIds,trayItems),actionIntent=acceptedOffer?.intent??prompt,needsConfirmation=unsupportedAssistantRequest(prompt);
    const requestedActions=assistantActionRequest(prompt,trayItems);
    if(requestedActions.includes('open_saved')&&!trayItems.length){setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantNoSavedItems')}]);setInput('');setMentions([]);return}
    const timerWidgets=owner.widgets.filter(widget=>widget.type==='focus'||widget.clockPluginEnabled),needsNewFocus=requestedActions.includes('set_timer')&&!localActions&&timerWidgets.length===0;
    if(requestedActions.includes('set_timer')&&!localActions&&!needsNewFocus){setError(t('assistantSelectFocusWidget'));return}
    if(!localActions&&!needsConfirmation&&!needsNewFocus&&(!configured||!currentModels.includes(model)||!geminiAssistant.available))return;
    const size=dimensions(),requestProvider=provider,requestModel=model;
    sending.current=true;setBusy(true);setPending(prompt);setError('');setPlan(null);setMentionOpen(false);
    let image:string|undefined;
    try{
      if(needsConfirmation){
        if(needsConfirmation==='delete_workspace'&&!canDeleteWorkspace){setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantKeepWorkspace')}]);setInput('');setMentions([]);return}
        const explanation=needsConfirmation==='clear_tray'?t('assistantClearTrayConfirm').replace('{workspace}',owner.name):needsConfirmation==='delete_workspace'?t('assistantDeleteWorkspaceConfirm').replace('{workspace}',owner.name):t('assistantDeleteWidgetsConfirm').replace('{workspace}',owner.name);
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:explanation}]);
        setConfirmation(needsConfirmation);setInput('');setMentions([]);setScreenshot(false);return;
      }
      if(needsNewFocus){
        const seconds=extractAssistantTimerSeconds(prompt);if(seconds===null)throw new Error(t('assistantTimerDurationExample'));
        const receipt=await startTimer(owner.id,seconds);if(!alive.current)return;
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:receipt}]);setInput('');setMentions([]);setScreenshot(false);return;
      }
      if(localActions){
        validateAssistantActions(owner,localActions,trayItems);validateAssistantActionIntent(actionIntent,owner,localActions,trayItems);
        if(localActions.some(action=>action.type==='remove_widget')){
          pendingActions.current=localActions;pendingPrompt.current=prompt;
          const names=localActions.filter(action=>action.type==='remove_widget').flatMap(action=>action.ids).map(id=>{const widget=owner.widgets.find(item=>item.id===id);return widget?widgetLabel(widget):''}).filter(Boolean);
          setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantRemoveWidgetsConfirm').replace('{names}',names.join(', ')).replace('{workspace}',owner.name)}]);setConfirmation('remove_widgets');setInput('');setMentions([]);return;
        }
        if(localActions.some(action=>action.type==='open_saved'&&action.ids.some(id=>trayItems.some(item=>item.id===id&&item.type==='apps')))){
          pendingActions.current=localActions;pendingPrompt.current=prompt;
          setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantOpenSavedAppsConfirm')}]);setConfirmation('open_saved_apps');setInput('');setMentions([]);return;
        }
        let actionsToApply=localActions,draftNotice='';
        if(notesRequest?.topic&&localActions.some(action=>action.type==='add_widget'&&action.ids.length===1&&action.ids[0]==='notes')){
          if(configured&&currentModels.includes(requestModel)&&geminiAssistant.available){
            try{
              const draft=await geminiAssistant.send({provider:requestProvider,model:requestModel,messages:[{role:'user',text:`Write concise, accurate study notes suitable for a student about: ${notesRequest.topic}. Use a short heading and organized bullet points. Return only the note content; do not perform workspace actions.`}],context:'',session_id:owner.id});
              if(!draft.reply.trim()||draft.actions.length||draft.layout.length)throw new Error('The AI did not return note text only.');
              const draftedActions=[{...localActions[0],text:draft.reply}];validateAssistantActions(owner,draftedActions,trayItems);actionsToApply=draftedActions;
            }catch{draftNotice=' I added the requested topic to the note, but could not draft the full notes right now.'}
          }else draftNotice=' I added the requested topic to the note; connect an AI provider if you want Still to draft the full notes.';
        }
        const receipt=safeAssistantReceipt(await act(owner.id,actionsToApply,actionIntent))+draftNotice;if(!alive.current)return;
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:receipt}]);setInput('');setMentions([]);setScreenshot(false);return;
      }
      const context=assistantWorkspaceContext(owner,size.width,size.height,selectedIds,trayItems,sidebarPlugins),selectedResourceForModel=libraryResource?{name:libraryResource.name,path:libraryResource.path,size:libraryResource.size,text:libraryResource.text,notes:libraryResource.notes,fileActionAllowed:libraryResource.fileActionAllowed,contentOmitted:!libraryResource.text}:null,serialized=JSON.stringify(selectedResourceForModel?{...context,selectedStudyResource:selectedResourceForModel}:context);
      if(serialized.length>64000)throw new Error('This workspace has unusually large widget data. Type @ to prioritize the widget you want Still to use.');
      image=shareWorkspaceImage?(screenshotWidget?await widgetImage(screenshotWidget.id):await workspaceImage()):screenshot&&screenshotWidget?await widgetImage(screenshotWidget.id):undefined;
      const history=prepareAssistantHistory(messages);
      let result=await geminiAssistant.send({provider:requestProvider,model:requestModel,messages:[...history,{role:'user',text:prompt}],context:serialized,image,session_id:owner.id});
      if(!alive.current)return;
      if(result.fileProposals?.length){
        if(!libraryResource?.fileActionAllowed||!libraryResource.fileWidgetId||!libraryResource.path)throw new Error(t('fileMoveUnavailable'));
        const proposal=result.fileProposals[0];setFileProposal({...proposal,fileName:libraryResource.name,widgetId:libraryResource.fileWidgetId,sourcePath:libraryResource.path});
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setLibraryResource(null);setPlan(null);setInput('');setMentions([]);setScreenshot(false);return;
      }
      if(result.calendarProposals?.length){
        const calendar=owner.widgets.find(widget=>widget.type==='calendar');
        if(!calendar)throw new Error(t('calendarProposalUnavailable'));
        const events=checkedStudyCalendarDrafts(result.calendarProposals);
        setCalendarProposal({widgetId:calendar.id,events});setFileProposal(null);setPlan(null);setConfirmation(null);
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setLibraryResource(null);setInput('');setMentions([]);setScreenshot(false);return;
      }
      const targetedNoteEdit=result.actions.length===1&&result.actions[0].type==='edit_widget'&&result.actions[0].ids.length===1&&result.actions[0].ids[0]===libraryResource?.noteTarget?.widgetId&&typeof result.actions[0].text==='string'&&!result.actions[0].title&&!result.actions[0].tagColor&&!result.actions[0].pluginControls;
      const noteDraftText=targetedNoteEdit?result.actions[0].text:result.reply;
      if(libraryResource?.noteTarget&&result.intent!=='clarification'&&noteDraftText?.trim()&&(!result.actions.length||targetedNoteEdit)&&!result.layout.length){
        setNoteDraftProposal({...libraryResource.noteTarget,draft:noteDraftText.trim()});setFileProposal(null);setCalendarProposal(null);setPlan(null);
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setLibraryResource(null);setInput('');setMentions([]);setScreenshot(false);return;
      }
      if(libraryResource)setLibraryResource(null);
      if(result.actions.length&&assistantReplyNeedsClarification(result.reply)){
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setPlan(null);setInput('');setMentions([]);setScreenshot(false);return;
      }
      if(result.actions.length){
        validateAssistantActions(owner,result.actions,trayItems);
        let reviewActions=!requestedActions.length;
        try{validateAssistantActionIntent(prompt,owner,result.actions,trayItems)}catch{reviewActions=true}
        if(reviewActions){
          pendingActions.current=result.actions;pendingPrompt.current='Apply the reviewed widget changes.';
          setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:formatAssistantText(t('assistantSuggestedChangesMessage'),{reply:result.reply,changes:describeActions(result.actions,owner,trayItems)})}]);setConfirmation('workspace_actions');setPlan(null);setInput('');setMentions([]);return;
        }
        if(result.actions.some(action=>action.type==='remove_widget')){
          pendingActions.current=result.actions;pendingPrompt.current=prompt;
          const names=result.actions.filter(action=>action.type==='remove_widget').flatMap(action=>action.ids).map(id=>{const widget=owner.widgets.find(item=>item.id===id);return widget?widgetLabel(widget):''}).filter(Boolean);
          setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantRemoveWidgetsConfirm').replace('{names}',names.join(', ')).replace('{workspace}',owner.name)}]);setConfirmation('remove_widgets');setPlan(null);setInput('');setMentions([]);return;
        }
        if(result.actions.some(action=>action.type==='open_saved'&&action.ids.some(id=>trayItems.some(item=>item.id===id&&item.type==='apps')))){
          pendingActions.current=result.actions;pendingPrompt.current=prompt;
          setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:t('assistantOpenSavedAppsConfirm')}]);setConfirmation('open_saved_apps');setPlan(null);setInput('');setMentions([]);return;
        }
        const receipt=safeAssistantReceipt(await act(owner.id,result.actions,prompt));if(!alive.current)return;
        setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:receipt}]);setPlan(null);setInput('');setMentions([]);setScreenshot(false);return;
      }
      let layoutPlan:LayoutPlan|null=null;
      if(result.layout.length&&assistantLayoutRequested(prompt)){
        try{validateLayout(owner,result.layout,size.width,size.height);layoutPlan={workspaceId:owner.id,fingerprint:layoutFingerprint(owner),width:size.width,height:size.height,items:result.layout}}
        catch(firstFailure){
          const reason=firstFailure instanceof Error?firstFailure.message:'The proposed layout was invalid.';
          const correction=`Still rejected your previous layout because: ${reason} No changes were applied. Recreate the layout for the original request using the current widget positions and sizes in the workspace context. Keep widgets the user asked to leave in place at their original positions. Include every expanded widget exactly once, preserve widget sizes, respect canvas bounds and minimum sizes, keep at least 16 pixels between widgets, and avoid all overlap with expanded or minimized widgets. Return no actions.`;
          result=await geminiAssistant.send({provider:requestProvider,model:requestModel,messages:[...history,{role:'user',text:prompt},{role:'model',text:result.reply},{role:'user',text:correction}],context:serialized,image,session_id:owner.id});
          if(!alive.current)return;
          if(result.layout.length&&assistantLayoutRequested(prompt)){
            try{validateLayout(owner,result.layout,size.width,size.height);layoutPlan={workspaceId:owner.id,fingerprint:layoutFingerprint(owner),width:size.width,height:size.height,items:result.layout}}
            catch{throw new Error('Still could not create a valid layout after retrying once. Nothing was changed. Try a simpler arrangement.')}
          }else if(result.intent==='clarification'||assistantReplyNeedsClarification(result.reply)){
            setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setPlan(null);setInput('');setMentions([]);setScreenshot(false);return;
          }else throw new Error('Still could not create a valid layout after retrying once. Nothing was changed. Try a simpler arrangement.');
        }
      }
      const reply=layoutPlan?t('assistantPreparedLayoutReply'):requestedActions.length&&result.intent!=='chat'&&result.intent!=='clarification'?`${result.reply}\n\n${t('noWorkspaceChanges')}`:result.reply;
      setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:reply}]);setInput('');setMentions([]);setScreenshot(false);setPlan(layoutPlan);
    }catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}
    finally{image=undefined;sending.current=false;if(alive.current){setBusy(false);setPending('');setScreenshot(false)}}
  }
  async function confirmPendingAction(){
    if(sending.current||!confirmation)return;
    const owner=latest.current;sending.current=true;setBusy(true);setError('');
    try{const receipt=(confirmation==='open_saved_apps'||confirmation==='remove_widgets'||confirmation==='workspace_actions')&&pendingActions.current?safeAssistantReceipt(await act(owner.id,pendingActions.current,pendingPrompt.current)):confirmation==='clear_tray'?await clearTray(owner.id):confirmation==='delete_workspace'?await deleteWorkspace(owner.id):await deleteWidgets(owner.id);if(!alive.current)return;setMessages(current=>settleAssistantConfirmation(current,receipt));setConfirmation(null);pendingActions.current=null;pendingPrompt.current=''}
    catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}
    finally{sending.current=false;if(alive.current)setBusy(false)}
  }
  function cancelPendingAction(){setConfirmation(null);pendingActions.current=null;pendingPrompt.current='';setMessages(current=>settleAssistantConfirmation(current,t('cancelledNoChanges')))}
  function applyProposal(){if(!plan)return;try{const size=dimensions();applyLayoutPlan(latest.current,plan,size.width,size.height);apply(plan);setPlan(null);setError('')}catch(reason){setPlan(null);setError(reason instanceof Error?reason.message:String(reason))}}
  async function moveProposedFile(){if(!fileProposal||sending.current)return;if(!moveFile){setError(t('fileMoveUnavailable'));return}sending.current=true;setBusy(true);setError('');try{const destination=await moveFile(workspace.id,fileProposal.widgetId,fileProposal.sourcePath,fileProposal.destinationFolder);if(!alive.current)return;setMessages(current=>settleAssistantConfirmation(current,formatAssistantText(t('fileMoveCompleted'),{file:fileProposal.fileName,folder:destination})));setFileProposal(null)}catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}finally{sending.current=false;if(alive.current)setBusy(false)}}
  async function addProposedCalendarEvents(){if(!calendarProposal||sending.current)return;sending.current=true;setBusy(true);setError('');try{const receipt=await addCalendarEvents(workspace.id,calendarProposal.widgetId,calendarProposal.events);if(!alive.current)return;setMessages(current=>settleAssistantConfirmation(current,receipt));setCalendarProposal(null)}catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}finally{sending.current=false;if(alive.current)setBusy(false)}}
  function cancelCalendarProposal(){setCalendarProposal(null);setMessages(current=>settleAssistantConfirmation(current,t('cancelledNoChanges')))}
  async function applyNoteDraft(mode:'replace'|'append'){if(!noteDraftProposal||sending.current)return;if(latest.current.id!==noteDraftProposal.workspaceId){setNoteDraftProposal(null);setError(t('noteDraftUnavailable'));return}sending.current=true;setBusy(true);setError('');try{const proposal=noteDraftProposal,receipt=await new Promise<string>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error(t('noteDraftUnavailable'))),30000);const complete=(action:(value:string)=>void)=>(value:string)=>{window.clearTimeout(timer);action(value)};window.dispatchEvent(new CustomEvent('still-notes-apply-ai-draft',{detail:{...proposal,mode,resolve:complete(resolve),reject:complete(reject)}}))});if(!alive.current)return;setMessages(current=>settleAssistantConfirmation(current,receipt));setNoteDraftProposal(null)}catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}finally{sending.current=false;if(alive.current)setBusy(false)}}
  function cancelNoteDraft(){setNoteDraftProposal(null);setMessages(current=>settleAssistantConfirmation(current,t('cancelledNoChanges')))}

  return <aside id="ai-sidebar" className="assistant-panel" aria-hidden={!open} inert={!open} aria-label={t('aiAssistant')}>
    <header className="assistant-heading"><Icon name="ai"/><div><strong>Still AI</strong><small>{configured?formatAssistantText(t('aiConnected'),{provider:PROVIDER_NAMES[provider]}):t('aiConnectPrompt')}</small></div><button onClick={()=>setSettings(value=>!value)} aria-label={t('aiSettings')} aria-expanded={settings}><Icon name="settings"/></button><button onClick={close} aria-label={t('closeAiSidebar')}>×</button></header>
    {!geminiAssistant.available&&<p className="assistant-notice">{t('aiUnavailable')}</p>}
    {settings&&<form className="assistant-settings" onSubmit={event=>{event.preventDefault();void connect()}}>
      <label>{t('aiProvider')}<select value={provider} disabled={busy} onChange={event=>changeProvider(event.target.value as AssistantProvider)}>{PROVIDERS.map(value=><option key={value} value={value}>{PROVIDER_NAMES[value]}</option>)}</select></label>
      <p>{provider==='gemini'?<>{t('aiGeminiKeyHelp')} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" onClick={event=>{if(geminiAssistant.available){event.preventDefault();void geminiAssistant.keySetup(provider).catch(()=>setError(t('openGoogleAiStudioForKeyError')))}}}>Google AI Studio</a>.</>:provider==='openai'?<>{t('aiOpenAiKeyHelp')} <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" onClick={event=>{if(geminiAssistant.available){event.preventDefault();void geminiAssistant.keySetup(provider).catch(()=>setError(t('openOpenAiSettingsForKeyError')))}}}>OpenAI API settings</a>. {t('aiBilledSeparately')}</>:<>{t('aiOpenCodeKeyHelp')} <a href="https://opencode.ai/auth" target="_blank" rel="noreferrer" onClick={event=>{if(geminiAssistant.available){event.preventDefault();void geminiAssistant.keySetup(provider).catch(()=>setError(t('openOpenCodeForKeyError')))}}}>OpenCode Go</a> {t('aiPasteKey')}</>}</p>
      <label>{formatAssistantText(t('aiApiKey'),{provider:PROVIDER_NAMES[provider]})}<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={event=>setKey(event.target.value)} placeholder={formatAssistantText(t('aiEnterKey'),{provider:PROVIDER_NAMES[provider]})} disabled={!geminiAssistant.available||busy}/></label>
      <small>{t('aiSecureKeyNotice')}</small>
      <label className="assistant-check"><input type="checkbox" aria-label={t('aiShareWorkspace')} checked={shareWorkspaceImage} disabled={busy} onChange={event=>{setShareWorkspaceImage(event.target.checked);saveWorkspaceImagePreference(event.target.checked)}}/>{t('aiShareWorkspace')}</label>
      <small>{t('aiScreenshotPrivacy')}</small>
      <div className="assistant-row"><button type="button" disabled={!geminiAssistant.available||busy} onClick={()=>void geminiAssistant.keySetup(provider).catch(()=>setError(formatAssistantText(t('couldNotOpenProviderSettings'),{provider:PROVIDER_NAMES[provider]})))}>{t('aiGetKey')}</button><button className="primary" disabled={!key.trim()||busy||!geminiAssistant.available}>{t('connect')}</button>{configured&&<button type="button" disabled={busy} onClick={()=>void disconnect()}>{t('forget')}</button>}</div>
    </form>}
    <div ref={log} className="assistant-log" role="log" aria-label={t('aiConversation')} aria-live="polite" aria-busy={busy}>
      {!messages.length&&!busy&&<div className="assistant-empty"><Icon name="ai"/><h2>{t('aiWelcomeTitle')}</h2><p>{t('aiWelcomeBody')}</p></div>}
      {messages.map((message,index)=><div className={'assistant-message '+message.role} key={index}><small>{message.role==='user'?t('you'):'Still AI'}</small><p>{message.text}</p></div>)}
      {busy&&<><div className="assistant-message user"><small>{t('you')}</small><p>{pending}</p></div><p className="assistant-thinking" role="status">{t('thinking')}</p></>}
    </div>
    {confirmation==='workspace_actions'&&<section className="assistant-proposal assistant-confirmation" aria-label={t('confirmSuggestedWidgetChanges')}>
      <strong>{t('applySuggestedWidgetChanges')}</strong><p>{describeActions(pendingActions.current??[],workspace,trayItems)}. {t('noChangesMade')}</p>
      <div className="assistant-row"><button type="button" onClick={cancelPendingAction} disabled={busy}>{t('cancel')}</button><button type="button" className="primary" onClick={()=>void confirmPendingAction()} disabled={busy}>{busy?t('working'):t('confirmApply')}</button></div>
    </section>}
    {confirmation&&confirmation!=='workspace_actions'&&<section className="assistant-proposal assistant-confirmation" aria-label={t('confirmAssistantAction')}><strong>{t(confirmation==='clear_tray'?'confirmClearTrayTitle':confirmation==='delete_workspace'?'confirmDeleteWorkspaceTitle':confirmation==='delete_widgets'?'confirmDeleteWidgetsTitle':confirmation==='remove_widgets'?'confirmRemoveWidgetsTitle':'confirmOpenSavedAppsTitle')}</strong><p>{formatAssistantText(t(confirmation==='clear_tray'?'confirmClearTrayBody':confirmation==='delete_workspace'?'confirmDeleteWorkspaceBody':confirmation==='delete_widgets'?'confirmDeleteWidgetsBody':confirmation==='remove_widgets'?'confirmRemoveWidgetsBody':'confirmOpenSavedAppsBody'),{workspace:workspace.name})}</p><div className="assistant-row"><button type="button" onClick={cancelPendingAction} disabled={busy}>{t('cancel')}</button><button type="button" className="primary" onClick={()=>void confirmPendingAction()} disabled={busy}>{busy?t('working'):t(confirmation==='open_saved_apps'?'confirmOpen':confirmation==='delete_workspace'?'confirmDelete':'confirmRemove')}</button></div></section>}
    {fileProposal&&<section className="assistant-proposal assistant-confirmation" aria-label={t('fileMoveReview')}><strong>{t('fileMoveReview')}</strong><p>{formatAssistantText(t('fileMoveQuestion'),{file:fileProposal.fileName})}</p><p>{t('fileMoveDestination')} <code>{fileProposal.destinationFolder}</code></p><p>{t('fileMoveReason')} {fileProposal.reason}</p><div className="assistant-row"><button type="button" disabled={busy} onClick={()=>setFileProposal(null)}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void moveProposedFile()}>{busy?t('working'):t('moveFile')}</button></div></section>}
    {calendarProposal&&<section className="assistant-proposal assistant-confirmation" aria-label={t('calendarProposalReview')}><strong>{t('calendarProposalReview')}</strong><p>{t('calendarProposalIntro')}</p><ol className="assistant-calendar-proposals">{calendarProposal.events.map((event,index)=><li key={`${event.date}-${index}`}><time>{event.date}{event.time?` · ${event.time}`:` · ${t('allDay')}`}</time><strong>{event.title}</strong><small>{t(event.category)}</small></li>)}</ol><div className="assistant-row"><button type="button" disabled={busy} onClick={cancelCalendarProposal}>{t('cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void addProposedCalendarEvents()}>{busy?t('working'):formatAssistantText(t('addProposedEvents'),{count:String(calendarProposal.events.length)})}</button></div></section>}
    {noteDraftProposal&&<section className="assistant-proposal assistant-note-draft" aria-label={t('noteDraftReview')}><strong>{t('noteDraftReview')}</strong><p>{t('noteDraftIntro')}</p><pre>{noteDraftProposal.draft}</pre><div className="assistant-row"><button type="button" disabled={busy} onClick={cancelNoteDraft}>{t('cancel')}</button><button type="button" disabled={busy} onClick={()=>void applyNoteDraft('append')}>{t('appendToNote')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void applyNoteDraft('replace')}>{busy?t('working'):t('replaceNote')}</button></div></section>}
    {plan&&<section className="assistant-proposal" aria-label={t('proposedLayout')}><strong>{t('proposedLayout')}</strong><svg role="img" aria-label={t('previewWidgetPositions')} viewBox={`0 0 ${plan.width} ${plan.height}`}><rect className="assistant-preview-bg" width={plan.width} height={plan.height}/>{plan.items.map(item=><g key={item.id}><rect x={item.x} y={item.y} width={item.width} height={item.height}/><title>{workspace.widgets.find(widget=>widget.id===item.id)?widgetLabel(workspace.widgets.find(widget=>widget.id===item.id)!):t('removedWidget')}</title></g>)}</svg><details><summary>{t('widgetPositionsCount').replace('{count}',String(plan.items.length))}</summary>{plan.items.map(item=><p key={item.id}>{workspace.widgets.find(widget=>widget.id===item.id)?widgetLabel(workspace.widgets.find(widget=>widget.id===item.id)!):t('removedWidget')}: {item.x}, {item.y} · {item.width} × {item.height}</p>)}</details><div className="assistant-row"><button className="primary" onClick={applyProposal}>{t('applyLayout')}</button><button onClick={()=>setPlan(null)}>{t('dismiss')}</button></div></section>}
    {error&&<p className="assistant-error" role="alert">{error}</p>}
    <form className="assistant-compose" onSubmit={event=>{event.preventDefault();void send()}}>
      {selectedMentions.length>0&&<div className="assistant-mentions" aria-label={t('shareWidgets')}>{selectedMentions.map(item=><button type="button" key={item.id} onClick={()=>{setInput(current=>removeAssistantWidgetMention(current,workspace,item.id));setMentions(current=>current.filter(value=>value.id!==item.id))}} aria-label={formatAssistantText(t('removeFromMessage'),{label:item.label})}>@ {item.label} ×</button>)}</div>}
      {screenshotWidget&&<label className="assistant-check"><input type="checkbox" checked={screenshot} disabled={busy} onChange={event=>setScreenshot(event.target.checked)}/>{formatAssistantText(t('shareScreenshot'),{widget:widgetLabel(screenshotWidget)})}</label>}
      {screenshotWidget&&<small className="assistant-inline-note">{t('imageModelRequired')}</small>}
      <div className="assistant-input-wrap">
        {mentionOpen&&<div className="assistant-mention-picker" role="listbox" aria-label={t('selectWidgets')}>{visibleMentions.length?visibleMentions.map((item,index)=><button type="button" role="option" aria-selected={index===mentionIndex} key={item.id} onMouseDown={event=>event.preventDefault()} onClick={()=>selectMention(item)}>{item.label}</button>):<p>{t('noMatchingWidgets')}</p>}</div>}
        {libraryResource&&<div className="assistant-resource-context"><span>{t('selectedContextForAi')} <strong title={libraryResource.path}>{libraryResource.name}</strong>{libraryResource.text?' · '+t('textIncluded'):' · '+t('metadataNotesOnly')}</span><button type="button" aria-label={t('removeAiContext')} onClick={()=>setLibraryResource(null)}>×</button></div>}
        <label className="sr-only" htmlFor="ai-message">{t('messageStillAi')}</label><textarea ref={textarea} id="ai-message" value={input} onChange={onInputChange} onKeyDown={onInputKeyDown} maxLength={8000} disabled={busy} placeholder={t('messageStillAi')+'…'} rows={3}/>
      </div>
      {requestLimit&&<p className="assistant-error" role="alert">{requestLimit}</p>}
      <div className="assistant-compose-footer"><label className="sr-only" htmlFor="ai-model">{t('aiModel')}</label><select id="ai-model" aria-label={t('aiModel')} value={modelsByProvider[provider].includes(model)?`${provider}::${model}`:''} onChange={event=>chooseModel(event.target.value)} disabled={busy||!!fileProposal||!!calendarProposal||!!noteDraftProposal||!PROVIDERS.some(value=>modelsByProvider[value].length)}><option value="" disabled>{configured?t('loadingModels'):t('chooseModel')}</option>{PROVIDERS.map(value=><optgroup key={value} label={PROVIDER_NAMES[value]}>{modelsByProvider[value].length?modelsByProvider[value].map(name=><option key={name} value={`${value}::${name}`}>{name}</option>):<option disabled value={`${value}::__connect`}>{t('connectInSettings')}</option>}</optgroup>)}</select><button type="button" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setPlan(null);setConfirmation(null);setFileProposal(null);setCalendarProposal(null);setNoteDraftProposal(null);pendingActions.current=null;pendingPrompt.current='';setError('')}}>{t('clearChat')}</button><button type="button" disabled={busy} onClick={undo}>{t('undoChange')}</button><button className="primary" disabled={busy||!!fileProposal||!!calendarProposal||!!noteDraftProposal||!!requestLimit||(!directActions&&!confirmationRequest&&!directTimerRequest&&(!configured||!currentModels.includes(model)||!geminiAssistant.available))||!input.trim()}>{busy?t('working'):t('send')}</button></div>
      <small>{t('assistantUsageNote')}</small>
    </form>
  </aside>;
}
