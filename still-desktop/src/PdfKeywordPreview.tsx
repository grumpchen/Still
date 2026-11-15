import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFPageProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';

let pdfJsPromise:Promise<typeof import('pdfjs-dist')>|undefined;
function loadPdfJs(){return pdfJsPromise??=import('pdfjs-dist').then(pdfjs=>{pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;return pdfjs})}
const ignoreMatches=()=>{};

function markTextLayer(layer:HTMLElement,page:HTMLElement,terms:readonly string[]):number{
  const walker=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT),nodes:Text[]=[],parts:string[]=[];
  let node:Node|null;
  while((node=walker.nextNode())){const text=node as Text;nodes.push(text);parts.push(text.data)}
  const source=parts.join(''),lower=source.toLocaleLowerCase();
  const offsets:{start:number;end:number;node:Text}[]=[];let offset=0;
  for(let index=0;index<nodes.length;index++){const end=offset+parts[index].length;offsets.push({start:offset,end,node:nodes[index]});offset=end}
  const overlay=page.querySelector<HTMLElement>('.pdf-keyword-overlay');if(!overlay)return 0;overlay.replaceChildren();
  let matched=0;
  for(const term of terms){
    const needle=term.toLocaleLowerCase();if(!needle)continue;
    let from=0,index:number;
    while((index=lower.indexOf(needle,from))!==-1){
      const last=index+needle.length,startNode=offsets.find(item=>index>=item.start&&index<item.end),endNode=offsets.find(item=>last>item.start&&last<=item.end);
      if(startNode&&endNode){
        const range=document.createRange();range.setStart(startNode.node,index-startNode.start);range.setEnd(endNode.node,last-endNode.start);
        for(const rect of Array.from(range.getClientRects())){
          if(rect.width<1||rect.height<1)continue;
          const pageRect=page.getBoundingClientRect(),mark=document.createElement('span');
          mark.className='pdf-keyword-mark';mark.style.left=`${rect.left-pageRect.left}px`;mark.style.top=`${rect.top-pageRect.top}px`;mark.style.width=`${rect.width}px`;mark.style.height=`${rect.height}px`;mark.setAttribute('aria-hidden','true');overlay.append(mark);
        }
        matched++;
      }
      from=index+Math.max(needle.length,1);
    }
  }
  return matched;
}

function PdfPage({documentProxy,pageNumber,width,terms,onMatches,scroller}:{documentProxy:PDFDocumentProxy;pageNumber:number;width:number;terms:readonly string[];onMatches:(page:number,count:number)=>void;scroller:HTMLDivElement|null}){
  const host=useRef<HTMLDivElement>(null),[page,setPage]=useState<PDFPageProxy|null>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{let active=true;setPage(null);setVisible(false);void documentProxy.getPage(pageNumber).then(value=>{if(active)setPage(value)}).catch(()=>{if(active)onMatches(pageNumber,0)});return()=>{active=false}},[documentProxy,pageNumber,onMatches]);
  useEffect(()=>{
    const root=host.current;if(!root||!page)return;
    const base=page.getViewport({scale:1}),scale=Math.min(1.35,Math.max(.3,width/base.width)),viewport=page.getViewport({scale});root.style.width=`${viewport.width}px`;root.style.height=`${viewport.height}px`;
    if(!scroller||typeof IntersectionObserver==='undefined'){setVisible(true);return}
    const observer=new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting??false),{root:scroller,rootMargin:'700px 0px'});observer.observe(root);return()=>observer.disconnect();
  },[page,width,scroller]);
  useEffect(()=>{
    if(!page||!visible)return;
    let cancelled=false,renderTask:{cancel:()=>void;promise:Promise<unknown>}|null=null,textLayer:{cancel:()=>void;render:()=>Promise<unknown>}|null=null;
    const root=host.current;if(!root)return;
    const base=page.getViewport({scale:1}),scale=Math.min(1.35,Math.max(.3,width/base.width)),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');root.replaceChildren();
    canvas.width=Math.ceil(viewport.width*window.devicePixelRatio);canvas.height=Math.ceil(viewport.height*window.devicePixelRatio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;root.append(canvas);
    void(async()=>{
      try{
       const context=canvas.getContext('2d');if(!context)throw new Error('Could not render the PDF page.');
       const transform=window.devicePixelRatio===1?undefined:[window.devicePixelRatio,0,0,window.devicePixelRatio,0,0];
       renderTask=page.render({canvas,canvasContext:context,viewport,transform});await renderTask.promise;if(cancelled)return;
       const layer=document.createElement('div');layer.className='pdf-text-layer textLayer';root.append(layer);const overlay=document.createElement('div');overlay.className='pdf-keyword-overlay';root.append(overlay);
       const pdfjs=await loadPdfJs();textLayer=new pdfjs.TextLayer({textContentSource:await page.getTextContent(),container:layer,viewport});await textLayer.render();if(cancelled)return;
       onMatches(pageNumber,markTextLayer(layer,root,terms));
      }catch{if(!cancelled)onMatches(pageNumber,0)}
    })();
    return()=>{cancelled=true;renderTask?.cancel();textLayer?.cancel();canvas.width=0;canvas.height=0;root.replaceChildren()};
  },[page,visible,pageNumber,width,terms,onMatches]);
  return <div className="pdf-render-page" ref={host} aria-label={`PDF page ${pageNumber}`}/>;
}

export default function PdfKeywordPreview({url,terms,targetPage,onError,onPageCount,loadingLabel,pageLimitLabel}:{url:string;terms:readonly string[];targetPage?:number;onError:(error:string)=>void;onPageCount:(count:number)=>void;loadingLabel:string;pageLimitLabel:(shown:number,total:number)=>string}){
  const scroller=useRef<HTMLDivElement>(null),documentRef=useRef<PDFDocumentProxy|null>(null),[width,setWidth]=useState(560),[documentProxy,setDocumentProxy]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState('');
  const onErrorRef=useRef(onError),onPageCountRef=useRef(onPageCount);onErrorRef.current=onError;onPageCountRef.current=onPageCount;
  useEffect(()=>{
    const element=scroller.current;if(!element)return;
    const measure=()=>setWidth(Math.max(220,element.clientWidth-32));measure();
    const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let active=true;setDocumentProxy(null);setError('');
    void fetch(url).then(response=>{if(!response.ok)throw new Error('Could not load the selected PDF.');return response.arrayBuffer()}).then(data=>loadPdfJs().then(pdfjs=>pdfjs.getDocument({data:new Uint8Array(data)}).promise)).then(pdf=>{if(!active){void pdf.destroy();return}documentRef.current=pdf;setDocumentProxy(pdf);onPageCountRef.current(pdf.numPages)}).catch(reason=>{if(active){const message=reason instanceof Error?reason.message:'Could not render this PDF.';setError(message);onErrorRef.current(message)}});
    return()=>{active=false;const current=documentRef.current;documentRef.current=null;if(current)void current.destroy()};
  },[url]);
  useEffect(()=>{if(!documentProxy||!targetPage||targetPage>documentProxy.numPages)return;const frame=requestAnimationFrame(()=>scroller.current?.querySelector(`[aria-label="PDF page ${targetPage}"]`)?.scrollIntoView({block:'start'}));return()=>cancelAnimationFrame(frame)},[documentProxy,targetPage]);
  return <div className="pdf-keyword-view" ref={scroller}>{error?<p className="files-message">{error}</p>:documentProxy?Array.from({length:Math.min(documentProxy.numPages,30)},(_,index)=><PdfPage key={index+1} documentProxy={documentProxy} pageNumber={index+1} width={width} terms={terms} onMatches={ignoreMatches} scroller={scroller.current}/>):<p className="files-message">{loadingLabel}</p>}{documentProxy&&documentProxy.numPages>30&&<p className="pdf-page-limit">{pageLimitLabel(30,documentProxy.numPages)}</p>}</div>;
}
