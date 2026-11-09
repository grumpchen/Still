import {useCallback,useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {PDFDocumentProxy,PDFPageProxy,RenderTask} from 'pdfjs-dist';
import type {TextLayer as PdfTextLayer} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {localFiles} from './platform/files.ts';
import {includePdfNumberSelection,pdfOperationAt,scanPdfNumbers,togglePdfNumberSelection,type PdfArithmeticOperation} from './domain/pdfCalculations.ts';
import {checkedPdfHighlightKeywords,findPdfHighlightRanges,pdfHighlightStorageKey,readPdfHighlights,writePdfHighlights,type PdfHighlightRange} from './domain/pdfHighlights.ts';
import {PDF_PAGE_BOOKMARK_DRAG_TYPE,pdfBookmarkStorageKey,readPdfBookmarks,writePdfBookmarks} from './domain/pdfBookmarks.ts';
import {useT} from './localization.tsx';

interface Props {widgetId:string;path:string;name?:string;initialPage?:number;onPageChange?:(page:number)=>void;createCalculation?:(values:number[],operation:PdfArithmeticOperation)=>void}
interface NumberToken {id:string;raw:string;value:number;left:number;top:number;width:number;height:number}
interface PositionedKeywordRange extends PdfHighlightRange {left:number;top:number;width:number;height:number}
interface PdfTextSpan {str:string;transform:number[];width:number}
interface Wheel {x:number;y:number;operation:PdfArithmeticOperation|null;pointerId:number}
const operations:[PdfArithmeticOperation,string][]=[['+','pdfOperationAdd'],['-','pdfOperationSubtract'],['×','pdfOperationMultiply'],['÷','pdfOperationDivide']];

export default function PdfNumberViewer({widgetId,path,name='PDF',initialPage,onPageChange,createCalculation}:Props){
 const t=useT(),stage=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),textLayerContainer=useRef<HTMLDivElement>(null),pageRef=useRef<PDFPageProxy|null>(null),detectionRun=useRef(0),textCache=useRef(new Map<number,PdfTextSpan[]>()),pendingKeywordRequest=useRef(''),pendingKeywordText=useRef(''),selectedRef=useRef<NumberToken[]>([]);
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[pageNumber,setPageNumber]=useState(initialPage??1),[scale,setScale]=useState(1),[renderScale,setRenderScale]=useState(1),[busy,setBusy]=useState(true),[error,setError]=useState(''),[numberMode,setNumberMode]=useState(false),[numbers,setNumbers]=useState<NumberToken[]>([]),[selected,setSelected]=useState<NumberToken[]>([]),[selectionError,setSelectionError]=useState(''),[wheel,setWheel]=useState<Wheel|null>(null),[stageSize,setStageSize]=useState({width:0,height:0}),[pdfFingerprint,setPdfFingerprint]=useState(''),[textDivs,setTextDivs]=useState<HTMLElement[]>([]),[positionedKeywords,setPositionedKeywords]=useState<PositionedKeywordRange[]>([]),[appliedKeywords,setAppliedKeywords]=useState<string[]>([]),[proposedKeywords,setProposedKeywords]=useState<string[]>([]),[keywordBusy,setKeywordBusy]=useState(false),[keywordError,setKeywordError]=useState(''),[bookmarks,setBookmarks]=useState<number[]>([]),[bookmarkError,setBookmarkError]=useState('');
 const storageKey=pdfFingerprint?pdfHighlightStorageKey(widgetId,path,pdfFingerprint):'';
 const bookmarkKey=pdfFingerprint?pdfBookmarkStorageKey(widgetId,path,pdfFingerprint):'';
 useLayoutEffect(()=>{
  const target=stage.current,container=textLayerContainer.current;if(!target||!container||!textDivs.length||!appliedKeywords.length){setPositionedKeywords([]);return}
  const bounds=target.getBoundingClientRect(),ranges=findPdfHighlightRanges(textDivs.map(div=>div.textContent??''),appliedKeywords),rectangles:PositionedKeywordRange[]=[];
  for(const range of ranges){
   const div=textDivs[range.spanIndex];if(!div)continue;
   const walker=div.ownerDocument.createTreeWalker(div,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let node:Node|null=walker.nextNode(),length=0;
   while(node){nodes.push(node as Text);length+=node.textContent?.length??0;node=walker.nextNode()}
   if(range.start<0||range.end>length||range.end<=range.start)continue;
   const locate=(offset:number,isEnd:boolean):{node:Text;offset:number}|null=>{let remaining=offset;for(const textNode of nodes){const size=textNode.textContent?.length??0;if(remaining<size||isEnd&&remaining===size)return{node:textNode,offset:remaining};remaining-=size}return null};
   const start=locate(range.start,false),end=locate(range.end,true);if(!start||!end)continue;
   const textRange=div.ownerDocument.createRange();textRange.setStart(start.node,start.offset);textRange.setEnd(end.node,end.offset);
   for(const rect of textRange.getClientRects())if(rect.width>0&&rect.height>0)rectangles.push({...range,left:rect.left-bounds.left,top:rect.top-bounds.top,width:rect.width,height:rect.height});
   textRange.detach();
  }
  setPositionedKeywords(rectangles);
 },[appliedKeywords,textDivs,stageSize]);

 useEffect(()=>{
  let live=true,loading:{promise:Promise<PDFDocumentProxy>;destroy:()=>Promise<void>}|null=null;
  setBusy(true);setError('');setDocument(null);setNumbers([]);setSelected([]);setNumberMode(false);setPageNumber(1);setScale(1);setRenderScale(1);setPdfFingerprint('');setTextDivs([]);setPositionedKeywords([]);setAppliedKeywords([]);setProposedKeywords([]);setKeywordBusy(false);setKeywordError('');textCache.current.clear();
  void localFiles.preview(widgetId,path).then(blob=>blob.arrayBuffer()).then(async buffer=>{
   const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');
   if(!live)return;GlobalWorkerOptions.workerSrc=workerUrl;loading=getDocument({data:new Uint8Array(buffer),maxImageSize:16_777_216});
   return loading.promise;
  }).then(pdf=>{if(live&&pdf){setPdfFingerprint(pdf.fingerprints?.[1]??pdf.fingerprints?.[0]??'');setDocument(pdf)}}).catch(reason=>{if(live)setError(String(reason))}).finally(()=>{if(live)setBusy(false)});
  return()=>{live=false;void loading?.destroy()};
 },[widgetId,path]);

 useEffect(()=>{if(document&&Number.isSafeInteger(initialPage)&&initialPage!>0&&initialPage!<=document.numPages)setPageNumber(initialPage!)},[document,initialPage]);
 useEffect(()=>{if(document&&pageNumber>=1&&pageNumber<=document.numPages)onPageChange?.(pageNumber)},[document,onPageChange,pageNumber]);

 useEffect(()=>{if(!storageKey){setAppliedKeywords([]);return}try{setAppliedKeywords(readPdfHighlights(localStorage,storageKey))}catch{setAppliedKeywords([])}},[storageKey]);
 useEffect(()=>{if(!bookmarkKey||!document){setBookmarks([]);return}setBookmarks(readPdfBookmarks(localStorage,bookmarkKey,document.numPages))},[bookmarkKey,document]);
 useEffect(()=>{const ready=(event:Event)=>{const detail=(event as CustomEvent<{requestId?:unknown;keywords?:unknown}>).detail;if(detail?.requestId!==pendingKeywordRequest.current||!Array.isArray(detail.keywords))return;pendingKeywordRequest.current='';setKeywordBusy(false);try{const keywords=checkedPdfHighlightKeywords(JSON.stringify({keywords:detail.keywords}),pendingKeywordText.current);pendingKeywordText.current='';setKeywordError('');setProposedKeywords(keywords)}catch(reason){pendingKeywordText.current='';setKeywordError(reason instanceof Error?reason.message:t('pdfKeywordFailure'))}},failed=(event:Event)=>{const detail=(event as CustomEvent<{requestId?:unknown;error?:unknown}>).detail;if(detail?.requestId!==pendingKeywordRequest.current)return;pendingKeywordRequest.current='';pendingKeywordText.current='';setKeywordBusy(false);setKeywordError(typeof detail.error==='string'?detail.error:t('pdfKeywordFailure'))};window.addEventListener('still-pdf-keywords-ready',ready);window.addEventListener('still-pdf-keywords-error',failed);return()=>{window.removeEventListener('still-pdf-keywords-ready',ready);window.removeEventListener('still-pdf-keywords-error',failed)}},[t]);

 useEffect(()=>{const timer=window.setTimeout(()=>setRenderScale(scale),120);return()=>window.clearTimeout(timer)},[scale]);

 useEffect(()=>{
  if(!document||!canvas.current)return;
  let live=true,renderTask:RenderTask|null=null,textLayer:PdfTextLayer|null=null;const target=canvas.current,container=textLayerContainer.current;setTextDivs([]);setPositionedKeywords([]);container?.replaceChildren();
  void document.getPage(pageNumber).then(async page=>{
   if(!live||!container)return;pageRef.current=page;
   const viewport=page.getViewport({scale:renderScale}),pixelRatio=Math.min(2,window.devicePixelRatio||1,Math.sqrt(16_777_216/(viewport.width*viewport.height))),context=target.getContext('2d');
   if(!context)throw new Error('PDF canvas is unavailable.');
   target.width=Math.ceil(viewport.width*pixelRatio);target.height=Math.ceil(viewport.height*pixelRatio);
   target.style.width=`${viewport.width}px`;target.style.height=`${viewport.height}px`;
   setStageSize({width:viewport.width,height:viewport.height});
   renderTask=page.render({canvas:target,canvasContext:context,viewport,transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0]});
   const content=await page.getTextContent(),spans=content.items.flatMap(item=>'str'in item&&item.str?[{str:item.str,transform:[...item.transform],width:item.width}]:[]);textCache.current.set(page.pageNumber,spans);
   container.replaceChildren();container.style.setProperty('--scale-factor',String(renderScale));container.style.setProperty('--total-scale-factor',String(renderScale));container.style.setProperty('--scale-round-x','1px');container.style.setProperty('--scale-round-y','1px');container.style.width=`${viewport.width}px`;container.style.height=`${viewport.height}px`;
   const {TextLayer}=await import('pdfjs-dist');if(!live)return;textLayer=new TextLayer({textContentSource:content,container,viewport});
   await Promise.all([renderTask.promise,textLayer.render()]);if(!live)return;setTextDivs(textLayer.textDivs);
   if(numberMode)await detectPageNumbers(page,viewport,spans);
  }).catch(reason=>{if(live&&(reason as Error)?.name!=='RenderingCancelledException')setError(String(reason))});
  return()=>{live=false;detectionRun.current++;renderTask?.cancel();textLayer?.cancel()};
 },[document,pageNumber,renderScale,numberMode]);

 async function loadPageText(page:PDFPageProxy):Promise<PdfTextSpan[]>{
  const cached=textCache.current.get(page.pageNumber);if(cached)return cached;
  const content=await page.getTextContent(),spans=content.items.flatMap(item=>'str'in item&&item.str? [{str:item.str,transform:[...item.transform],width:item.width}]:[]);
  textCache.current.set(page.pageNumber,spans);return spans;
 }

 async function detectPageNumbers(page=pageRef.current,viewport=page?.getViewport({scale:renderScale}),spans?:PdfTextSpan[]){
  if(!page||!viewport)return;
  const run=++detectionRun.current;setBusy(true);setError('');
  try{
   const items=spans??await loadPageText(page);if(run!==detectionRun.current)return;const found:NumberToken[]=[];
   for(const [itemIndex,item] of items.entries()){
    if(!item.str.trim())continue;
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

 async function requestKeywordHighlights(){
  if(!document||keywordBusy)return;
  setKeywordBusy(true);setKeywordError('');setProposedKeywords([]);
  try{
   const parts:string[]=[];let remaining=24_000,truncated=document.numPages>30,processedPages=0;
   for(let page=1;page<=Math.min(document.numPages,30)&&remaining>0;page++){
    processedPages=page;
    const pdfPage=await document.getPage(page),spans=await loadPageText(pdfPage),text=spans.map(item=>item.str).join(' ');
    if(!text.trim())continue;
    const chunk=text.slice(0,remaining);parts.push(`Page ${page}\n${chunk}`);remaining-=chunk.length;
    if(chunk.length<text.length){truncated=true;break}
   }
   if(processedPages<document.numPages)truncated=true;
   const text=parts.join('\n\n').trim();if(!text)throw new Error(t('pdfNoExtractableText'));
   const requestId=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;pendingKeywordRequest.current=requestId;pendingKeywordText.current=text;
   const prompt=t('pdfKeywordPrompt').replace('{truncated}',truncated?t('pdfKeywordTruncated'):'');
   window.dispatchEvent(new Event('still-open-assistant'));
   window.dispatchEvent(new CustomEvent('still-assistant-resource',{detail:{name,path,text,size:text.length,notes:'',fileWidgetId:widgetId,fileActionAllowed:false,prompt,autoSubmit:true,workflow:'pdf-keywords',requestId}}));
  }catch(reason){pendingKeywordRequest.current='';pendingKeywordText.current='';setKeywordBusy(false);setKeywordError(reason instanceof Error?reason.message:String(reason))}
 }

 function toggleProposedKeyword(keyword:string){setProposedKeywords(current=>current.includes(keyword)?current.filter(item=>item!==keyword):[...current,keyword])}
 function applyKeywordHighlights(){
  if(!storageKey||!proposedKeywords.length)return;
  try{const next=[...new Set([...appliedKeywords,...proposedKeywords])];writePdfHighlights(localStorage,storageKey,next);setAppliedKeywords(next);setProposedKeywords([]);setKeywordError('')}
  catch(reason){setKeywordError(reason instanceof Error?reason.message:t('pdfKeywordSaveFailed'))}
 }
 function clearKeywordHighlights(){
  if(!storageKey)return;
  try{writePdfHighlights(localStorage,storageKey,[]);setAppliedKeywords([]);setKeywordError('')}
  catch(reason){setKeywordError(reason instanceof Error?reason.message:t('pdfKeywordSaveFailed'))}
 }

 function toggleCurrentPageBookmark(){
  if(!bookmarkKey||!document)return;
  const next=bookmarks.includes(pageNumber)?bookmarks.filter(page=>page!==pageNumber):[...bookmarks,pageNumber];
  try{writePdfBookmarks(localStorage,bookmarkKey,next,document.numPages);setBookmarks(next.sort((a,b)=>a-b));setBookmarkError('')}
  catch{setBookmarkError(t('pdfBookmarkSaveFailed'))}
 }
 function removePageBookmark(page:number){
  if(!bookmarkKey||!document)return;
  const next=bookmarks.filter(item=>item!==page);
  try{writePdfBookmarks(localStorage,bookmarkKey,next,document.numPages);setBookmarks(next);setBookmarkError('')}
  catch{setBookmarkError(t('pdfBookmarkSaveFailed'))}
 }

 useEffect(()=>{selectedRef.current=selected},[selected]);
 const closeWheel=useCallback(()=>setWheel(null),[]);
 const applyWheel=useCallback((operation:PdfArithmeticOperation|null)=>{
  if(!operation){setWheel(null);return}
  const values=selectedRef.current.map(item=>item.value);
  if(values.length)createCalculation?.(values,operation);
  setWheel(null);
 },[createCalculation]);
 useEffect(()=>{
  if(!wheel)return;
  const move=(event:PointerEvent)=>{if(event.pointerId!==wheel.pointerId||!stage.current)return;const rect=stage.current.getBoundingClientRect(),centerX=wheel.x+58,centerY=wheel.y+58,operation=pdfOperationAt(event.clientX-rect.left-centerX,event.clientY-rect.top-centerY);setWheel(value=>value?{...value,operation}:null)};
  const up=(event:PointerEvent)=>{if(event.pointerId!==wheel.pointerId||event.button!==2)return;event.preventDefault();event.stopPropagation();applyWheel(wheel.operation)};
  const cancel=(event:PointerEvent)=>{if(event.pointerId===wheel.pointerId)closeWheel()};
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);
  return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true)};
 },[wheel,applyWheel,closeWheel]);

 function chooseNumber(event:ReactPointerEvent<HTMLButtonElement>,token:NumberToken){
  if(event.button===2){event.preventDefault();event.stopPropagation();const current=selectedRef.current,ids=includePdfNumberSelection(current.map(item=>item.id),token.id);if(!ids){setSelectionError(t('pdfCalculationTooMany'));return}const byId=new Map([...current,token].map(item=>[item.id,item]));const next=ids.map(id=>byId.get(id)!).filter(Boolean);selectedRef.current=next;setSelected(next);setSelectionError('');if(stage.current){const rect=stage.current.getBoundingClientRect();setWheel({x:event.clientX-rect.left-58,y:event.clientY-rect.top-58,operation:null,pointerId:event.pointerId})}return}
  if(event.button!==0)return;
  const current=selectedRef.current,additive=event.ctrlKey||event.metaKey,ids=togglePdfNumberSelection(current.map(item=>item.id),token.id,additive);if(!ids){setSelectionError(t('pdfCalculationTooMany'));return}const byId=new Map([...current,token].map(item=>[item.id,item]));const next=ids.map(id=>byId.get(id)!).filter(Boolean);selectedRef.current=next;setSelectionError('');setSelected(next);
 }

 const pageCount=document?.numPages??0;
 return <section className="pdf-number-viewer" aria-label={t('previewFile')} onContextMenu={event=>{event.preventDefault();event.stopPropagation()}}>
  <header className="pdf-viewer-toolbar">
   <div><button type="button" disabled={!document||pageNumber<=1} aria-label={t('pdfPreviousPage')} onClick={()=>setPageNumber(value=>Math.max(1,value-1))}>‹</button><span>{t('pdfPage').replace('{page}',String(pageNumber)).replace('{count}',String(pageCount||'—'))}</span><button type="button" disabled={!document||pageNumber>=pageCount} aria-label={t('pdfNextPage')} onClick={()=>setPageNumber(value=>Math.min(pageCount,value+1))}>›</button></div>
   <div><button type="button" disabled={!document} aria-label={t('pdfZoomOut')} onClick={()=>setScale(value=>Math.max(.5,Math.round((value-.15)*100)/100))}>−</button><span>{Math.round(scale*100)}%</span><button type="button" disabled={!document} aria-label={t('pdfZoomIn')} onClick={()=>setScale(value=>Math.min(2.5,Math.round((value+.15)*100)/100))}>+</button><button type="button" aria-pressed={numberMode} onClick={()=>{const next=!numberMode;setNumberMode(next);setNumbers([]);setSelected([]);setSelectionError('');if(!next)setBusy(false)}}>{numberMode?t('pdfCloseNumberMode'):t('pdfDetectNumbers')}</button><button type="button" title={t('pdfKeywordSharingNotice')} disabled={!document||keywordBusy} onClick={()=>void requestKeywordHighlights()}>{keywordBusy?t('pdfFindingKeywords'):t('pdfHighlightKeywords')}</button>{appliedKeywords.length>0&&<button type="button" onClick={clearKeywordHighlights}>{t('pdfClearHighlights')}</button>}<button type="button" disabled={!document||!bookmarkKey} aria-pressed={bookmarks.includes(pageNumber)} aria-label={bookmarks.includes(pageNumber)?t('pdfRemoveBookmark').replace('{page}',String(pageNumber)):t('pdfBookmarkPage').replace('{page}',String(pageNumber))} onClick={toggleCurrentPageBookmark}>{bookmarks.includes(pageNumber)?'★':'☆'} {bookmarks.includes(pageNumber)?t('pdfBookmarked'):t('pdfBookmark')}</button><details className="pdf-bookmark-menu"><summary>{t('pdfBookmarks')} ({bookmarks.length})</summary><div className="pdf-bookmark-list">{bookmarks.length?bookmarks.map(page=><div key={page}><button type="button" draggable onDragStart={event=>{try{const reference={widgetId,path,name,page};event.dataTransfer.setData(PDF_PAGE_BOOKMARK_DRAG_TYPE,JSON.stringify(reference));event.dataTransfer.setData('text/plain',`${name} · ${t('pdfPage').replace('{page}',String(page)).replace('{count}',String(pageCount||'—'))}`);event.dataTransfer.effectAllowed='copy'}catch{event.preventDefault()}}} onClick={event=>{setPageNumber(page);event.currentTarget.closest('details')?.removeAttribute('open')}}>{t('pdfPage').replace('{page}',String(page)).replace('{count}',String(pageCount||'—'))}</button><button type="button" aria-label={t('pdfRemoveBookmark').replace('{page}',String(page))} onClick={()=>removePageBookmark(page)}>×</button></div>):<p>{t('pdfNoBookmarks')}</p>}</div></details></div>
  </header>
  {busy&&<p className="files-message" role="status">{t('loadingFiles')}</p>}{error&&<p className="widget-error" role="alert">{error}</p>}
  <div className="pdf-scroll-viewport"><div ref={stage} className={'pdf-page-stage'+(numberMode?' is-number-mode':'')} style={{width:stageSize.width||undefined,height:stageSize.height||undefined}}>
   <canvas ref={canvas} aria-label={`${t('pdfPage').replace('{page}',String(pageNumber)).replace('{count}',String(pageCount||'—'))}`}/>
   <div ref={textLayerContainer} className={'pdf-text-layer'+(numberMode?' is-disabled':'')} aria-hidden="true"/>
   {positionedKeywords.map((range,index)=><span key={`${range.spanIndex}:${range.start}:${range.end}:${range.keyword}:${range.left}:${index}`} className="pdf-keyword-highlight" aria-hidden="true" style={{left:range.left,top:range.top,width:range.width,height:range.height}}/>)}
   {numberMode&&numbers.map(token=><button type="button" draggable key={token.id} className={'pdf-number-token'+(selected.some(item=>item.id===token.id)?' is-selected':'')} style={{left:token.left,top:token.top,width:token.width,height:token.height}} aria-label={`${token.raw}, ${token.value}`} aria-pressed={selected.some(item=>item.id===token.id)} onDragStart={event=>{const values=(selected.some(item=>item.id===token.id)?selected:[token]).map(item=>item.value);try{event.dataTransfer.setData('application/x-still-pdf-numbers',JSON.stringify({values,operation:'+'}));event.dataTransfer.setData('text/plain',values.join(' + '));event.dataTransfer.effectAllowed='copy'}catch{event.preventDefault()}}} onPointerDown={event=>chooseNumber(event,token)}>{token.raw}</button>)}
   {wheel&&<div className="pdf-operation-wheel" style={{left:wheel.x,top:wheel.y}} role="group" aria-label={t('pdfSelectionHint')}>
    {operations.map(([operation,label],index)=><button type="button" key={operation} className={`pdf-wheel-operation pos-${index}${wheel.operation===operation?' is-active':''}`} aria-label={t(label)} onPointerEnter={()=>setWheel(value=>value?{...value,operation}:null)} onClick={()=>applyWheel(operation)}>{operation}</button>)}
   </div>}
  </div></div>
  {proposedKeywords.length>0&&<section className="pdf-keyword-review" aria-label={t('pdfReviewKeywords')}><strong>{t('pdfReviewKeywords')}</strong><div>{proposedKeywords.map(keyword=><label key={keyword}><input type="checkbox" checked onChange={()=>toggleProposedKeyword(keyword)}/>{keyword}</label>)}</div><footer><span>{t('pdfHighlightsStayLocal')}</span><button type="button" disabled={!proposedKeywords.length||!storageKey} onClick={applyKeywordHighlights}>{t('pdfApplyHighlights')}</button><button type="button" onClick={()=>setProposedKeywords([])}>{t('pdfDiscardHighlights')}</button></footer></section>}
  {keywordError&&<p className="widget-error pdf-keyword-error" role="alert">{keywordError}</p>}
  {bookmarkError&&<p className="widget-error pdf-keyword-error" role="alert">{bookmarkError}</p>}
  {numberMode&&<footer className="pdf-number-footer"><span>{selected.map(item=>item.raw).join(' · ')||t('pdfNumbersDetected')}</span><span>{selected.length?`${selected.length} / 32`:numbers.length?`${numbers.length}`:t('pdfNoNumbers')}</span>{selected.length>0&&<button type="button" onClick={()=>createCalculation?.(selected.map(item=>item.value),'+')}>{t('pdfAddCalculation')}</button>}{selectionError&&<small role="status">{selectionError}</small>}<small>{t('pdfSelectionHint')}</small></footer>}
 </section>;
}
