import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATION_STORAGE_KEY, createAutomationRule, dueAutomationOccurrences, emptyAutomationState, evaluateAutomationRules, loadAutomationState, parseAutomationRule, saveAutomationState, validateAutomationRuleDraft } from '../src/domain/automationRules.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}
const catalog = {
  workspaces: [{id:'course-ws',name:'Biology'}, {id:'math-ws',name:'Math'}],
  courses: [{id:'biology-course',title:'Biology',workspaceId:'course-ws'}, {id:'biology-2',title:'Biology',workspaceId:'math-ws'}],
  layouts: [{id:'lab-layout',name:'Lab setup',workspaceId:'course-ws'}, {id:'math-layout',name:'Board',workspaceId:'math-ws'}],
};
const rule = (id, trigger, action) => ({version:1,id,enabled:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',sourceText:'test rule',trigger,action});

test('literal filing grammars require a match pattern and resolve one exact course', () => {
  const parsed = parseAutomationRule('When I capture links matching "lecture", file them to Biology course', {catalog, id:'r1'});
  assert.equal(parsed.kind, 'clarification'); // Duplicate course name is an explicit ambiguity.
  assert.match(parsed.message, /multiple courses/i);
  const unique = {...catalog, courses:[catalog.courses[0]]};
  const english = parseAutomationRule('When I capture links matching "lecture", file them to Biology course', {catalog:unique, id:'r2'});
  assert.equal(english.kind, 'rule');
  assert.deepEqual(english.rule.action, {kind:'fileResourcesToCourse',courseId:'biology-course',workspaceId:'course-ws',resourceKinds:['link'],queryPattern:'lecture'});
  assert.equal(english.rule.trigger.kind, 'onCapture');
  const chinese = parseAutomationRule('新增资料匹配“reading”时，整理到Biology课程', {catalog:unique, id:'r3'});
  assert.equal(chinese.kind, 'rule');
  assert.deepEqual(chinese.rule.action.resourceKinds, ['file','link']);
  assert.equal(chinese.rule.action.queryPattern, 'reading');
  assert.equal(parseAutomationRule('When I capture links, file them to Biology', {catalog:unique}).kind, 'unsupported');
});

test('scheduled layout grammar resolves workspace and saved layout or requests clarification', () => {
  const english = parseAutomationRule('Every day at 09:00 prepare Biology workspace using Lab setup layout', {catalog:{...catalog,courses:[catalog.courses[0]]},timeZone:'America/Los_Angeles',id:'sched'});
  assert.equal(english.kind, 'rule');
  assert.deepEqual(english.rule.trigger,{kind:'daily',time:'09:00',timeZone:'America/Los_Angeles'});
  assert.deepEqual(english.rule.action,{kind:'prepareWorkspaceLayout',workspaceId:'course-ws',layoutId:'lab-layout'});
  assert.equal(parseAutomationRule('Every day at 09:00 prepare Missing using Lab setup', {catalog,timeZone:'UTC'}).kind, 'clarification');
  assert.equal(parseAutomationRule('每天 09:00 为Biology工作区使用Lab setup布局', {catalog:{...catalog,courses:[catalog.courses[0]]},timeZone:'UTC'}).kind, 'rule');
});

test('structured/provider drafts reject stale IDs, mismatched course workspaces and missing selectors', () => {
  const base = {sourceText:'tool created',trigger:{kind:'onCapture'},action:{kind:'fileResourcesToCourse',courseId:'biology-course',workspaceId:'course-ws',resourceKinds:['link'],queryPattern:'paper'}};
  assert.equal(validateAutomationRuleDraft(base,catalog).ok,true);
  assert.equal(validateAutomationRuleDraft({...base,action:{...base.action,workspaceId:'math-ws'}},catalog).ok,false);
  assert.equal(validateAutomationRuleDraft({...base,action:{...base.action,queryPattern:' '}},catalog).ok,false);
  assert.equal(createAutomationRule(base,catalog,new Date('2026-01-01T00:00:00.000Z'),'created').ok,true);
});

test('versioned persistence preserves corrupt and unsupported future data without clearing it', () => {
  const storage = new MemoryStorage();
  storage.setItem(AUTOMATION_STORAGE_KEY, '{bad json');
  assert.equal(loadAutomationState(storage).ok,false);
  assert.equal(storage.getItem(AUTOMATION_STORAGE_KEY), '{bad json');
  storage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify({version:9,rules:[],receipts:[]}));
  assert.equal(loadAutomationState(storage).error, 'unsupported-version');
  assert.equal(JSON.parse(storage.getItem(AUTOMATION_STORAGE_KEY)).version, 9);
  saveAutomationState(storage,emptyAutomationState());
  assert.equal(loadAutomationState(storage).ok,true);
});

test('once/daily/weekly schedules fire only due local occurrences and not twice after a success receipt', () => {
  const once = rule('once',{kind:'once',at:'2026-11-26T12:00:00.000Z'},{kind:'prepareWorkspaceLayout',workspaceId:'course-ws',layoutId:'lab-layout'});
  const daily = rule('daily',{kind:'daily',time:'09:00',timeZone:'America/Los_Angeles'},{kind:'prepareWorkspaceLayout',workspaceId:'course-ws',layoutId:'lab-layout'});
  const weekly = rule('weekly',{kind:'weekly',weekdays:[4],time:'09:00',timeZone:'America/Los_Angeles'},{kind:'prepareWorkspaceLayout',workspaceId:'course-ws',layoutId:'lab-layout'});
  const now = new Date('2026-11-26T18:00:00.000Z');
  const state = {version:1,rules:[once,daily,weekly],receipts:[]};
  assert.equal(dueAutomationOccurrences(state,now).length,3); // Thu 10:00 PST, all due.
  const succeeded={version:1,ruleId:'daily',occurrenceKey:'daily:2026-11-26:America/Los_Angeles:09:00',scheduledAt:now.toISOString(),status:'succeeded',attempts:1,startedAt:now.toISOString(),updatedAt:now.toISOString()};
  assert.equal(dueAutomationOccurrences({...state,receipts:[succeeded]},now).some(x=>x.rule.id==='daily'),false);
});

test('capture event identity deduplicates after restart; known safe failures retry while unknown outcomes do not', async () => {
  const storage = new MemoryStorage();
  const action={kind:'fileResourcesToCourse',courseId:'biology-course',workspaceId:'course-ws',resourceKinds:['link'],queryPattern:'lecture'};
  const r=rule('capture',{kind:'onCapture'},action);
  saveAutomationState(storage,{version:1,rules:[r],receipts:[]});
  const calls=[];
  const service={execute:async(a,c)=>{calls.push(c.idempotencyKey);return{status:'succeeded',receiptId:'op-1'}}};
  const first=await evaluateAutomationRules({storage,service,pendingCaptureEventId:'resource-9@2026-11-26T17:00:00Z',now:new Date('2026-11-26T17:00:01Z')});
  const restarted=await evaluateAutomationRules({storage,service,pendingCaptureEventId:'resource-9@2026-11-26T17:00:00Z',now:new Date('2026-11-26T17:05:00Z')});
  assert.equal(first.results[0].status,'succeeded');assert.equal(restarted.results.length,0);assert.equal(calls.length,1);
  const failStorage=new MemoryStorage();saveAutomationState(failStorage,{version:1,rules:[r],receipts:[]});let n=0;
  await evaluateAutomationRules({storage:failStorage,pendingCaptureEventId:'event-retry',service:{execute:async()=>{n++;return{status:'failed',message:'precondition not met',retryable:true}}}});
  await evaluateAutomationRules({storage:failStorage,pendingCaptureEventId:'event-retry',service:{execute:async()=>{n++;return{status:'succeeded'}}}});
  assert.equal(n,2);assert.equal(loadAutomationState(failStorage).state.receipts[0].attempts,2);
  const unknownStorage=new MemoryStorage();saveAutomationState(unknownStorage,{version:1,rules:[r],receipts:[]});
  await evaluateAutomationRules({storage:unknownStorage,pendingCaptureEventId:'event-unknown',service:{execute:async()=>{throw new Error('connection lost')}}});
  const retry=await evaluateAutomationRules({storage:unknownStorage,pendingCaptureEventId:'event-unknown',service:{execute:async()=>{throw new Error('must not be called')}}});
  assert.equal(retry.results.length,0);assert.equal(loadAutomationState(unknownStorage).state.receipts[0].status,'outcome_unknown');
});

test('concurrent scheduler ticks use the persisted running receipt as a local claim', async () => {
  const storage=new MemoryStorage();const r=rule('daily',{kind:'daily',time:'09:00',timeZone:'UTC'},{kind:'prepareWorkspaceLayout',workspaceId:'course-ws',layoutId:'lab-layout'});saveAutomationState(storage,{version:1,rules:[r],receipts:[]});let calls=0,release;
  const service={execute:async()=>{calls++;await new Promise(resolve=>release=resolve);return{status:'succeeded'}}};
  const tick1=evaluateAutomationRules({storage,service,now:new Date('2026-11-26T10:00:00Z')});
  const tick2=await evaluateAutomationRules({storage,service,now:new Date('2026-11-26T10:00:01Z')});
  assert.equal(tick2.results.length,0);assert.equal(calls,1);release();await tick1;
});
