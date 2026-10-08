import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen,type UnlistenFn} from '@tauri-apps/api/event';

export type AppCaptureResult=
 |{kind:'target';hwnd:number;pid:number;title:string}
 |{kind:'failure';stage:string;message:string};

export const appCapture={
 available:isTauri(),
 enable:()=>invoke<void>('app_capture_enable'),
 subscribe:(callback:(result:AppCaptureResult)=>void):Promise<UnlistenFn>=>listen<AppCaptureResult>('app-capture-result',event=>callback(event.payload)),
};
