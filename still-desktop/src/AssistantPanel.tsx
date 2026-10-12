import {useEffect,useRef,useState} from 'react';
import type {Workspace} from './domain/workspaces.ts';
import {applyLayoutPlan,assistantKeyError,DEFAULT_MODEL,HISTORY_LIMIT,layoutContext,layoutFingerprint,preferredModel,validateLayout,widgetContext,widgetLabel,type AssistantMode,type ChatMessage,type LayoutPlan} from './domain/assistant.ts';
import {geminiAssistant,widgetImage} from './platform/assistant.ts';
import {Icon} from './widgets.tsx';
import './assistant.css';

type Props={workspace:Workspace;open:boolean;close:()=>void;dimensions:()=>{width:number;height:number};apply:(plan:LayoutPlan)=>void;undo:()=>void};
export default function AssistantPanel({workspace,open,close,dimensions,apply,undo}:Props){
  const [configured,setConfigured]=useState(false),[settings,setSettings]=useState(false),[key,setKey]=useState(''),[model,setModel]=useState(DEFAULT_MODEL),[models,setModels]=useState<string[]>([]),[modelsReady,setModelsReady]=useState(false);
  const [mode,setMode]=useState<AssistantMode>('chat'),[selected,setSelected]=useState(''),[screenshot,setScreenshot]=useState(false),[input,setInput]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(''),[plan,setPlan]=useState<LayoutPlan|null>(null);
  const alive=useRef(true),sending=useRef(false),latest=useRef(workspace);latest.current=workspace;
  const log=useRef<HTMLDivElement>(null);
  useEffect(()=>{alive.current=true;if(geminiAssistant.available)void geminiAssistant.configured().then(async value=>{if(!alive.current)return;setConfigured(value);setSettings(!value);if(value){try{const available=await geminiAssistant.models();if(alive.current){setModels(available);setModel(current=>available.includes(current)?current:preferredModel(available));setModelsReady(true)}}catch(reason){if(alive.current){setModelsReady(false);setSettings(true);setError(assistantKeyError(reason))}}}}).catch(()=>{if(alive.current){setSettings(true);setError('AI settings could not be loaded.')}});return()=>{alive.current=false}},[]);
  useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
  useEffect(()=>{if(selected&&!workspace.widgets.some(w=>w.id===selected)){setSelected('');setScreenshot(false)}},[workspace.widgets,selected]);
  async function connect(){
    setError('');
    try{const available=await geminiAssistant.setKey(key);if(!alive.current)return;setKey('');setModels(available);setModel(preferredModel(available));setModelsReady(true);setConfigured(true);setSettings(false)}catch(reason){if(alive.current)setError(assistantKeyError(reason))}
  }
  async function disconnect(){
    try{await geminiAssistant.setKey('');if(alive.current){setKey('');setModels([]);setModelsReady(false);setConfigured(false);setSettings(true)}}catch{if(alive.current)setError('Could not clear the session key.')}
  }
  async function send(){
    if(sending.current||!input.trim()||!configured||!modelsReady||!models.includes(model)||!geminiAssistant.available)return;
    const owner=latest.current,prompt=input.trim(),widget=owner.widgets.find(w=>w.id===selected),size=dimensions(),requestMode=mode;
    if(requestMode==='read'&&!widget){setError('Choose a widget to read first.');return}
    if(requestMode==='layout'&&!owner.widgets.some(w=>!w.minimized)){setError('Add or expand a widget before arranging the layout.');return}
    sending.current=true;setBusy(true);setPending(prompt);setError('');setPlan(null);
    try{
      const context=requestMode==='layout'?layoutContext(owner,size.width,size.height):widget?widgetContext(widget):null;
      const image=requestMode!=='layout'&&widget&&screenshot?await widgetImage(widget.id):undefined;
      const history=messages.slice(-HISTORY_LIMIT).map(m=>({...m,text:m.text.slice(0,m.role==='model'?6000:8000)}));
      const result=await geminiAssistant.send({model,mode:requestMode,messages:[...history,{role:'user',text:prompt}],context:context?JSON.stringify(context):'',image});
      if(!alive.current)return;
      setMessages(current=>[...current,{role:'user',text:prompt},{role:'model',text:result.reply}]);setInput('');
      if(requestMode==='layout'&&result.layout.length){
        validateLayout(owner,result.layout,size.width,size.height);
        setPlan({workspaceId:owner.id,fingerprint:layoutFingerprint(owner),width:size.width,height:size.height,items:result.layout});
      }
    }catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:String(reason))}
    finally{sending.current=false;if(alive.current){setBusy(false);setPending('')}}
  }
  function applyProposal(){
    if(!plan)return;
    try{const size=dimensions();applyLayoutPlan(latest.current,plan,size.width,size.height);apply(plan);setPlan(null);setError('')}
    catch(reason){setPlan(null);setError(reason instanceof Error?reason.message:String(reason))}
  }
  return <aside id="ai-sidebar" className="assistant-panel" hidden={!open} aria-label="Gemini assistant">
    <header className="assistant-heading"><Icon name="ai"/><div><strong>Still AI</strong><small>Gemini · {configured?'key configured':'not connected'}</small></div><button onClick={()=>setSettings(value=>!value)} aria-label="AI settings" aria-expanded={settings}><Icon name="settings"/></button><button onClick={close} aria-label="Close AI sidebar">×</button></header>
    {!geminiAssistant.available&&<p className="assistant-notice">Live AI runs in the Still desktop app. This browser preview does not send API requests.</p>}
    {settings&&<form className="assistant-settings" onSubmit={e=>{e.preventDefault();void connect()}}>
      <p>Create a Gemini key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" onClick={e=>{if(geminiAssistant.available){e.preventDefault();void geminiAssistant.keySetup().catch(()=>setError('Open aistudio.google.com/apikey in your browser to create a Gemini key.'))}}}>Google AI Studio</a>. Choose a project with the free tier enabled.</p>
      <label>Gemini API key<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} placeholder="Enter key in Still, never in chat" disabled={!geminiAssistant.available||busy}/></label>
      <small>The key stays in desktop memory for this session. It is not saved in your layout. An optional GEMINI_API_KEY environment variable also works.</small>
      <label>Model<select value={model} onChange={e=>setModel(e.target.value)} disabled={busy||!models.length}>{models.length?models.map(value=><option value={value} key={value}>{value.replace(/^gemini-/, 'Gemini ').replaceAll('-', ' ')}</option>):<option value={DEFAULT_MODEL}>{configured?'No available models':'Connect a key to load models'}</option>}</select></label>
      <p>Free-tier limits apply. Google may use free-tier inputs to improve its products. Only send content you are comfortable sharing.</p>
      <div className="assistant-row"><button className="primary" disabled={!key.trim()||busy||!geminiAssistant.available}>Connect key</button>{configured&&<button type="button" disabled={busy} onClick={()=>void disconnect()}>Forget key</button>}</div>
    </form>}
    <div className="assistant-modes" role="group" aria-label="Assistant task">{(['chat','read','layout'] as const).map(value=><button key={value} disabled={busy} aria-pressed={mode===value} onClick={()=>{setMode(value);setError('')}}>{value==='chat'?'Chat':value==='read'?'Read widget':'Arrange layout'}</button>)}</div>
    {mode!=='layout'?<div className="assistant-context"><label>Share a widget<select aria-label="Widget to share" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setScreenshot(false)}}><option value="">None — chat only</option>{workspace.widgets.map(w=><option value={w.id} key={w.id}>{widgetLabel(w)}{w.minimized?' (minimized)':''}</option>)}</select></label>{selected&&<><label className="assistant-check"><input type="checkbox" checked={screenshot} disabled={busy} onChange={e=>setScreenshot(e.target.checked)}/>Include visible screenshot</label><small>Sending shares this widget’s text or metadata{ screenshot?' and screenshot':''} with Google. No files are opened.</small></>}</div>:<p className="assistant-notice">Shares widget names, sizes and positions, without their contents. Review the proposal before applying it.</p>}
    <div ref={log} className="assistant-log" role="log" aria-label="AI conversation" aria-live="polite" aria-busy={busy}>
      {!messages.length&&!busy&&<div className="assistant-empty"><Icon name="ai"/><h2>A little help with your space.</h2><p>Ask a question, read a selected widget, or find a more useful arrangement.</p><button onClick={()=>{setMode('layout');setInput('Arrange my widgets into a clear, practical layout with no overlaps.')}}>Help organise my layout</button><button onClick={()=>{setMode('read');setInput('Summarise the selected widget and explain the key points.')}}>Help me understand a widget</button></div>}
      {messages.map((m,index)=><div className={'assistant-message '+m.role} key={index}><small>{m.role==='user'?'You':'Gemini'}</small><p>{m.text}</p></div>)}
      {busy&&<><div className="assistant-message user"><small>You</small><p>{pending}</p></div><p className="assistant-thinking" role="status">{screenshot&&mode!=='layout'?'Reading and thinking…':'Thinking…'}</p></>}
    </div>
    {plan&&<section className="assistant-proposal" aria-label="Proposed layout"><strong>Proposed layout</strong><svg role="img" aria-label="Preview of proposed widget positions" viewBox={`0 0 ${plan.width} ${plan.height}`}><rect className="assistant-preview-bg" width={plan.width} height={plan.height}/>{plan.items.map(item=><g key={item.id}><rect x={item.x} y={item.y} width={item.width} height={item.height}/><title>{workspace.widgets.find(w=>w.id===item.id)?widgetLabel(workspace.widgets.find(w=>w.id===item.id)!):'Removed widget'}</title></g>)}</svg><details><summary>{plan.items.length} widget positions</summary>{plan.items.map(item=><p key={item.id}>{workspace.widgets.find(w=>w.id===item.id)?widgetLabel(workspace.widgets.find(w=>w.id===item.id)!):'Removed widget'}: {item.x}, {item.y} · {item.width} × {item.height}</p>)}</details><div className="assistant-row"><button className="primary" onClick={applyProposal}>Apply layout</button><button onClick={()=>setPlan(null)}>Dismiss</button></div></section>}
    {error&&<p className="assistant-error" role="alert">{error}</p>}
    <form className="assistant-compose" onSubmit={e=>{e.preventDefault();void send()}}><label className="sr-only" htmlFor="ai-message">Message Gemini</label><textarea id="ai-message" value={input} onChange={e=>setInput(e.target.value)} maxLength={8000} disabled={busy} placeholder={mode==='layout'?'How should your space feel?':mode==='read'?'What would you like to understand?':'Ask Gemini…'} rows={3}/><div className="assistant-row"><button type="button" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setPlan(null);setError('')}}>Clear chat</button><button type="button" disabled={busy} onClick={undo}>Undo layout</button><button className="primary" disabled={busy||!configured||!modelsReady||!models.includes(model)||!input.trim()||!geminiAssistant.available}>{busy?'Working…':'Send'}</button></div><small>Chat is kept only for this workspace session. No requests run automatically.</small></form>
  </aside>;
}
