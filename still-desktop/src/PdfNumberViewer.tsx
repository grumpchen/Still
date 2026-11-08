import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {PDFDocumentProxy,PDFPageProxy,RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {localFiles} from './platform/files.ts';
import {scanPdfNumbers,type PdfArithmeticOperation} from './domain/pdfCalculations.ts';
import {useT} from './localization.tsx';

interface Props {widgetId:string;path:string;createCalculation?:(values:number[],operation:PdfArithmeticOperation)=>void}
interface NumberToken {id:string;raw:string;value:number;left:number;top:number;width:number;height:number}
interface Wheel {x:number;y:number;operation:PdfArithmeticOperation|null;pointerId:number}
const operations:[PdfArithmeticOperation,string][]=[['+','pdfOperationAdd'],['-','pdfOperationSubtract'],['×','pdfOperationMultiply'],['÷','pdfOperationDivide']];

export default function PdfNumberViewer({widgetId,path,createCalculation}:Props){
 const t=useT(),stage=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),pageRef=useRef<PDFPageProxy|null>(null),detectionRun=useRef(0);
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[pageNumber,setPageNumber]=useState(1),[scale,setScale]=useState(1),[renderScale,setRenderScale]=useState(1),[busy,setBusy]=useState(true),[error,setError]=useState(''),[numberMode,setNumberMode]=useState(false),[numbers,setNumbers]=useState<NumberToken[]>([]),[selected,setSelected]=useState<NumberToken[]>([]),[selectionError,setSelectionError]=useState(''),[wheel,setWheel]=useState<Wheel|null>(null),[stageSize,setStageSize]=useState({width:0,height:0});

 useEffect(()=>{
  let live=true,loading:{promise:Promise<PDFDocumentProxy>;destroy:()=>Promise<void>}|null=null;
  setBusy(true);setError('');setDocument(null);setNumbers([]);setSelected([]);setNumberMode(false);setPageNumber(1);setScale(1);setRenderScale(1);
  void localFiles.preview(widgetId,path).then(blob=>blob.arrayBuffer()).then(async buffer=>{
   const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');
   if(!live)return;GlobalWorkerOptions.workerSrc=workerUrl;loading=getDocument({data:new Uint8Array(buffer),maxImageSize:16_777_216});
   return loading.promise;
  }).then(pdf=>{if(live&&pdf)setDocument(pdf)}).catch(reason=>{if(live)setError(String(reason))}).finally(()=>{if(live)setBusy(false)});
  return()=>{live=false;void loading?.destroy()};
 },[widgetId,path]);

 useEffect(()=>{const timer=window.setTimeout(()=>setRenderScale(scale),120);return()=>window.clearTimeout(timer)},[scale]);

 useEffect(()=>{
  if(!document||!canvas.current)return;
  let live=true,renderTask:RenderTask|null=null;const target=canvas.current;
  void document.getPage(pageNumber).then(async page=>{
   if(!live)return;pageRef.current=page;
   const viewport=page.getViewport({scale:renderScale}),pixelRatio=Math.min(2,window.devicePixelRatio||1,Math.sqrt(16_777_216/(viewport.width*viewport.height))),context=target.getContext('2d');
   if(!context)throw new Error('PDF canvas is unavailable.');
   target.width=Math.ceil(viewport.width*pixelRatio);target.height=Math.ceil(viewport.height*pixelRatio);
   target.style.width=`${viewport.width}px`;target.style.height=`${viewport.height}px`;
   setStageSize({width:viewport.width,height:viewport.height});
   renderTask=page.render({canvas:target,canvasContext:context,viewport,transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0]});
   await renderTask.promise;
   if(live&&numberMode)await detectPageNumbers(page,viewport);
  }).catch(reason=>{if(live&&(reason as Error)?.name!=='RenderingCancelledException')setError(String(reason))});
  return()=>{live=false;detectionRun.current++;renderTask?.cancel()};
 },[document,pageNumber,renderScale,numberMode]);

 async function detectPageNumbers(page=pageRef.current,viewport=page?.getViewport({scale:renderScale})){
  if(!page||!viewport)return;
  const run=++detectionRun.current;setBusy(true);setError('');
  try{
   const content=await page.getTextContent();if(run!==detectionRun.current)return;const found:NumberToken[]=[];
   for(const [itemIndex,item] of content.items.entries()){
    if(!('str'in item)||!item.str.trim())continue;
    for(const token of scanPdfNumbers(item.str)){
     const origin=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
     const fontHeight=Math.max(10,Math.hypot(item.transform[2],item.transform[3])*viewport.scale);
     const characterWidth=Math.max(fontHeight*.25,item.width*viewport.scale/item.str.length);
     const width=Math.max(fontHeight*.45,characterWidth*(token.end-token.start));
     found.push({id:`${page.pageNumber}:${itemIndex}:${token.start}`,raw:token.raw,value:token.value,left:origin[0]+characterWidth*token.start,top:origin[1]-fontHeight*.92,width,height:fontHeight*1.12});
     if(found.length>=500)break;
    }
    if(found.length>=500)break;
   }
   setNumbers(found);setSelected([]);setSelectionError('');
  }catch(reason){if(run===detectionRun.current){setError(String(reason));setNumbers([])}}finally{if(run===detectionRun.current)setBusy(false)}
 }

 const closeWheel=useCallback(()=>setWheel(null),[]);
 const applyWheel=useCallback((operation:PdfArithmeticOperation|null)=>{
  if(!operation){setWheel(null);return}
  const values=selected.map(item=>item.value);
  if(values.length)createCalculation?.(values,operation);
  setWheel(null);
 },[selected,createCalculation]);
 useEffect(()=>{
  if(!wheel)return;
  const move=(event:PointerEvent)=>{if(event.pointerId!==wheel.pointerId||!stage.current)return;const rect=stage.current.getBoundingClientRect(),centerX=wheel.x+58,centerY=wheel.y+58,angle=Math.atan2(event.clientY-rect.top-centerY,event.clientX-rect.left-centerX);let index=Math.floor((angle+Math.PI/4+Math.PI*2)%(Math.PI*2)/(Math.PI/2));const op:PdfArithmeticOperation[]=['+','-','×','÷'];setWheel(value=>value?{...value,operation:op[index]}:null)};
  const up=(event:PointerEvent)=>{if(event.pointerId!==wheel.pointerId||event.button!==2)return;event.preventDefault();event.stopPropagation();applyWheel(wheel.operation)};
  const cancel=(event:PointerEvent)=>{if(event.pointerId===wheel.pointerId)closeWheel()};
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);
  return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true)};
 },[wheel,applyWheel,closeWheel]);

 function chooseNumber(event:ReactPointerEvent<HTMLButtonElement>,token:NumberToken){
  if(event.button===2){event.preventDefault();event.stopPropagation();if(!selected.some(item=>item.id===token.id)){if(selected.length>=32){setSelectionError(t('pdfCalculationTooMany'));return}setSelected(current=>[...current,token])}setSelectionError('');if(stage.current){const rect=stage.current.getBoundingClientRect();setWheel({x:event.clientX-rect.left-58,y:event.clientY-rect.top-58,operation:null,pointerId:event.pointerId})}return}
  if(event.button!==0)return;
  if((event.ctrlKey||event.metaKey)&&!selected.some(item=>item.id===token.id)&&selected.length>=32){setSelectionError(t('pdfCalculationTooMany'));return}
  setSelectionError('');setSelected(current=>{if(event.ctrlKey||event.metaKey){if(current.some(item=>item.id===token.id))return current.filter(item=>item.id!==token.id);return[...current,token]}return[token]});
 }

 const pageCount=document?.numPages??0;
 return <section className="pdf-number-viewer" aria-label={t('previewFile')} onContextMenu={event=>{event.preventDefault();event.stopPropagation()}}>
  <header className="pdf-viewer-toolbar">
   <div><button type="button" disabled={!document||pageNumber<=1} aria-label={t('pdfPreviousPage')} onClick={()=>setPageNumber(value=>Math.max(1,value-1))}>‹</button><span>{t('pdfPage').replace('{page}',String(pageNumber)).replace('{count}',String(pageCount||'—'))}</span><button type="button" disabled={!document||pageNumber>=pageCount} aria-label={t('pdfNextPage')} onClick={()=>setPageNumber(value=>Math.min(pageCount,value+1))}>›</button></div>
   <div><button type="button" disabled={!document} aria-label={t('pdfZoomOut')} onClick={()=>setScale(value=>Math.max(.5,Math.round((value-.15)*100)/100))}>−</button><span>{Math.round(scale*100)}%</span><button type="button" disabled={!document} aria-label={t('pdfZoomIn')} onClick={()=>setScale(value=>Math.min(2.5,Math.round((value+.15)*100)/100))}>+</button><button type="button" aria-pressed={numberMode} onClick={()=>{const next=!numberMode;setNumberMode(next);setNumbers([]);setSelected([]);setSelectionError('');if(!next)setBusy(false)}}>{numberMode?t('pdfCloseNumberMode'):t('pdfDetectNumbers')}</button></div>
  </header>
  {busy&&<p className="files-message" role="status">{t('loadingFiles')}</p>}{error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="pdf-scroll-viewport"><div ref={stage} className={'pdf-page-stage'+(numberMode?' is-number-mode':'')} style={{width:stageSize.width||undefined,height:stageSize.height||undefined}}>
   <canvas ref={canvas} aria-label={`${t('pdfPage').replace('{page}',String(pageNumber)).replace('{count}',String(pageCount||'—'))}`}/>
   {numberMode&&numbers.map(token=><button type="button" draggable key={token.id} className={'pdf-number-token'+(selected.some(item=>item.id===token.id)?' is-selected':'')} style={{left:token.left,top:token.top,width:token.width,height:token.height}} aria-label={`${token.raw}, ${token.value}`} aria-pressed={selected.some(item=>item.id===token.id)} onDragStart={event=>{const values=(selected.some(item=>item.id===token.id)?selected:[token]).map(item=>item.value);try{event.dataTransfer.setData('application/x-still-pdf-numbers',JSON.stringify({values,operation:'+'}));event.dataTransfer.setData('text/plain',values.join(' + '));event.dataTransfer.effectAllowed='copy'}catch{event.preventDefault()}}} onPointerDown={event=>chooseNumber(event,token)}>{token.raw}</button>)}
   {wheel&&<div className="pdf-operation-wheel" style={{left:wheel.x,top:wheel.y}} role="group" aria-label={t('pdfSelectionHint')}>
    {operations.map(([operation,label],index)=><button type="button" key={operation} className={`pdf-wheel-operation pos-${index}${wheel.operation===operation?' is-active':''}`} aria-label={t(label)} onPointerEnter={()=>setWheel(value=>value?{...value,operation}:null)} onClick={()=>applyWheel(operation)}>{operation}</button>)}
   </div>}
  </div></div>
  {numberMode&&<footer className="pdf-number-footer"><span>{selected.map(item=>item.raw).join(' · ')||t('pdfNumbersDetected')}</span><span>{selected.length?`${selected.length} / 32`:numbers.length?`${numbers.length}`:t('pdfNoNumbers')}</span>{selected.length>0&&<button type="button" onClick={()=>createCalculation?.(selected.map(item=>item.value),'+')}>{t('pdfAddCalculation')}</button>}{selectionError&&<small role="status">{selectionError}</small>}<small>{t('pdfSelectionHint')}</small></footer>}
 </section>;
}
