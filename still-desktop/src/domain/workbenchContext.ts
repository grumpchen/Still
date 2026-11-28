import type {WorkbenchSnapshot,WorkbenchReceipt} from '../platform/workbenchOperations.ts';

const MAX_CONTEXT_BYTES=20_000;
const MAX_DIRECTORY_ENTRIES=120;
const MAX_RECENT_RESULTS=4;
const MAX_RECENT_ROWS=8;
const MAX_RECENT_TEXT=240;

function byteLength(value:unknown):number{return new TextEncoder().encode(JSON.stringify(value)).length}
function short(value:unknown):unknown{
 if(typeof value==='string')return value.length>MAX_RECENT_TEXT?`${value.slice(0,MAX_RECENT_TEXT)}…`:value;
 if(Array.isArray(value))return value.slice(0,MAX_RECENT_ROWS).map(short);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).slice(0,16).map(([key,item])=>[key,short(item)]));
 return value;
}
function boundRecent(receipts:WorkbenchReceipt[]){
 const matching=receipts.filter(item=>item.operation==='resource.find'||item.operation==='note.find'||item.operation==='layout.find'||item.operation==='layout.list');
 const recent=matching.slice(-MAX_RECENT_RESULTS).map(item=>{
  let data=short(item.data);
  if(Array.isArray(item.data)&&item.data.length>MAX_RECENT_ROWS)data={items:item.data.slice(0,MAX_RECENT_ROWS).map(short),contextTruncated:true,totalItems:item.data.length};
  else if(item.data&&typeof item.data==='object'){
   const original=item.data as Record<string,unknown>,results=original.results;
   if(Array.isArray(results)&&results.length>MAX_RECENT_ROWS)data={...(short({...original,results:results.slice(0,MAX_RECENT_ROWS)}) as Record<string,unknown>),contextTruncated:true,totalResults:results.length};
   else data=short(original);
  }
  return{operation:item.operation,summary:short(item.summary),...(data===undefined?{}:{data})};
 });
 let truncated=matching.length>MAX_RECENT_RESULTS||recent.some((item,index)=>JSON.stringify(item)!==JSON.stringify({operation:matching.slice(-MAX_RECENT_RESULTS)[index]?.operation,summary:matching.slice(-MAX_RECENT_RESULTS)[index]?.summary,...(matching.slice(-MAX_RECENT_RESULTS)[index]?.data===undefined?{}:{data:matching.slice(-MAX_RECENT_RESULTS)[index]?.data})}));
 while(recent.length&&byteLength(recent)>6_000){recent.shift();truncated=true}
 return{recent,truncated};
}

/** Keep workspace IDs visible while bounding the cross-workspace resource catalogue sent to the model. */
export function boundedWorkbenchContext(snapshot:WorkbenchSnapshot,recentResults:WorkbenchReceipt[]){
 let groups=0,dashboardModules=0;
 const workspaces=snapshot.workspaces.map(workspace=>{const savedGroups=(workspace.groups??[]).slice(0,MAX_DIRECTORY_ENTRIES-groups);groups+=savedGroups.length;const modules=workspace.dashboardModules?.slice(0,Math.max(0,MAX_DIRECTORY_ENTRIES-dashboardModules));dashboardModules+=modules?.length??0;return{...workspace,files:[],links:[],...(workspace.groups?{groups:savedGroups}:{}),...(workspace.dashboardModules?{dashboardModules:modules}:{})} as WorkbenchSnapshot['workspaces'][number]});
 const layouts:WorkbenchSnapshot['layouts']=[];
 let files=0,links=0,layoutCount=0;
 const candidates=snapshot.workspaces.flatMap((workspace,index)=>[
  ...workspace.files.map(item=>({kind:'file' as const,index,item})),
  ...workspace.links.map(item=>({kind:'link' as const,index,item})),
 ]);
 const automationRules=snapshot.automationRules?.slice(0,MAX_DIRECTORY_ENTRIES).map(rule=>({...rule,sourceText:rule.sourceText.slice(0,240)})),base={workspaces,layouts,...(automationRules?{automationRules}:{})},overBudget=()=>byteLength(base)>MAX_CONTEXT_BYTES;
 for(const candidate of candidates){
  if(candidate.kind==='file'){
   if(files>=MAX_DIRECTORY_ENTRIES)continue;
   workspaces[candidate.index].files.push(candidate.item);files++;
  }else{
   if(links>=MAX_DIRECTORY_ENTRIES)continue;
   workspaces[candidate.index].links.push(candidate.item);links++;
  }
  if(overBudget()){
   if(candidate.kind==='file'){workspaces[candidate.index].files.pop();files--}
   else{workspaces[candidate.index].links.pop();links--}
   break;
  }
 }
 for(const layout of snapshot.layouts){
  if(layoutCount>=MAX_DIRECTORY_ENTRIES)break;
  layouts.push(layout);layoutCount++;
  if(overBudget()){layouts.pop();layoutCount--;break}
 }
 const omitted={
  files:snapshot.workspaces.reduce((sum,item)=>sum+item.files.length,0)-files,
  links:snapshot.workspaces.reduce((sum,item)=>sum+item.links.length,0)-links,
  layouts:snapshot.layouts.length-layoutCount,
  groups:snapshot.workspaces.reduce((sum,item)=>sum+(item.groups?.length??0),0)-groups,
  dashboardModules:snapshot.workspaces.reduce((sum,item)=>sum+(item.dashboardModules?.length??0),0)-dashboardModules,
  automationRules:(snapshot.automationRules?.length??0)-(automationRules?.length??0),
 };
 const directoryTruncated=Object.values(omitted).some(count=>count>0);
 const recent=boundRecent(recentResults);
 const result:{workspaces:typeof workspaces;layouts:typeof layouts;automationRules?:typeof automationRules;recentResults:typeof recent.recent;directoryTruncated?:true;directoryOmitted?:typeof omitted;directoryNotice?:string;recentResultsTruncated?:true}={workspaces,layouts,...(automationRules?{automationRules}:{}),recentResults:recent.recent};
 if(directoryTruncated){result.directoryTruncated=true;result.directoryOmitted=omitted;result.directoryNotice='This directory is partial. Use resource.find or layout.find to search omitted Files, links or layouts. Request group.list / dashboard.list / rule.list for omitted entries.'}
 if(recent.truncated)result.recentResultsTruncated=true;
 return result;
}
