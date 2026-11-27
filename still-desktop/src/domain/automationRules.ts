/** Narrow, durable automation rules. Mutations are always delegated to the app's existing operation service. */
export type AutomationAction =
  | { kind: 'fileResourcesToCourse'; courseId: string; workspaceId: string; resourceKinds: Array<'file'|'link'>; queryPattern: string; sourceWorkspaceId?: string }
  | { kind: 'prepareWorkspaceLayout'; workspaceId: string; layoutId: string; mode:'append'|'replace' };
type LegacyAutomationAction={kind:'prepareWorkspaceLayout';workspaceId:string;layoutId:string;mode?:undefined};
type StoredAutomationAction=AutomationAction|LegacyAutomationAction;
export type AutomationTrigger =
  | { kind: 'onCapture' }
  | { kind: 'once'; at: string }
  | { kind: 'daily'; time: string; timeZone: string }
  | { kind: 'weekly'; weekdays: number[]; time: string; timeZone: string };
export interface AutomationRule { version: 2; id: string; enabled: boolean; createdAt: string; updatedAt: string; sourceText: string; trigger: AutomationTrigger; action: StoredAutomationAction; requiresModeChoice?:boolean; resumeAfterModeChoice?:boolean; onceTerminal?: { at:string; status:'succeeded'|'needs_clarification'|'outcome_unknown' } }
export interface RuleCatalog { workspaces: Array<{id:string;name:string}>; courses: Array<{id:string;title:string;workspaceId?:string}>; layouts: Array<{id:string;name:string;workspaceId?:string}> }
export type RuleParseResult = {kind:'rule';rule:AutomationRule}|{kind:'clarification';message:string;choices?:Array<{id:string;label:string}>;code?:'layout-mode-required';pendingLayout?:{trigger:AutomationTrigger;workspaceId:string;layoutId:string}}|{kind:'unsupported';message:string};
export interface AutomationRuleDraft { sourceText:string; trigger:AutomationTrigger; action:AutomationAction }
export interface AutomationReceipt { version:1;ruleId:string;occurrenceKey:string;scheduledAt:string;status:'running'|'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';attempts:number;startedAt:string;updatedAt:string;message?:string;operationReceiptId?:string;retryable?:boolean }
export interface AutomationState {version:2;rules:AutomationRule[];receipts:AutomationReceipt[]}
export interface AutomationStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export type AutomationLoadResult={ok:true;state:AutomationState}|{ok:false;error:'corrupt'|'unsupported-version';message:string}
export interface AutomationOperationContext {ruleId:string;occurrenceKey:string;scheduledAt:string;attempt:number;idempotencyKey:string;captureEventId?:string}
export interface AutomationCaptureEvent {eventId:string;capturedAt:string;resourceKind:'file'|'link'|'idea';name:string;sourceWorkspaceId?:string;widgetId?:string;linkOrigin?:string;linkId?:string;url?:string;resourceId?:string;documentId?:string}
export type AutomationOperationResult={status:'succeeded';receiptId?:string;message?:string;changed?:boolean}|{status:'failed';message:string;retryable?:boolean}|{status:'needs_clarification';message:string}|{status:'outcome_unknown';message:string}
/** Implementations must delegate to the same validated app operation service and deduplicate idempotencyKey durably. */
export interface AutomationOperationService {execute(action:AutomationAction,context:AutomationOperationContext):Promise<AutomationOperationResult>}
export const AUTOMATION_STORAGE_KEY='still.automation-rules.v2';
export const LEGACY_AUTOMATION_STORAGE_KEY='still.automation-rules.v1';
const MAX_RULES=500,MAX_RECEIPTS=5000,ID_RE=/^[A-Za-z0-9_-]{1,120}$/,TIME_RE=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const activeByStorage=new WeakMap<object,Set<string>>();
const evaluationTails=new WeakMap<object,Promise<void>>();
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
function actionOf(v:unknown,catalog?:RuleCatalog,allowMissingLayoutMode=false):StoredAutomationAction|null{
 if(!obj(v))return null;
 if(v.kind==='fileResourcesToCourse'&&typeof v.courseId==='string'&&ID_RE.test(v.courseId)&&typeof v.workspaceId==='string'&&ID_RE.test(v.workspaceId)&&Array.isArray(v.resourceKinds)&&v.resourceKinds.length>0&&v.resourceKinds.length<=2&&v.resourceKinds.every(k=>k==='file'||k==='link')&&typeof v.queryPattern==='string'&&v.queryPattern.trim().length>0&&v.queryPattern.length<=160&&(v.sourceWorkspaceId===undefined||(typeof v.sourceWorkspaceId==='string'&&ID_RE.test(v.sourceWorkspaceId)))){
  const c=catalog?.courses.find(x=>x.id===v.courseId),w=catalog?.workspaces.find(x=>x.id===v.workspaceId);
  if(catalog&&(!c||!w||c.workspaceId!==v.workspaceId||(v.sourceWorkspaceId&&!catalog.workspaces.some(x=>x.id===v.sourceWorkspaceId))))return null;
  return{kind:v.kind,courseId:v.courseId,workspaceId:v.workspaceId,resourceKinds:[...new Set(v.resourceKinds as Array<'file'|'link'>)],queryPattern:v.queryPattern.trim(),...(typeof v.sourceWorkspaceId==='string'?{sourceWorkspaceId:v.sourceWorkspaceId}:{})};
 }
 if(v.kind==='prepareWorkspaceLayout'&&typeof v.workspaceId==='string'&&ID_RE.test(v.workspaceId)&&typeof v.layoutId==='string'&&ID_RE.test(v.layoutId)&&(v.mode==='append'||v.mode==='replace'||(allowMissingLayoutMode&&v.mode===undefined))){
  const w=catalog?.workspaces.find(x=>x.id===v.workspaceId),l=catalog?.layouts.find(x=>x.id===v.layoutId);
  // A saved layout can be copied from a different workspace; workspaceId on
  // the catalog entry describes its source, while the action names its target.
  if(catalog&&(!w||!l))return null;
  return v.mode==='append'||v.mode==='replace'?{kind:v.kind,workspaceId:v.workspaceId,layoutId:v.layoutId,mode:v.mode}:allowMissingLayoutMode?{kind:v.kind,workspaceId:v.workspaceId,layoutId:v.layoutId}:null;
 }
 return null;
}
function ruleOf(v:unknown,catalog?:RuleCatalog):AutomationRule|null{
 if(!obj(v)||v.version!==2||typeof v.id!=='string'||!ID_RE.test(v.id)||typeof v.enabled!=='boolean'||!date(v.createdAt)||!date(v.updatedAt)||typeof v.sourceText!=='string'||v.sourceText.length>2000)return null;
 const trigger=triggerOf(v.trigger),needsModeChoice=v.requiresModeChoice===true,action=actionOf(v.action,catalog,needsModeChoice);
 if(!trigger||!action||((trigger.kind==='onCapture')!==(action.kind==='fileResourcesToCourse')))return null;
 if(v.requiresModeChoice!==undefined&&typeof v.requiresModeChoice!=='boolean'||v.resumeAfterModeChoice!==undefined&&typeof v.resumeAfterModeChoice!=='boolean')return null;
 if(needsModeChoice&&(v.enabled||action.kind!=='prepareWorkspaceLayout'||action.mode!==undefined)||v.resumeAfterModeChoice===true&&!needsModeChoice)return null;
 if(v.onceTerminal!==undefined&&(!obj(v.onceTerminal)||!date(v.onceTerminal.at)||!['succeeded','needs_clarification','outcome_unknown'].includes(String(v.onceTerminal.status))||trigger.kind!=='once'||new Date(v.onceTerminal.at).toISOString()!==trigger.at))return null;
 return{version:2,id:v.id,enabled:v.enabled,createdAt:new Date(v.createdAt).toISOString(),updatedAt:new Date(v.updatedAt).toISOString(),sourceText:v.sourceText,trigger,action,...(needsModeChoice?{requiresModeChoice:true}:{}),...(needsModeChoice&&v.resumeAfterModeChoice===true?{resumeAfterModeChoice:true}:{}),...(obj(v.onceTerminal)?{onceTerminal:{at:new Date(String(v.onceTerminal.at)).toISOString(),status:v.onceTerminal.status as 'succeeded'|'needs_clarification'|'outcome_unknown'}}:{})};
}
function receiptOf(v:unknown):AutomationReceipt|null{
 if(!obj(v)||v.version!==1||typeof v.ruleId!=='string'||!ID_RE.test(v.ruleId)||typeof v.occurrenceKey!=='string'||v.occurrenceKey.length>240||!date(v.scheduledAt)||!['running','succeeded','failed','needs_clarification','outcome_unknown'].includes(String(v.status))||!Number.isInteger(v.attempts)||Number(v.attempts)<1||!date(v.startedAt)||!date(v.updatedAt))return null;
 if(v.message!==undefined&&typeof v.message!=='string'||v.operationReceiptId!==undefined&&typeof v.operationReceiptId!=='string'||v.retryable!==undefined&&typeof v.retryable!=='boolean')return null;
 return{version:1,ruleId:v.ruleId,occurrenceKey:v.occurrenceKey,scheduledAt:new Date(v.scheduledAt).toISOString(),status:v.status as AutomationReceipt['status'],attempts:Number(v.attempts),startedAt:new Date(v.startedAt).toISOString(),updatedAt:new Date(v.updatedAt).toISOString(),...(typeof v.message==='string'?{message:v.message.slice(0,1000)}:{}),...(typeof v.operationReceiptId==='string'?{operationReceiptId:v.operationReceiptId.slice(0,200)}:{}),...(typeof v.retryable==='boolean'?{retryable:v.retryable}:{})};
}
export function emptyAutomationState():AutomationState{return{version:2,rules:[],receipts:[]}}
/** Corrupt or newer data is never overwritten implicitly. */
export function loadAutomationState(storage:AutomationStorage,key=AUTOMATION_STORAGE_KEY):AutomationLoadResult{
 const raw=storage.getItem(key)??(key===AUTOMATION_STORAGE_KEY?storage.getItem(LEGACY_AUTOMATION_STORAGE_KEY):null);if(raw===null)return{ok:true,state:emptyAutomationState()};
 try{const p:unknown=JSON.parse(raw);if(!obj(p)||!Number.isInteger(p.version))return{ok:false,error:'corrupt',message:'Automation data is malformed and has been preserved.'};if(p.version!==1&&p.version!==2)return{ok:false,error:'unsupported-version',message:'Automation data has a newer or unsupported version and has been preserved.'};if(!Array.isArray(p.rules)||!Array.isArray(p.receipts)||p.rules.length>MAX_RULES||p.receipts.length>MAX_RECEIPTS)return{ok:false,error:'corrupt',message:'Automation collections are invalid and have been preserved.'};const rules=p.rules.map(x=>{
   const migrated=p.version===1&&obj(x)?{...x,version:2}:x;
   // v1 layout rules predate append/replace semantics. Never assume replace:
   // load them disabled until the user explicitly chooses a mode in the panel.
   if(p.version===1&&obj(migrated)&&obj(migrated.action)&&migrated.action.kind==='prepareWorkspaceLayout'&&migrated.action.mode===undefined)return ruleOf({...migrated,enabled:false,requiresModeChoice:true,resumeAfterModeChoice:obj(x)&&x.enabled===true});
   return ruleOf(migrated);
  }),receipts=p.receipts.map(receiptOf);if(rules.some(x=>!x)||receipts.some(x=>!x)||new Set((rules as AutomationRule[]).map(x=>x.id)).size!==rules.length)return{ok:false,error:'corrupt',message:'Automation data failed validation and has been preserved.'};return{ok:true,state:{version:2,rules:rules as AutomationRule[],receipts:receipts as AutomationReceipt[]}}}catch{return{ok:false,error:'corrupt',message:'Automation data could not be read and has been preserved.'}}
}
export function saveAutomationState(storage:AutomationStorage,state:AutomationState,key=AUTOMATION_STORAGE_KEY):void{if(state.version!==2||state.rules.length>MAX_RULES||state.receipts.length>MAX_RECEIPTS||state.rules.some(x=>!ruleOf(x))||state.receipts.some(x=>!receiptOf(x)))throw new Error('Refusing to save invalid automation data.');storage.setItem(key,JSON.stringify(state))}
export interface RuleParseOptions {catalog:RuleCatalog;now?:Date;timeZone?:string;id?:string}
function named<T extends{id:string;name?:string;title?:string}>(needle:string,items:T[]):T[]{const n=needle.trim().toLocaleLowerCase();return items.filter(x=>(x.name??x.title??'').trim().toLocaleLowerCase()===n)}
function pick<T extends{id:string;name?:string;title?:string}>(needle:string,items:T[],label:string):{item?:T;result?:RuleParseResult}{const found=named(needle,items);if(found.length===1)return{item:found[0]};if(found.length>1)return{result:{kind:'clarification',message:`More than one ${label} is named “${needle}”. Choose the exact one.`,choices:found.map(x=>({id:x.id,label:x.name??x.title??x.id}))}};return{result:{kind:'clarification',message:`I couldn't identify a ${label} named “${needle}”. Choose an existing one.`}}}
/** Literal v1 grammar only; unsupported prose is never passed through as a purported automation. */
export function parseAutomationRule(text:string,options:RuleParseOptions):RuleParseResult{
 const sourceText=text.trim();if(!sourceText||sourceText.length>2000)return{kind:'unsupported',message:'Write one supported automation request (up to 2,000 characters).'};
 const now=options.now??new Date(),zone=options.timeZone??'UTC';if(!validZone(zone))return{kind:'clarification',message:'Choose a valid time zone before creating a scheduled rule.'};
 const make=(trigger:AutomationTrigger,action:AutomationAction):RuleParseResult=>{const checkedTrigger=triggerOf(trigger),checkedAction=actionOf(action,options.catalog);if(!checkedTrigger)return{kind:'clarification',message:'The requested schedule time or weekday is invalid. Use a real 24-hour time such as 09:30.'};if(!checkedAction)return{kind:'clarification',message:'The selected workspace, course, or saved layout is no longer available.'};return{kind:'rule',rule:{version:2,id:options.id??crypto.randomUUID(),enabled:true,createdAt:now.toISOString(),updatedAt:now.toISOString(),sourceText,trigger:checkedTrigger,action:checkedAction as AutomationAction}}};
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
 if(trigger){
  let workspaceName='',layoutName='',mode:'append'|'replace'|undefined;
  const prepEn=rest.match(/^(?:prepare|open|arrange)\s+(?:the\s+)?(.+?)\s+(?:workspace\s+)?(?:with|using|layout)\s+(.+?)(?:\s+layout)?(?:\s+with\s+(append|replace))?$/i);
  const prepZh=rest.match(/^(?:为|准备|打开)?\s*(.+?)(?:工作区)?(?:使用|套用)(.+?)(?:布局)?(?:并)?(追加|替换)?$/);
  const appendEn=rest.match(/^append\s+(.+?)\s+layout\s+to\s+(.+?)\s+workspace$/i);
  const replaceEn=rest.match(/^replace\s+(.+?)\s+workspace\s+with\s+(.+?)\s+layout$/i);
  const appendZh=rest.match(/^追加(.+?)布局到(.+?)工作区$/),replaceZh=rest.match(/^替换(.+?)工作区为(.+?)布局$/);
  if(appendEn){layoutName=appendEn[1];workspaceName=appendEn[2];mode='append'}
  else if(replaceEn){workspaceName=replaceEn[1];layoutName=replaceEn[2];mode='replace'}
  else if(appendZh){layoutName=appendZh[1];workspaceName=appendZh[2];mode='append'}
  else if(replaceZh){workspaceName=replaceZh[1];layoutName=replaceZh[2];mode='replace'}
  else if(prepEn){workspaceName=prepEn[1];layoutName=prepEn[2];mode=prepEn[3]?.toLowerCase() as 'append'|'replace'|undefined}
  else if(prepZh){workspaceName=prepZh[1];layoutName=prepZh[2];mode=prepZh[3]==='追加'?'append':prepZh[3]==='替换'?'replace':undefined}
  else return{kind:'unsupported',message:'Use an explicit append or replace layout action, for example “Every day at 09:00 append Lab layout to Biology workspace” or “每天 09:00 追加Lab布局到Biology工作区”.'};
  const w=pick(workspaceName.trim(),options.catalog.workspaces,'workspace');if(!w.item)return w.result!;
  const l=pick(layoutName.trim(),options.catalog.layouts,'saved layout');if(!l.item)return l.result!;
  if(!mode)return{kind:'clarification',code:'layout-mode-required',message:'Choose how to apply the saved layout. Append keeps current widgets and adds the layout; replace replaces the workspace layout.',choices:[{id:'append',label:'Append · keep current widgets'},{id:'replace',label:'Replace · replace workspace layout'}],pendingLayout:{trigger,workspaceId:w.item.id,layoutId:l.item.id}};
  return make(trigger,{kind:'prepareWorkspaceLayout',workspaceId:w.item.id,layoutId:l.item.id,mode});
 }
 return{kind:'unsupported',message:'Supported filing form: “When I capture links matching "<text>", file them to <course> course” / “新增链接匹配“<文本>”时，整理到<课程>课程”. Supported layout form: prepare a named workspace with a saved layout once, daily, or weekly at an explicit time.'}
}
export function validateAutomationRuleDraft(draft:AutomationRuleDraft,catalog:RuleCatalog):{ok:true;trigger:AutomationTrigger;action:AutomationAction}|{ok:false;message:string}{const trigger=triggerOf(draft.trigger),action=actionOf(draft.action,catalog);if(!trigger)return{ok:false,message:'Trigger is invalid or unsupported.'};if(!action)return{ok:false,message:'Action references a missing or mismatched object; resolve exact current IDs.'};if(action.kind==='prepareWorkspaceLayout'&&!action.mode)return{ok:false,message:'Choose append or replace before creating a layout rule.'};if((trigger.kind==='onCapture')!==(action.kind==='fileResourcesToCourse'))return{ok:false,message:'Resource filing requires the resource-added trigger; layout preparation requires a time trigger.'};return{ok:true,trigger,action:action as AutomationAction}}
export function createAutomationRule(draft:AutomationRuleDraft,catalog:RuleCatalog,now=new Date(),id:string=crypto.randomUUID()):{ok:true;rule:AutomationRule}|{ok:false;message:string}{const v=validateAutomationRuleDraft(draft,catalog);if(!v.ok)return v;if(!draft.sourceText.trim()||draft.sourceText.length>2000||!ID_RE.test(id))return{ok:false,message:'Rule text or ID is invalid.'};const rule=ruleOf({version:2,id,enabled:true,createdAt:now.toISOString(),updatedAt:now.toISOString(),sourceText:draft.sourceText.trim(),trigger:v.trigger,action:v.action},catalog);return rule?{ok:true,rule}:{ok:false,message:'Rule failed final validation.'}}
function localParts(d:Date,z:string):{date:string;time:string;weekday:number}{const p=new Intl.DateTimeFormat('en-US',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(d),get=(x:string)=>p.find(y=>y.type===x)?.value??'',days:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`,weekday:days[get('weekday')]}}
export interface DueOccurrence{rule:AutomationRule;occurrenceKey:string;scheduledAt:string}
/** One occurrence per rule/local day; successful and clarification receipts are terminal. */
export function dueAutomationOccurrences(state:AutomationState,now=new Date()):DueOccurrence[]{const out:DueOccurrence[]=[];for(const rule of state.rules){if(!rule.enabled||rule.trigger.kind==='onCapture')continue;const t=rule.trigger;let key:string,at:string;if(t.kind==='once'){at=t.at;if(Date.parse(at)>now.getTime()||rule.onceTerminal?.at===t.at)continue;key=`once:${at}`}else{const p=localParts(now,t.timeZone);if(p.time<t.time||(t.kind==='weekly'&&!t.weekdays.includes(p.weekday)))continue;key=`${t.kind}:${p.date}:${t.timeZone}:${t.time}`;at=now.toISOString()}const receipt=state.receipts.find(x=>x.ruleId===rule.id&&x.occurrenceKey===key);if(receipt&&(receipt.status==='succeeded'||receipt.status==='needs_clarification'||receipt.status==='outcome_unknown'||receipt.status==='running'||(receipt.status==='failed'&&!receipt.retryable)))continue;out.push({rule,occurrenceKey:key,scheduledAt:at})}return out}
function putReceipt(s:AutomationState,r:AutomationReceipt):AutomationState{return{...s,receipts:[...s.receipts.filter(x=>x.ruleId!==r.ruleId||x.occurrenceKey!==r.occurrenceKey),r].slice(-MAX_RECEIPTS)}}
export interface EvaluateOptions{storage:AutomationStorage;service:AutomationOperationService;now?:Date;key?:string;pendingCapture?:AutomationCaptureEvent}
/** Persists a running claim before every call and reuses an idempotency key on recovery/retry. */
async function evaluateAutomationRulesNow(o:EvaluateOptions):Promise<{ok:true;state:AutomationState;results:AutomationReceipt[]}|{ok:false;error:string}>{
 const loaded=loadAutomationState(o.storage,o.key);
 if(!loaded.ok)return{ok:false,error:loaded.message};
 const now=o.now??new Date(),results:AutomationReceipt[]=[],active=activeSet(o.storage);
 let state=loaded.state;
 // A running receipt left after process restart is ambiguous, never re-execute it.
 for(const prior of state.receipts.filter(x=>x.status==='running')){
  if(active.has(`${prior.ruleId}/${prior.occurrenceKey}`))continue;
  const unknown:AutomationReceipt={...prior,status:'outcome_unknown',updatedAt:now.toISOString(),message:'The previous attempt ended before its outcome was recorded. Check the operation service receipt before retrying.'};
  state=putReceipt(state,unknown);
  const rule=state.rules.find(x=>x.id===prior.ruleId);
  if(rule&&rule.trigger.kind==='once'){const at=rule.trigger.at;state={...state,rules:state.rules.map(x=>x.id===rule.id?{...x,onceTerminal:{at,status:'outcome_unknown'}}:x)}}
  results.push(unknown);
 }
 let due=dueAutomationOccurrences(state,now);
 if(o.pendingCapture)for(const rule of state.rules)if(rule.enabled&&rule.trigger.kind==='onCapture'&&rule.action.kind==='fileResourcesToCourse'&&o.pendingCapture.resourceKind!=='idea'&&rule.action.resourceKinds.includes(o.pendingCapture.resourceKind)&&o.pendingCapture.name.toLocaleLowerCase().includes(rule.action.queryPattern.toLocaleLowerCase())&&(!rule.action.sourceWorkspaceId||rule.action.sourceWorkspaceId===o.pendingCapture.sourceWorkspaceId)){
  const occurrenceKey=`capture-event:${o.pendingCapture.eventId}`,old=state.receipts.find(x=>x.ruleId===rule.id&&x.occurrenceKey===occurrenceKey);
  if(!old||old.status==='failed'&&old.retryable)due.push({rule,occurrenceKey,scheduledAt:now.toISOString()});
 }
 for(const candidate of due){
  // Reload before each action. An external UI edit during an earlier await may
  // have disabled or replaced this rule; don't execute an obsolete snapshot.
  const latest=loadAutomationState(o.storage,o.key);
  if(!latest.ok)return{ok:false,error:latest.message};
  state=latest.state;
  const currentRule=state.rules.find(x=>x.id===candidate.rule.id);
  if(!currentRule?.enabled||JSON.stringify(currentRule.action)!==JSON.stringify(candidate.rule.action)||JSON.stringify(currentRule.trigger)!==JSON.stringify(candidate.rule.trigger))continue;
  if(currentRule.requiresModeChoice||(currentRule.action.kind==='prepareWorkspaceLayout'&&!currentRule.action.mode))continue;
  if(currentRule.trigger.kind==='onCapture'&&(!o.pendingCapture||o.pendingCapture.resourceKind==='idea'||currentRule.action.kind!=='fileResourcesToCourse'||!currentRule.action.resourceKinds.includes(o.pendingCapture.resourceKind)||!o.pendingCapture.name.toLocaleLowerCase().includes(currentRule.action.queryPattern.toLocaleLowerCase())||(currentRule.action.sourceWorkspaceId&&currentRule.action.sourceWorkspaceId!==o.pendingCapture.sourceWorkspaceId)))continue;
  const prior=state.receipts.find(x=>x.ruleId===currentRule.id&&x.occurrenceKey===candidate.occurrenceKey);
  if(prior&&(prior.status==='succeeded'||prior.status==='needs_clarification'||prior.status==='outcome_unknown'||prior.status==='running'||prior.status==='failed'&&!prior.retryable))continue;
  const activeKey=`${currentRule.id}/${candidate.occurrenceKey}`;
  if(active.has(activeKey))continue;
  const running:AutomationReceipt={version:1,ruleId:currentRule.id,occurrenceKey:candidate.occurrenceKey,scheduledAt:candidate.scheduledAt,status:'running',attempts:(prior?.attempts??0)+1,startedAt:prior?.startedAt??now.toISOString(),updatedAt:now.toISOString()};
  state=putReceipt(state,running);
  try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Could not persist in-flight receipt: ${e instanceof Error?e.message:String(e)}`}}
  active.add(activeKey);
  let outcome:AutomationOperationResult;
  try{outcome=await o.service.execute(currentRule.action as AutomationAction,{ruleId:currentRule.id,occurrenceKey:candidate.occurrenceKey,scheduledAt:candidate.scheduledAt,attempt:running.attempts,idempotencyKey:`${currentRule.id}/${candidate.occurrenceKey}`,...(currentRule.trigger.kind==='onCapture'&&o.pendingCapture?{captureEventId:o.pendingCapture.eventId}:{})})}
  catch(e){outcome={status:'outcome_unknown',message:e instanceof Error?e.message:String(e)}}
  finally{active.delete(activeKey)}
  const receipt:AutomationReceipt={...running,status:outcome.status,updatedAt:(o.now??now).toISOString(),...(outcome.message?{message:outcome.message.slice(0,1000)}:{}),...(outcome.status==='failed'?{retryable:outcome.retryable===true}:{}),...(outcome.status==='succeeded'&&outcome.receiptId?{operationReceiptId:outcome.receiptId}:{})};
  // Merge just this receipt into the latest persisted state. Never write the old
  // pre-await snapshot over rule edits or receipts produced while the op ran.
  const after=loadAutomationState(o.storage,o.key);
  if(!after.ok)return{ok:false,error:`Operation returned ${outcome.status}, but latest state could not be read: ${after.message}`};
  state=putReceipt(after.state,receipt);
  if(currentRule.trigger.kind==='once'&&(outcome.status==='succeeded'||outcome.status==='needs_clarification'||outcome.status==='outcome_unknown')){const at=currentRule.trigger.at;state={...state,rules:state.rules.map(x=>x.id===currentRule.id?{...x,onceTerminal:{at,status:outcome.status as 'succeeded'|'needs_clarification'|'outcome_unknown'}}:x)}}
  try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Operation returned ${outcome.status}, but receipt could not be persisted: ${e instanceof Error?e.message:String(e)}`}}
  results.push(receipt);
 }
 // Any recovery receipts and terminal once watermarks are saved as a merged state.
 const latest=loadAutomationState(o.storage,o.key);
 if(!latest.ok)return{ok:false,error:latest.message};
 state={...latest.state,receipts:[...latest.state.receipts]};
 for(const receipt of results)if(receipt.status==='outcome_unknown'&&!state.receipts.some(x=>x.ruleId===receipt.ruleId&&x.occurrenceKey===receipt.occurrenceKey&&x.status==='outcome_unknown'))state=putReceipt(state,receipt);
 try{saveAutomationState(o.storage,state,o.key)}catch(e){return{ok:false,error:`Could not persist rule receipts: ${e instanceof Error?e.message:String(e)}`}}
 return{ok:true,state,results};
}

/** Serialize evaluations per storage in this JS runtime to avoid stale concurrent tick writes. */
export function evaluateAutomationRules(o:EvaluateOptions):Promise<{ok:true;state:AutomationState;results:AutomationReceipt[]}|{ok:false;error:string}>{
 const storage=o.storage as object,previous=evaluationTails.get(storage)??Promise.resolve();
 const run=previous.then(()=>evaluateAutomationRulesNow(o),()=>evaluateAutomationRulesNow(o));
 evaluationTails.set(storage,run.then(()=>undefined,()=>undefined));
 return run;
}
