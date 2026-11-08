import {createRoot,type Root} from 'react-dom/client';
import {useState} from 'react';
import '../../../src/styles.css';
import '../../../src/canvas.css';
import PdfNumberViewer from '../../../src/PdfNumberViewer.tsx';
import {localFiles} from '../../../src/platform/files.ts';

declare global {
 interface Window {mountPdfViewer?:(base64:string)=>void;remountPdfViewer?:()=>void;pdfFixtureNative?:boolean;pdfFixturePreviewStarted?:boolean;pdfFixturePreviewResolved?:boolean}
}

let root:Root|null=null;
const widgetId='pdf-viewer-e2e-fixture';

function Fixture(){
 const [instance,setInstance]=useState(0);
 window.remountPdfViewer=()=>setInstance(value=>value+1);
 return <PdfNumberViewer key={instance} widgetId={widgetId} path="fixture.pdf" name="Fixture lecture.pdf"/>;
}

window.mountPdfViewer=base64=>{
 const binary=atob(base64),bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
 localFiles.select(widgetId,[new File([bytes],'fixture.pdf',{type:'application/pdf'})]);
 window.pdfFixtureNative=localFiles.native;
 const preview=localFiles.preview.bind(localFiles);
 localFiles.preview=async(...args)=>{window.pdfFixturePreviewStarted=true;const blob=await preview(...args);window.pdfFixturePreviewResolved=true;return blob};
 root??=createRoot(document.querySelector('#root')!);
 root.render(<Fixture/>);
};
