import {installedAppRequest,matchInstalledApp} from '../domain/assistantInstalledApps.ts';
import {appPanel} from './appPanel.ts';

export async function openAssistantInstalledApp(request:NonNullable<ReturnType<typeof installedAppRequest>>,zh:boolean){
 if(!appPanel.available)return {handled:true,message:zh?'请在 Still 的 Windows 桌面版中打开已安装的应用。':'Open installed apps from the Still desktop app on Windows.'};
 const {exact,candidates}=matchInstalledApp(await appPanel.installed(),request);
 if(candidates.length===0){
  if(!request.explicit&&!request.alias)return {handled:false};
  return {handled:true,message:zh?`在 Still 的已安装应用列表里找不到「${request.name}」。`:`I couldn’t find “${request.name}” in Still’s installed app list.`};
 }
 if(!exact||candidates.length>1){
  const names=[...new Set(candidates.map(app=>app.name))];
  const list=names.slice(0,8).join(zh?'、':', ');
  if(names.length===1&&candidates.length>1)return {handled:true,message:zh?`找到多个同名的「${list}」。请在 Apps 中选择要打开的快捷方式。`:`Several shortcuts share the name “${list}”. Choose the one you want in Apps.`};
  return {handled:true,message:zh
   ?`匹配到这些应用：${list}。请说「打开应用 ${names[0]}」或指定另一个完整名称。`
   :`Matching apps: ${list}. Say “Open app ${names[0]}” or specify another full name.`};
 }
 const app=candidates[0];
 await appPanel.launchInstalled(app.id);
 return {handled:true,message:zh?`已请求 Windows 打开「${app.name}」。`:`Asked Windows to open “${app.name}”.`};
}
