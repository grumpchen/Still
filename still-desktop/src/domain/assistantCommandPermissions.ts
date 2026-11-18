const STORAGE_KEY='still-ai-command-destructive-approvals-v1';

type Approval={workspaceId:string;widgetId:string;prompt:string};

function normalizedPrompt(prompt:string){return prompt.trim().replace(/\s+/g,' ').toLocaleLowerCase()}
function readApprovals():Approval[]{
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)??'[]');
    if(!Array.isArray(value))return [];
    return value.filter((item):item is Approval=>!!item&&typeof item.workspaceId==='string'&&typeof item.widgetId==='string'&&typeof item.prompt==='string');
  }catch{return []}
}

export function hasAssistantCommandApproval(workspaceId:string,widgetId:string,prompt:string):boolean{
  const normalized=normalizedPrompt(prompt);
  return !!normalized&&readApprovals().some(item=>item.workspaceId===workspaceId&&item.widgetId===widgetId&&normalizedPrompt(item.prompt)===normalized);
}

export function rememberAssistantCommandApproval(workspaceId:string,widgetId:string,prompt:string):boolean{
  const normalized=normalizedPrompt(prompt);
  if(!workspaceId||!widgetId||!normalized)return false;
  try{
    const approvals=readApprovals().filter(item=>!(item.workspaceId===workspaceId&&item.widgetId===widgetId&&normalizedPrompt(item.prompt)===normalized));
    approvals.push({workspaceId,widgetId,prompt:normalized});
    localStorage.setItem(STORAGE_KEY,JSON.stringify(approvals.slice(-100)));
    return true;
  }catch{return false}
}
