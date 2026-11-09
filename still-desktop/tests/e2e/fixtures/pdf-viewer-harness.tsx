import {createRoot,type Root} from 'react-dom/client';
import {useState} from 'react';
import '../../../src/styles.css';
import '../../../src/canvas.css';
import PdfNumberViewer from '../../../src/PdfNumberViewer.tsx';
import TimetableWidget from '../../../src/TimetableWidget.tsx';
import {localFiles} from '../../../src/platform/files.ts';
import type {WidgetInstance} from '../../../src/domain/workspaces.ts';

declare global {
 interface Window {mountPdfViewer?:(base64:string)=>void;mountTimetableFixture?:()=>void;remountPdfViewer?:()=>void;pdfFixtureNative?:boolean;pdfFixturePreviewStarted?:boolean;pdfFixturePreviewResolved?:boolean;pdfFixtureSchedule?:unknown[];pdfFixtureOpenedPage?:unknown}
}

let root:Root|null=null;
let timetableRoot:Root|null=null;
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

window.mountTimetableFixture=()=>{
 let host=document.querySelector<HTMLDivElement>('#timetable-fixture');
 if(!host){host=document.createElement('div');host.id='timetable-fixture';host.style.cssText='position:fixed;right:8px;bottom:8px;width:300px;min-height:170px;z-index:20;padding:8px;background:#2c3038;border:2px dashed #78a9ff;border-radius:10px;overflow:auto';host.setAttribute('aria-label','Timetable drop target');document.body.append(host)}
 function FixtureTimetable(){const[schedule,setSchedule]=useState<WidgetInstance['schedule']>([]);return <TimetableWidget widget={{schedule} as WidgetInstance} update={patch=>{if(patch.schedule){setSchedule(patch.schedule);window.pdfFixtureSchedule=patch.schedule}}} obscured={false} notify={()=>{}}/>}
 timetableRoot??=createRoot(host);timetableRoot.render(<FixtureTimetable/>);
 window.addEventListener('still-open-pdf-page',event=>{window.pdfFixtureOpenedPage=(event as CustomEvent).detail});
};
