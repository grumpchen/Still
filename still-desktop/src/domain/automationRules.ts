/** Narrow, durable automation rules. Mutations are always delegated to the app's existing operation service. */
export type AutomationAction =
  | { kind: 'fileResourcesToCourse'; courseId: string; workspaceId: string; resourceKinds: Array<'file'|'link'>; queryPattern: string; sourceWorkspaceId?: string }
  | { kind: 'prepareWorkspaceLayout'; workspaceId: string; layoutId: string };
export type AutomationTrigger =
  | { kind: 'onCapture' }
  | { kind: 'once'; at: string }
  | { kind: 'daily'; time: string; timeZone: string }
  | { kind: 'weekly'; weekdays: number[]; time: string; timeZone: string };
export interface AutomationRule { version: 1; id: string; enabled: boolean; createdAt: string; updatedAt: string; sourceText: string; trigger: AutomationTrigger; action: AutomationAction }
export interface RuleCatalog { workspaces: Array<{id:string;name:string}>; courses: Array<{id:string;title:string;workspaceId?:string}>; layouts: Array<{id:string;name:string;workspaceId?:string}> }
export type RuleParseResult = {kind:'rule';rule:AutomationRule}|{kind:'clarification';message:string;choices?:Array<{id:string;label:string}>}|{kind:'unsupported';message:string};
export interface AutomationRuleDraft { sourceText:string; trigger:AutomationTrigger; action:AutomationAction }
export interface AutomationReceipt { version:1;ruleId:string;occurrenceKey:string;scheduledAt:string;status:'running'|'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';attempts:number;startedAt:string;updatedAt:string;message?:string;operationReceiptId?:string;retryable?:boolean }
export interface AutomationState {version:1;rules:AutomationRule[];receipts:AutomationReceipt[]}
export interface AutomationStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export type AutomationLoadResult={ok:true;state:AutomationState}|{ok:false;error:'corrupt'|'unsupported-version';message:string}
export interface AutomationOperationContext {ruleId:string;occurrenceKey:string;scheduledAt:string;attempt:number;idempotencyKey:string}
export type AutomationOperationResult={status:'succeeded';receiptId?:string;message?:string;changed?:boolean}|{status:'failed';message:string;retryable?:boolean}|{status:'needs_clarification';message:string}|{status:'outcome_unknown';message:string}
/** Implementations must delegate to the same validated app operation service and deduplicate idempotencyKey durably. */
export interface AutomationOperationService {execute(action:AutomationAction,context:AutomationOperationContext):Promise<AutomationOperationResult>}
export const AUTOMATION_STORAGE_KEY='still.automation-rules.v1';
const MAX_RULES=500,MAX_RECEIPTS=5000,ID_RE=/^[A-Za-z0-9_-]{1,120}$/,TIME_RE=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const activeByStorage=new WeakMap<object,Set<string>>();
function activeSet(storage:AutomationStorage):Set<string>{let set=activeByStorage.get(storage as object);if(!set){set=new Set();activeByStorage.set(storage as object,set)}return set}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const validZone=(v:string)=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}};
function triggerOf(v:unknown):AutomationTrigger|null{
 if(!obj(v))return null;
 if(v.kind==='onCapture')return{kind:'onCapture'};
 if(v.kind==='once'&&date(v.at))return{kind:'once',at:new Date(v.at).toISOString()};
 if((v.kind==='daily'||v.kind==='weekly')&&typeof v.time==='string'&&TIME_RE.test(v.time)&&typeof v.timeZone==='string'&&validZone(v.timeZone)){
  if(v.kind==='daily')return{kind:'daily',time:v.time,timeZone:v.timeZone};
  if(Array.isArray(v.weekdays)&&v.weekdays.length>0&&v.weekdays.length<=7&&v.weekdays.every(d=>Number.isInteger(d)&&Number(d)>=0&&Number(d)<=6))return{kind:'weekly',weekdays:[...new Set(v.weekdays as number[])].sort(),time:v.time,timeZone:v.timeZone};
 }
 return null;
}
function actionOf(v:unknown,catalog?:RuleCatalog):AutomationAction|null{
 if(!obj(v))return null;
 if(v.kind==='fileResourcesToCourse'&&typeof v.courseId==='string'&&ID_RE.test(v.courseId)&&typeof v.workspaceId==='string'&&ID_RE.test(v.workspaceId)&&Array.isArray(v.resourceKinds)&&v.resourceKinds.length>0&&v.resourceKinds.length<=2&&v.resourceKinds.every(k=>k==='file'||k==='link')&&typeof v.queryPattern==='string'&&v.queryPattern.trim().length>0&&v.queryPattern.length<=160&&(v.sourceWorkspaceId===undefined||(typeof v.sourceWorkspaceId==='string'&&ID_RE.test(v.sourceWorkspaceId)))){
  const c=catalog?.courses.find(x=>x.id===v.courseId),w=catalog?.workspaces.find(x=>x.id===v.workspaceId);
  if(catalog&&(!c||!w||c.workspaceId!==v.workspaceId||(v.sourceWorkspaceId&&!catalog.workspaces.some(x=>x.id===v.sourceWorkspaceId))))return null;
  return{kind:v.kind,courseId:v.courseId,workspaceId:v.workspaceId,resourceKinds:[...new Set(v.resourceKinds as Array<'file'|'link'>)],queryPattern:v.queryPattern.trim(),...(typeof v.sourceWorkspaceId==='string'?{sourceWorkspaceId:v.sourceWorkspaceId}:{})};
 }
 if(v.kind==='prepareWorkspaceLayout'&&typeof v.workspaceId==='string'&&ID_RE.test(v.workspaceId)&&typeof v.layoutId==='string'&&ID_RE.test(v.layoutId)){
  const w=catalog?.workspaces.find(x=>x.id===v.workspaceId),l=catalog?.layouts.find(x=>x.id===v.layoutId);
  if(catalog&&(!w||!l||(l.workspaceId&&l.workspaceId!==v.workspaceId)))return null;
  return{kind:v.kind,workspaceId:v.workspaceId,layoutId:v.layoutId};
 }
 return null;
}
function ruleOf(v:unknown,catalog?:RuleCatalog):AutomationRule|null{
 if(!obj(v)||v.version!==1||typeof v.id!=='string'||!ID_RE.test(v.id)||typeof v.enabled!=='boolean'||!date(v.createdAt)||!date(v.updatedAt)||typeof v.sourceText!=='string'||v.sourceText.length>2000)return null;
 const trigger=triggerOf(v.trigger),action=actionOf(v.action,catalog);
 if(!trigger||!action||((trigger.kind==='onCapture')!==(action.kind==='fileResourcesToCourse')))return null;
 return{version:1,id:v.id,enabled:v.enabled,createdAt:new Date(v.createdAt).toISOString(),updatedAt:new Date(v.updatedAt).toISOString(),sourceText:v.sourceText,trigger,action};
}
function receiptOf(v:unknown):AutomationReceipt|null{
 if(!obj(v)||v.version!==1||typeof v.ruleId!=='string'||!ID_RE.test(v.ruleId)||typeof v.occurrenceKey!=='string'||v.occurrenceKey.length>240||!date(v.scheduledAt)||!['running','succeeded','failed','needs_clarification','outcome_unknown'].includes(String(v.status))||!Number.isInteger(v.attempts)||Number(v.attempts)<1||!date(v.startedAt)||!date(v.updatedAt))return null;
 if(v.message!==undefined&&typeof v.message!=='string'||v.operationReceiptId!==undefined&&typeof v.operationReceiptId!=='string'||v.retryable!==undefined&&typeof v.retryable!=='boolean')return null;
 return{version:1,ruleId:v.ruleId,occurrenceKey:v.occurrenceKey,scheduledAt:new Date(v.scheduledAt).toISOString(),status:v.status as AutomationReceipt['status'],attempts:Number(v.attempts),startedAt:new Date(v.startedAt).toISOString(),updatedAt:new Date(v.updatedAt).toISOString(),...(typeof v.message==='string'?{message:v.message.slice(0,1000)}:{}),...(typeof v.operationReceiptId==='string'?{operationReceiptId:v.operationReceiptId.slice(0,200)}:{}),...(typeof v.retryable==='boolean'?{retryable:v.retryable}:{})};
}
export function emptyAutomationState():AutomationState{return{version:1,rules:[],receipts:[]}}
/** Corrupt or newer data is never overwritten implicitly. */
export function loadAutomationState(storage:AutomationStorage,key=AUTOMATION_STORAGE_KEY):AutomationLoadResult{
 const raw=storage.getItem(key);if(raw===null)return{ok:true,state:emptyAutomationState()};
 try{const p:unknown=JSON.parse(raw);if(!obj(p)||!Number.isInteger(p.version))return{ok:false,error:'corrupt',message:'Automation data is malformed and has been preserved.'};if(p.version!==1)return{ok:false,error:'unsupported-version',message:'Automation data has a newer or unsupported version and has been preserved.'};if(!Array.isArray(p.rules)||!Array.isArray(p.receipts)||p.rules.length>MAX_RULES||p.receipts.length>MAX_RECEIPTS)return{ok:false,error:'corrupt',message:'Automation collections are invalid and have been preserved.'};const rules=p.rules.map(x=>ruleOf(x)),receipts=p.receipts.map(receiptOf);if(rules.some(x=>!x)||receipts.some(x=>!x)||new Set((rules as AutomationRule[]).map(x=>x.id)).size!==rules.length)return{ok:false,error:'corrupt',message:'Automation data failed validation and has been preserved.'};return{ok:true,state:{version:1,rules:rules as AutomationRule[],receipts:receipts as AutomationReceipt[]}}}catch{return{ok:false,error:'corrupt',message:'Automation data could not be read and has been preserved.'}}
}
export function saveAutomationState(storage:AutomationStorage,state:AutomationState,key=AUTOMATION_STORAGE_KEY):void{if(state.version!==1||state.rules.length>MAX_RULES||state.receipts.length>MAX_RECEIPTS||state.rules.some(x=>!ruleOf(x))||state.receipts.some(x=>!receiptOf(x)))throw new Error('Refusing to save invalid automation data.');storage.setItem(key,JSON.stringify(state))}
export interface RuleParseOptions {catalog:RuleCatalog;now?:Date;timeZone?:string;id?:string}
function named<T extends{id:string;name?:string;title?:string}>(needle:string,items:T[]):T[]{const n=needle.trim().toLocaleLowerCase();return items.filter(x=>(x.name??x.title??'').trim().toLocaleLowerCase()===n)}
function pick<T extends{id:string;name?:string;title?:string}>(needle:string,items:T[],label:string):{item?:T;result?:RuleParseResult}{const found=named(needle,items);if(found.length===1)return{item:found[0]};if(found.length>1)return{result:{kind:'clarification',message:`More than one ${label} is named “${needle}”. Choose the exact one.`,choices:found.map(x=>({id:x.id,label:x.name??x.title??x.id}))}};return{result:{kind:'clarification',message:`I couldn't identify a ${label} named “${needle}”. Choose an existing one.`}}}
/** Literal v1 grammar only; unsupported prose is never passed through as a purported automation. */
export function parseAutomationRule(text:string,options:RuleParseOptions):RuleParseResult{
 const sourceText=text.trim();if(!sourceText||sourceText.length>2000)return{kind:'unsupported',message:'Write one supported automation request (up to 2,000 characters).'};
 const now=options.now??new Date(),zone=options.timeZone??'UTC';if(!validZone(zone))return{kind:'clarification',message:'Choose a valid time zone before creating a scheduled rule.'};
 const make=(trigger:AutomationTrigger,action:AutomationAction):RuleParseResult=>({kind:'rule',rule:{version:1,id:options.id??crypto.randomUUID(),enabled:true,createdAt:now.toISOString(),updatedAt:now.toISOString(),sourceText,trigger,action}});
 const filingEn=sourceText.match(/^when\s+i\s+capture\s+(links?|files?|resources?)\s+matching\s+["“](.+?)["”][,，]?\s*file\s+(?:them\s+)?(?:to|into)\s+(.+?)(?:\s+course(?:\s+workspace)?)?[。.]?$/i);
 const filingZh=sourceText.match(/^(?:新增|添加)(链接|资料)(?:名称)?(?:匹配|包含)["“](.+?)["”](?:时|后)[，,]?\s*(?:整理|归档)(?:到|进)(.+?)(?:课程)?(?:工作区)?[。.]?$/);
 if(filingEn||filingZh){
  const kindText=filingEn?.[1]?.toLowerCase()??filingZh?.[1],pattern=(filingEn?.[2]??filingZh?.[2]??'').trim(),title=(filingEn?.[3]??filingZh?.[3]??'').trim();
  if(!pattern||pattern.length>160)return{kind:'clarification',message:'Add a quoted name or text pattern to match. The rule will not file every item by default.'};
  const matches=options.catalog.courses.filter(x=>x.title.toLocaleLowerCase()===title.toLocaleLowerCase());
  if(matches.length!==1)return{kind:'clarification',message:matches.length?`There are multiple courses named “${title}”. Choose one course workspace.`:`I couldn't identify the course “${title}”. Choose a course linked to a workspace.`,...(matches.length?{choices:matches.map(x=>({id:x.id,label:x.title}))}:{})};
  const course=matches[0];if(!course.workspaceId||!options.catalog.workspaces.some(x=>x.id===course.workspaceId))return{kind:'clarification',message:`“${course.title}” has no available linked workspace. Link a workspace first.`};
  const resourceKinds:Array<'file'|'link'>=kindText==='链接'||kindText?.startsWith('link')?['link']:kindText==='资料'||kindText?.startsWith('resource')?['file','link']:['file'];
  return make({kind:'onCapture'},{kind:'fileResourcesToCourse',courseId:course.id,workspaceId:course.workspaceId,resourceKinds,queryPattern:pattern});
 }
 let trigger:AutomationTrigger|undefined,rest=sourceText;
 const once=sourceText.match(/^(?:at|on)\s+(\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)?)\s+(.+)$/i)??sourceText.match(/^(\d{4}-\d\d-\d\d\s+\d\d:\d\d)\s*(?:时|时为)?\s*(.+)$/);
 if(once){const instant=new Date(once[1].replace(' ','T'));if(!Number.isFinite(instant.getTime()))return{kind:'clarification',message:'That one-time date and time is invalid.'};trigger={kind:'once',at:instant.toISOString()};rest=once[2]}
 const daily=!trigger&&sourceText.match(/^(?:every\s+day\s+at\s+(\d\d:\d\d)|每天\s*(\d\d:\d\d))\s*(.+)$/i);if(daily){trigger={kind:'daily',time:daily[1]??daily[2],timeZone:zone};rest=daily[3]}
 const dayMap:Record<string,number>={sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,wednesday:3,wed:3,thursday:4,thu:4,friday:5,fri:5,saturday:6,sat:6,'周日':0,'星期日':0,'周一':1,'星期一':1,'周二':2,'星期二':2,'周三':3,'星期三':3,'周四':4,'星期四':4,'周五':5,'星期五':5,'周六':6,'星期六':6};
 const weekly=!trigger&&sourceText.match(/^(?:every\s+(sunday|sun|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat)\s+at\s+(\d\d:\d\d)|每(?:周|星期)(日|一|二|三|四|五|六)\s*(\d\d:\d\d))\s*(.+)$/i);if(weekly){const d=weekly[1]?.toLowerCase()??`周${weekly[3]}`;trigger={kind:'weekly',weekdays:[dayMap[d]],time:weekly[2]??weekly[4],timeZone:zone};rest=weekly[5]}
 if(trigger){const task=rest.match(/^(?:prepare|open|arrange)\s+(?:the\s+)?(.+?)\s+(?:workspace\s+)?(?:with|using|layout)\s+(.+?)(?:\s+layout)?$/i)??rest.match(/^(?:为|准备|打开)?\s*(.+?)(?:工作区)?(?:使用|套用)(.+?)(?:布局)?$/);if(!task)return{kind:'unsupported',message:'Supported scheduled layout form: “Every day at 09:00 prepare <workspace> using <layout>” or “每天 09:00 为<工作区>使用<布局>布局”.'};const w=pick(task[1].trim(),options.catalog.workspaces,'workspace');if(!w.item)return w.result!;const ls=options.catalog.layouts.filter(x=>!x.workspaceId||x.workspaceId===w.item!.id),l=pick(task[2].trim(),ls,'saved layout');if(!l.item)return l.result!;return make(trigger,{kind:'prepareWorkspaceLayout',workspaceId:w.item.id,layoutId:l.item.id})}
 return{kind:'unsupported',message:'Supported filing form: “When I capture links matching "<text>", file them to <course> course” / “新增链接匹配“<文本>”时，整理到<课程>课程”. Supported layout form: prepare a named workspace with a saved layout once, daily, or weekly at an explicit time.'}
}
export function validateAutomationRuleDraft(draft:AutomationRuleDraft,catalog:RuleCatalog):{ok:true;trigger:AutomationTrigger;action:AutomationAction}|{ok:false;message:string}{const trigger=triggerOf(draft.trigger),action=actionOf(draft.action,catalog);if(!trigger)return{ok:false,message:'Trigger is invalid or unsupported.'};if(!action)return{ok:false,message:'Action references a missing or mismatched object; resolve exact current IDs.'};if((trigger.kind==='onCapture')!==(action.kind==='fileResourcesToCourse'))return{ok:false,message:'Resource filing requires the resource-added trigger; layout preparation requires a time trigger.'};return{ok:true,trigger,action}}
export function createAutomationRule(draft:AutomationRuleDraft,catalog:RuleCatalog,now=new Date(),id=crypto.randomUUID()):{ok:true;rule:AutomationRule}|{ok:false;message:string}{const v=validateAutomationRuleDraft(draft,catalog);if(!v.ok)return v;if(!draft.sourceText.trim()||draft.sourceText.length>2000||!ID_RE.test(id))return{ok:false,message:'Rule text or ID is invalid.'};const rule=ruleOf({version:1,id,enabled:true,createdAt:now.toISOString(),updatedAt:now.toISOString(),sourceText:draft.sourceText.trim(),trigger:v.trigger,action:v.action},catalog);return rule?{ok:true,rule}:{ok:false,message:'Rule failed final validation.'}}
function localParts(d:Date,z:string):{date:string;time:string;weekday:number}{const p=new Intl.DateTimeFormat('en-US',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(d),get=(x:string)=>p.find(y=>y.type===x)?.value??'',days:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`,weekday:days[get('weekday')]}}
export interface DueOccurrence{rule:AutomationRule;occurrenceKey:string;scheduledAt:string}
/** One occurrence per rule/local day; successful and clarification receipts are terminal. */
export function dueAutomationOccurrences(state:AutomationState,now=new Date()):DueOccurrence[]{const out:DueOccurrence[]=[];for(const rule of state.rules){if(!rule.enabled||rule.trigger.kind==='onCapture')continue;const t=rule.trigger;let key:string,at:string;if(t.kind==='once'){at=t.at;if(Date.parse(at)>now.getTime())continue;key=`once:${at}`}else{const p=localParts(now,t.timeZone);if(p.time<t.time||(t.kind==='weekly'&&!t.weekdays.includes(p.weekday)))continue;key=`${t.kind}:${p.date}:${t.timeZone}:${t.time}`;at=now.toISOString()}const receipt=state.receipts.find(x=>x.ruleId===rule.id&&x.occurrenceKey===key);if(receipt&&(receipt.status==='succeeded'||receipt.status==='needs_clarification'||receipt.status==='outcome_unknown'||receipt.status==='running'||(receipt.status==='failed'&&!receipt.retryable)))continue;out.push({rule,occurrenceKey:key,scheduledAt:at})}return out}
function putReceipt(s:AutomationState,r:AutomationReceipt):AutomationState{return{...s,receipts:[...s.receipts.filter(x=>x.ruleId!==r.ruleId||x.occurrenceKey!==r.occurrenceKey),r].slice(-MAX_RECEIPTS)}}
export interface EvaluateOptions{storage:AutomationStorage;service:AutomationOperationService;now?:Date;key?:string;pendingCaptureEventId?:string}
/** Persists a running claim before every call and reuses an idempotency key on recovery/retry. */
export async function evaluateAutomationRules(o:EvaluateOptions):Promise<{ok:true;state:AutomationState;results:AutomationReceipt[]}|{ok:false;error:string}>{const loaded=loadAutomationState(o.storage,o.key);if(!loaded.ok)return{ok:false,error:loaded.message};const now=o.now??new Date();let state=loaded.state;const results:AutomationReceipt[]=[];
 // A durable running claim surviving restart is an ambiguous outcome, not a safe retry.
 // A claim still held by this process belongs to a concurrent tick and remains running.
 const active=activeSet(o.storage);
 for(const prior of state.receipts.filter(x=>x.status==='running')){const activeKey=`${prior.ruleId}/${prior.occurrenceKey}`;if(active.has(activeKey))continue;const unknown:AutomationReceipt={...prior,status:'outcome_unknown',updatedAt:now.toISOString(),message:'The previous attempt ended before its outcome was recorded. Check the operation service receipt before retrying.'};state=putReceipt(state,unknown);results.push(unknown)}
 let due=dueAutomationOccurrences(state,now);if(o.pendingCaptureEventId)for(const rule of state.rules)if(rule.enabled&&rule.trigger.kind==='onCapture'){const key=`capture-event:${o.pendingCaptureEventId}`,old=state.receipts.find(x=>x.ruleId===rule.id&&x.occurrenceKey===key);if(old?.status!=='succeeded'&&old?.status!=='needs_clarification'&&old?.status!=='outcome_unknown'&&old?.status!=='running'&&!(old?.status==='failed'&&!old.retryable)&&!due.some(x=>x.rule.id===rule.id&&x.occurrenceKey===key))due.push({rule,occurrenceKey:key,scheduledAt:now.toISOString()})}
 for(const occ of due){const activeKey=`${occ.rule.id}/${occ.occurrenceKey}`;if(active.has(activeKey))continue;const old=state.receipts.find(x=>x.ruleId===occ.rule.id&&x.occurrenceKey===occ.occurrenceKey),running:AutomationReceipt={version:1,ruleId:occ.rule.id,occurrenceKey:occ.occurrenceKey,scheduledAt:occ.scheduledAt,status:'running',attempts:(old?.attempts??0)+1,startedAt:old?.startedAt??now.toISOString(),updatedAt:now.toISOString()};state=putReceipt(state,running);try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Could not persist in-flight receipt: ${e instanceof Error?e.message:String(e)}`}}active.add(activeKey);let result:AutomationOperationResult;try{result=await o.service.execute(occ.rule.action,{ruleId:occ.rule.id,occurrenceKey:occ.occurrenceKey,scheduledAt:occ.scheduledAt,attempt:running.attempts,idempotencyKey:`${occ.rule.id}/${occ.occurrenceKey}`})}catch(e){result={status:'outcome_unknown',message:e instanceof Error?e.message:String(e)}}finally{active.delete(activeKey)}const receipt:AutomationReceipt={...running,status:result.status,updatedAt:(o.now??now).toISOString(),...(result.message?{message:result.message.slice(0,1000)}:{}),...(result.status==='failed'?{retryable:result.retryable===true}:{}),...(result.status==='succeeded'&&result.receiptId?{operationReceiptId:result.receiptId}:{})};state=putReceipt(state,receipt);try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Operation returned ${result.status}, but receipt could not be persisted: ${e instanceof Error?e.message:String(e)}`}}results.push(receipt)}
 try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Could not persist rule receipts: ${e instanceof Error?e.message:String(e)}`}}return{ok:true,state,results}}
