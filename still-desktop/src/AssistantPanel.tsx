import {useEffect,useRef,useState,type ChangeEvent,type KeyboardEvent} from 'react';
import type {Workspace,WidgetInstance} from './domain/workspaces.ts';
import {applyLayoutPlan,assistantKeyError,assistantWorkspaceContext,DEFAULT_MODELS,HISTORY_LIMIT,layoutFingerprint,preferredModel,validateLayout,widgetLabel,type AssistantProvider,type ChatMessage,type LayoutPlan} from './domain/assistant.ts';
import {geminiAssistant,widgetImage} from './platform/assistant.ts';
import {Icon} from './widgets.tsx';
import './assistant.css';

type Props={workspace:Workspace;open:boolean;close:()=>void;dimensions:()=>{width:number;height:number};apply:(plan:LayoutPlan)=>void;undo:()=>void};
type Mention={id:string;label:string};
const PROVIDERS:AssistantProvider[]=['gemini','openai'];
const PROVIDER_NAMES:Record<AssistantProvider,string>={gemini:'Gemini',openai:'OpenAI'};
const PREFERENCE_KEY='still-assistant-model';
function readPreference():{provider:AssistantProvider;model:string}{
  try{const [provider,model]=localStorage.getItem(PREFERENCE_KEY)?.split('::')??[];if((provider==='gemini'||provider==='openai')&&model)return{provider,model}}catch{/* preview storage can be disabled */}
  return{provider:'gemini',model:DEFAULT_MODELS.gemini};
}
function savePreference(provider:AssistantProvider,model:string){try{localStorage.setItem(PREFERENCE_KEY,`${provider}::${model}`)}catch{/* preference is optional */}}
function canScreenshot(widget:WidgetInstance){return widget.type==='apps'||widget.type==='desmos'||widget.type==='files'}

export default function AssistantPanel({workspace,open,close,dimensions,apply,undo}:Props){
  const [initial]=useState(readPreference);
  const [configured,setConfigured]=useState(false),[settings,setSettings]=useState(false),[key,setKey]=useState('');
  const [provider,setProvider]=useState<AssistantProvider>(initial.provider),[model,setModel]=useState(initial.model),[modelsByProvider,setModelsByProvider]=useState<Record<AssistantProvider,string[]>>({gemini:[],openai:[]});
  const [input,setInput]=useState(''),[mentions,setMentions]=useState<Mention[]>([]),[mentionOpen,setMentionOpen]=useState(false),[mentionQuery,setMentionQuery]=useState(''),[mentionRange,setMentionRange]=useState({start:0,end:0}),[mentionIndex,setMentionIndex]=useState(0);
  const [screenshot,setScreenshot]=useState(false),[messages,setMessages]=useState<ChatMessage[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(''),[plan,setPlan]=useState<LayoutPlan|null>(null);
  const alive=useRef(true),sending=useRef(false),latest=useRef(workspace),textarea=useRef<HTMLTextAreaElement>(null),log=useRef<HTMLDivElement>(null);
  latest.current=workspace;
  const selectedIds=mentions.some(item=>item.id==='__all__')?workspace.widgets.map(widget=>widget.id):mentions.map(item=>item.id);
  const selectedWidgets=selectedIds.map(id=>workspace.widgets.find(widget=>widget.id===id)).filter((widget):widget is WidgetInstance=>!!widget);
  const screenshotWidget=selectedWidgets.length===1&&canScreenshot(selectedWidgets[0])?selectedWidgets[0]:null;
  const visibleMentions=mentionOpen?[
    {id:'__all__',label:'All widgets'},
    ...workspace.widgets.map(widget=>({id:widget.id,label:widgetLabel(widget)+(widget.minimized?' (minimized)':'')})),
  ].filter((item,index)=>index===0?(!mentionQuery||'all widgets'.includes(mentionQuery.toLowerCase())):item.label.toLowerCase().includes(mentionQuery.toLowerCase())):[];
  const currentModels=modelsByProvider[provider];

  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
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
    if(!mentionOpen)return;
    if(event.key==='Escape'){event.preventDefault();setMentionOpen(false);return}
    if(event.key==='ArrowDown'){event.preventDefault();setMentionIndex(index=>Math.min(index+1,Math.max(visibleMentions.length-1,0)));return}
    if(event.key==='ArrowUp'){event.preventDefault();setMentionIndex(index=>Math.max(index-1,0));return}
    if(event.key==='Enter'&&!event.shiftKey&&visibleMentions.length){event.preventDefault();selectMention(visibleMentions[mentionIndex]??visibleMentions[0])}
  }
  async function send(){
    if(sending.current||!input.trim()||!configured||!currentModels.includes(model)||!geminiAssistant.available)return;
    const owner=latest.current,prompt=input.trim(),size=dimensions(),requestProvider=provider,requestModel=model;
    sending.current=true;setBusy(true);setPending(prompt);setError('');setPlan(null);setMentionOpen(false);
    try{
      const context=assistantWorkspaceContext(owner,size.width,size.height,selectedIds),serialized=JSON.stringify(context);
      if(serialized.length>64000)throw new Error('That selection contains too much widget data. Mention fewer widgets and try again.');
      const image=screenshot&&screenshotWidget?await widgetImage(screenshotWidget.id):undefined;
      const history=messages.slice(-HISTORY_LIMIT).map(message=>({...message,text:message.text.slice(0,message.role==='model'?6000:8000)}));
      const result=await geminiAssistant.send({provider:requestProvider,model:requestModel,messages:[...history,{role:'user',text:prompt}],context:serialized,image});
      if(!alive.current)return;
      setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setInput('');setMentions([]);setScreenshot(false);
      if(result.layout.length){validateLayout(owner,result.layout,size.width,size.height);setPlan({workspaceId:owner.id,fingerprint:layoutFingerprint(owner),width:size.width,height:size.height,items:result.layout})}
    }catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}
    finally{sending.current=false;if(alive.current){setBusy(false);setPending('')}}
  }
  function applyProposal(){if(!plan)return;try{const size=dimensions();applyLayoutPlan(latest.current,plan,size.width,size.height);apply(plan);setPlan(null);setError('')}catch(reason){setPlan(null);setError(reason instanceof Error?reason.message:String(reason))}}

  return <aside id="ai-sidebar" className="assistant-panel" hidden={!open} aria-label="Still AI assistant">
    <header className="assistant-heading"><Icon name="ai"/><div><strong>Still AI</strong><small>{configured?`${PROVIDER_NAMES[provider]} connected`:'Connect an AI provider to start'}</small></div><button onClick={()=>setSettings(value=>!value)} aria-label="AI settings" aria-expanded={settings}><Icon name="settings"/></button><button onClick={close} aria-label="Close AI sidebar">×</button></header>
    {!geminiAssistant.available&&<p className="assistant-notice">Connect and chat with AI in the Still desktop app.</p>}
    {settings&&<form className="assistant-settings" onSubmit={event=>{event.preventDefault();void connect()}}>
      <label>Provider<select value={provider} disabled={busy} onChange={event=>changeProvider(event.target.value as AssistantProvider)}>{PROVIDERS.map(value=><option key={value} value={value}>{PROVIDER_NAMES[value]}</option>)}</select></label>
      <p>{provider==='gemini'?<>Create a Gemini key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" onClick={event=>{if(geminiAssistant.available){event.preventDefault();void geminiAssistant.keySetup(provider).catch(()=>setError('Open Google AI Studio to create a Gemini key.'))}}}>Google AI Studio</a>.</>:<>Create an OpenAI API key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" onClick={event=>{if(geminiAssistant.available){event.preventDefault();void geminiAssistant.keySetup(provider).catch(()=>setError('Open OpenAI API settings to create an API key.'))}}}>OpenAI API settings</a>. API usage is billed separately from ChatGPT.</>}</p>
      <label>{PROVIDER_NAMES[provider]} API key<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={event=>setKey(event.target.value)} placeholder={`Enter ${PROVIDER_NAMES[provider]} key`} disabled={!geminiAssistant.available||busy}/></label>
      <small>Connected keys stay in Still's memory until the app closes. They are never saved to chat or workspace data.</small>
      <div className="assistant-row"><button type="button" disabled={!geminiAssistant.available||busy} onClick={()=>void geminiAssistant.keySetup(provider).catch(()=>setError(`Could not open ${PROVIDER_NAMES[provider]} API settings.`))}>Get API key</button><button className="primary" disabled={!key.trim()||busy||!geminiAssistant.available}>Connect</button>{configured&&<button type="button" disabled={busy} onClick={()=>void disconnect()}>Forget</button>}</div>
    </form>}
    <div ref={log} className="assistant-log" role="log" aria-label="AI conversation" aria-live="polite" aria-busy={busy}>
      {!messages.length&&!busy&&<div className="assistant-empty"><Icon name="ai"/><h2>A little help with your space.</h2><p>Ask a question, type <kbd>@</kbd> to share widgets, or ask Still AI to arrange your workspace.</p></div>}
      {messages.map((message,index)=><div className={'assistant-message '+message.role} key={index}><small>{message.role==='user'?'You':'Still AI'}</small><p>{message.text}</p></div>)}
      {busy&&<><div className="assistant-message user"><small>You</small><p>{pending}</p></div><p className="assistant-thinking" role="status">Thinking…</p></>}
    </div>
    {plan&&<section className="assistant-proposal" aria-label="Proposed layout"><strong>Proposed layout</strong><svg role="img" aria-label="Preview of proposed widget positions" viewBox={`0 0 ${plan.width} ${plan.height}`}><rect className="assistant-preview-bg" width={plan.width} height={plan.height}/>{plan.items.map(item=><g key={item.id}><rect x={item.x} y={item.y} width={item.width} height={item.height}/><title>{workspace.widgets.find(widget=>widget.id===item.id)?widgetLabel(workspace.widgets.find(widget=>widget.id===item.id)!):'Removed widget'}</title></g>)}</svg><details><summary>{plan.items.length} widget positions</summary>{plan.items.map(item=><p key={item.id}>{workspace.widgets.find(widget=>widget.id===item.id)?widgetLabel(workspace.widgets.find(widget=>widget.id===item.id)!):'Removed widget'}: {item.x}, {item.y} · {item.width} × {item.height}</p>)}</details><div className="assistant-row"><button className="primary" onClick={applyProposal}>Apply layout</button><button onClick={()=>setPlan(null)}>Dismiss</button></div></section>}
    {error&&<p className="assistant-error" role="alert">{error}</p>}
    <form className="assistant-compose" onSubmit={event=>{event.preventDefault();void send()}}>
      {mentions.length>0&&<div className="assistant-mentions" aria-label="Widgets shared with AI">{mentions.map(item=><button type="button" key={item.id} onClick={()=>setMentions(current=>current.filter(value=>value.id!==item.id))} aria-label={`Remove ${item.label} from message`}>@ {item.label} ×</button>)}</div>}
      {screenshotWidget&&<label className="assistant-check"><input type="checkbox" checked={screenshot} disabled={busy} onChange={event=>setScreenshot(event.target.checked)}/>Send visible screenshot of {widgetLabel(screenshotWidget)} with this message</label>}
      {screenshotWidget&&<small className="assistant-inline-note">Visual sharing requires a model that accepts images.</small>}
      <div className="assistant-input-wrap">
        {mentionOpen&&<div className="assistant-mention-picker" role="listbox" aria-label="Select widgets to share">{visibleMentions.length?visibleMentions.map((item,index)=><button type="button" role="option" aria-selected={index===mentionIndex} key={item.id} onMouseDown={event=>event.preventDefault()} onClick={()=>selectMention(item)}>{item.label}</button>):<p>No matching widgets</p>}</div>}
        <label className="sr-only" htmlFor="ai-message">Message Still AI</label><textarea ref={textarea} id="ai-message" value={input} onChange={onInputChange} onKeyDown={onInputKeyDown} maxLength={8000} disabled={busy} placeholder="Message Still AI…" rows={3}/>
      </div>
      <div className="assistant-compose-footer"><label className="sr-only" htmlFor="ai-model">AI model</label><select id="ai-model" aria-label="AI model" value={modelsByProvider[provider].includes(model)?`${provider}::${model}`:''} onChange={event=>chooseModel(event.target.value)} disabled={busy||!PROVIDERS.some(value=>modelsByProvider[value].length)}><option value="" disabled>{configured?'Loading models…':'Choose model'}</option>{PROVIDERS.map(value=><optgroup key={value} label={PROVIDER_NAMES[value]}>{modelsByProvider[value].length?modelsByProvider[value].map(name=><option key={name} value={`${value}::${name}`}>{name}</option>):<option disabled value={`${value}::__connect`}>Connect in settings</option>}</optgroup>)}</select><button type="button" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setPlan(null);setError('')}}>Clear</button><button type="button" disabled={busy} onClick={undo}>Undo layout</button><button className="primary" disabled={busy||!configured||!currentModels.includes(model)||!input.trim()||!geminiAssistant.available}>{busy?'Working…':'Send'}</button></div>
      <small>Workspace positions are included for layout requests. Widget content is shared only when you select it with @.</small>
    </form>
  </aside>;
}
