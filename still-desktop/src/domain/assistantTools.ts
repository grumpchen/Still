import type { AgentToolExecution, AgentToolHandler } from './agentLoop.ts';
import type { AssistantAction, AssistantTrayItem, AssistantWorkspaceChoice } from './assistant.ts';
import type { Workspace } from './workspaces.ts';
import { addAssistantMemory, ASSISTANT_MEMORY_TEXT_LIMIT, AssistantMemoryError, type AssistantMemoryEntry } from './assistantMemory.ts';
import { workspaceWidgetTypes, type WidgetType } from './widgetCatalog.ts';
import { constrainPlacement } from './layout.ts';

/** A fresh, app-owned view of the state that existing UI operations validate against. */
export type DisplayPreferences = { theme: 'light' | 'dark'; density: 'comfortable' | 'compact'; background: 'solid' | 'dots' | 'transparent'; appearance: 'minimal' | 'liquid-glass' };

export type StillToolSnapshot = {
  revision: string;
  workspace: Workspace;
  savedTrayItems: AssistantTrayItem[];
  workspaces: AssistantWorkspaceChoice[];
  /** Reversible display preferences exposed to reviewed agent actions. */
  preferences: DisplayPreferences;
  canvasSize?: { width: number; height: number };
};

export type StillWorkspaceInspection = {
  revision: string;
  activeWorkspace: { id: string; name: string; fixedWidgets: boolean };
  preferences: DisplayPreferences;
  canvasSize?: { width: number; height: number };
  workspaces: AssistantWorkspaceChoice[];
  savedItems: AssistantTrayItem[];
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    minimized: boolean;
    placement: { x: number; y: number; width: number; height: number };
    tagColor: string | null;
    plugins: { clockTimer: boolean; lockEnabled: boolean; locked: boolean };
    openNoteTitles?: string[];
    schedule?: Array<{ id: string; title: string; day: number; time: string }>;
  }>;
};

/** An approval to add one widget from Still’s built-in catalog. */
export type AddWidgetProposal = {
  kind: 'add_widget';
  snapshotRevision: string;
  actions: readonly [{ readonly type: 'add_widget'; readonly ids: readonly [WidgetType] }];
  widgetType: WidgetType;
};
export type AddNotesWidgetProposal = AddWidgetProposal;

export type SafeWorkspaceAction =
  | { type: 'minimize' | 'restore'; ids: string[] }
  | { type: 'set_timer'; ids: [string]; seconds: number }
  | { type: 'control_timer'; ids: [string]; operation: 'pause' | 'resume' | 'reset' }
  | { type: 'set_ui_visibility'; ids: ['sidebar' | 'apps-bar']; enabled: boolean }
  | { type: 'set_widget_plugin'; ids: string[]; plugin: 'clock-timer'; enabled: boolean }
  | { type: 'set_widget_plugin'; ids: string[]; plugin: 'lock'; enabled: boolean; locked?: boolean }
  | { type: 'set_sidebar_plugin'; ids: ['stack' | 'layout']; enabled: boolean }
  | { type: 'set_setting'; ids: ['theme']; settingValue: 'light' | 'dark' }
  | { type: 'set_setting'; ids: ['density']; settingValue: 'comfortable' | 'compact' }
  | { type: 'set_setting'; ids: ['background']; settingValue: 'solid' | 'dots' | 'transparent' }
  | { type: 'set_setting'; ids: ['appearance']; settingValue: 'minimal' | 'liquid-glass' }
  | { type: 'set_widget_geometry'; ids: [string]; operation: 'move'; x: number; y: number }
  | { type: 'set_widget_geometry'; ids: [string]; operation: 'resize'; width: number; height: number }
  | { type: 'create_note_document'; ids: [string]; title: string; text?: string };

/** Geometry requests require one explicit UI selection and literal target numbers in the original prompt. */
export function validateReviewedGeometryIntent(prompt: string, action: SafeWorkspaceAction, selectedWidgetIds: string[]): void {
  if (action.type !== 'set_widget_geometry') return;
  if (selectedWidgetIds.length !== 1 || selectedWidgetIds[0] !== action.ids[0]) throw new Error('Select exactly one widget with @ before asking for a geometry change. Nothing was changed.');
  const number = (key: string) => prompt.match(new RegExp(`\\b${key}\\s*(?:=|:|to)?\\s*(\\d+)\\b`, 'i'))?.[1];
  if (action.operation === 'move') {
    if (!/\bmove\b/i.test(prompt) || Number(number('x')) !== action.x || Number(number('y')) !== action.y) throw new Error('A move proposal must match an explicit request with x and y coordinates. Nothing was changed.');
  } else if (!/\bresize\b/i.test(prompt) || Number(number('width')) !== action.width || Number(number('height')) !== action.height) {
    throw new Error('A resize proposal must match an explicit request with width and height. Nothing was changed.');
  }
}

export type SafeWorkspaceActionProposal = {
  kind: 'workspace_action';
  snapshotRevision: string;
  action: Readonly<SafeWorkspaceAction>;
  preferenceChange?: Readonly<{ key: 'theme'|'density'|'background'|'appearance'; before: string; after: string }>;
  geometryChange?: Readonly<{ widgetId: string; operation: 'move'|'resize'; before: {x:number;y:number;width:number;height:number}; after: {x:number;y:number;width:number;height:number} }>;
};

/** User-reviewed durable memory. This is local user data, never a model authorization token. */
export type AssistantMemoryProposal = { kind: 'assistant_memory'; text: string };

export type StillWorkspaceToolDependencies = {
  getSnapshot: () => StillToolSnapshot | Promise<StillToolSnapshot>;
  /** Must delegate to Still's existing whole-action validator, including target and domain checks. */
  validate: (snapshot: StillToolSnapshot, actions: AssistantAction[]) => void | Promise<void>;
  /** Must use the UI-owned original prompt and selection, never model-supplied intent. */
  validateIntent: (snapshot: StillToolSnapshot, actions: AssistantAction[]) => void | Promise<void>;
  /** Must delegate to the same app operation used by the existing UI and return its actual receipt. */
  execute: (snapshot: StillToolSnapshot, actions: AssistantAction[]) => string | Promise<string>;
  /** Must validate the exact original user request, never the model's account of its intent. */
  validateMemoryIntent?: (normalizedText: string) => void | Promise<void>;
  /** Separate opt-in: disabled unless the current user explicitly activates the memory tool path. */
  enableAssistantMemoryTool?: boolean;
  /** Tests may inject storage; omitted storage uses the existing localStorage implementation. */
  memoryStorage?: Pick<Storage, 'getItem' | 'setItem'>;
};

export type StillWorkspaceToolRegistry = {
  tools: Readonly<Record<string, AgentToolHandler>>;
  /** Only call from the explicit UI approval action using the exact proposal object. */
  executeConfirmed: (proposal: AddWidgetProposal) => Promise<AgentToolExecution>;
  executeConfirmedAction: (proposal: SafeWorkspaceActionProposal) => Promise<AgentToolExecution>;
  executeConfirmedMemory: (proposal: AssistantMemoryProposal) => Promise<AgentToolExecution>;
};

/**
 * Create workspace inspection and reviewed tools that use the app’s validated actions.
 * The model can prepare a proposal but cannot authorize or execute it. Inspection
 * excludes note bodies and local paths; execution rechecks exact state and uses
 * the app's injected validator and executor.
 */
export function createStillWorkspaceToolRegistry(deps: StillWorkspaceToolDependencies): StillWorkspaceToolRegistry {
  const pending = new WeakSet<object>(), pendingWorkspaceActions = new WeakSet<object>(), pendingMemories = new WeakSet<object>();
  const proposeAssistantMemory: AgentToolHandler = async input => {
    if (!deps.validateMemoryIntent) return failed('Saving assistant memory is unavailable for this request.');
    let text: string;
    try { text = parseAssistantMemoryInput(input); await deps.validateMemoryIntent(text); }
    catch (error) { return failed(message(error)); }
    const proposal = Object.freeze({kind:'assistant_memory' as const,text});
    pendingMemories.add(proposal);
    return {status:'requires_confirmation',proposal};
  };
  const tools: Readonly<Record<string, AgentToolHandler>> = Object.freeze({
    inspect_workspace: async input => {
      if (!emptyObject(input)) return failed('inspect_workspace takes no arguments.');
      try {
        return { status: 'succeeded', mutation: 'none', result: inspect(await deps.getSnapshot()) };
      } catch (error) {
        return failed(message(error), 'unknown');
      }
    },
    add_widget: async input => {
      let parsed: { revision: string; widgetType: WidgetType };
      try { parsed = parseAddWidgetInput(input); }
      catch (error) { return failed(message(error)); }
      try {
        const before = await deps.getSnapshot();
        if (before.revision !== parsed.revision) return failed('Workspace state changed. Refresh the workspace inspection and try again.');
        const widgetType = parsed.widgetType;
        const actions: AssistantAction[] = [{ type: 'add_widget', ids: [widgetType] }];
        try { await deps.validate(before, actions); }
        catch (error) { return failed(message(error)); }
        const current = await deps.getSnapshot();
        if (current.revision !== before.revision) return failed('Workspace state changed before the proposal could be reviewed. Refresh and try again.');
        const proposal = Object.freeze({
          kind: 'add_widget' as const,
          snapshotRevision: before.revision,
          widgetType,
          actions: Object.freeze([Object.freeze({ type: 'add_widget' as const, ids: Object.freeze([widgetType] as const) })]) as AddWidgetProposal['actions'],
        });
        pending.add(proposal);
        return { status: 'requires_confirmation', proposal };
      } catch (error) {
        return failed(message(error), 'unknown');
      }
    },
    propose_workspace_action: async input => {
      let parsed: { revision: string; action: SafeWorkspaceAction };
      try { parsed = parseSafeWorkspaceAction(input); }
      catch (error) { return failed(message(error)); }
      try {
        const before = await deps.getSnapshot();
        if (before.revision !== parsed.revision) return failed('Workspace state changed. Refresh the workspace inspection and try again.');
        const actions: AssistantAction[] = [parsed.action];
        try { await deps.validate(before, actions); await deps.validateIntent(before, actions); }
        catch (error) { return failed(message(error)); }
        const current = await deps.getSnapshot();
        if (current.revision !== before.revision) return failed('Workspace state changed before the proposal could be reviewed. Refresh and try again.');
        const preferenceChange = parsed.action.type==='set_setting'
          ? Object.freeze({key:parsed.action.ids[0],before:before.preferences[parsed.action.ids[0]],after:parsed.action.settingValue}) : undefined;
        const geometryTarget = parsed.action.type==='set_widget_geometry' ? before.workspace.widgets.find(widget=>widget.id===parsed.action.ids[0]) : undefined;
        const geometryChange = geometryTarget && parsed.action.type==='set_widget_geometry' ? Object.freeze({widgetId:geometryTarget.id,operation:parsed.action.operation,before:Object.freeze({...geometryTarget.placement}),after:Object.freeze(constrainPlacement(geometryTarget.type,parsed.action.operation==='move'?{...geometryTarget.placement,x:parsed.action.x,y:parsed.action.y}:{...geometryTarget.placement,width:parsed.action.width,height:parsed.action.height},before.canvasSize?.width??3000,{},before.canvasSize?.height??3000))}) : undefined;
        if(geometryChange && parsed.action.type==='set_widget_geometry' && (parsed.action.operation==='move'&&(geometryChange.after.x!==parsed.action.x||geometryChange.after.y!==parsed.action.y)||parsed.action.operation==='resize'&&(geometryChange.after.width!==parsed.action.width||geometryChange.after.height!==parsed.action.height)))return failed('Those geometry values exceed the active canvas or widget limits. Nothing was changed. Choose values that fit the current workspace.');
        const proposal = Object.freeze({kind:'workspace_action' as const,snapshotRevision:before.revision,action:freezeSafeAction(parsed.action),...(preferenceChange?{preferenceChange}:{}),...(geometryChange?{geometryChange}:{})});
        pendingWorkspaceActions.add(proposal);
        return {status:'requires_confirmation',proposal};
      } catch (error) {
        return failed(message(error), 'unknown');
      }
    },
    ...(deps.enableAssistantMemoryTool ? {propose_assistant_memory:proposeAssistantMemory} : {}),
  });

  return {
    tools,
    executeConfirmed: async proposal => {
      if (!proposal || typeof proposal !== 'object' || !pending.has(proposal)) {
        return failed('This proposal is no longer available for approval. Nothing was changed.');
      }
      pending.delete(proposal);
      const actions: AssistantAction[] = [{ type: 'add_widget', ids: [proposal.widgetType] }];
      try {
        const before = await deps.getSnapshot();
        if (before.revision !== proposal.snapshotRevision) return failed('Workspace state changed while you reviewed the proposal. Nothing was changed. Refresh and try again.');
        try { await deps.validate(before, actions); }
        catch (error) { return failed(message(error)); }
        const current = await deps.getSnapshot();
        if (current.revision !== before.revision) return failed('Workspace state changed before the action could run. Nothing was changed. Refresh and try again.');
        let receipt: string;
        try { receipt = await deps.execute(current, actions); }
        catch (error) { return failed(message(error), 'unknown'); }
        if (typeof receipt !== 'string' || !receipt.trim()) {
          return failed('Still did not return a receipt for this action. Check the workspace before trying again.', 'unknown');
        }
        return { status: 'succeeded', mutation: 'applied', result: { receipt } };
      } catch (error) {
        return failed(message(error), 'unknown');
      }
    },
    executeConfirmedAction: async proposal => {
      if (!proposal || typeof proposal !== 'object' || !pendingWorkspaceActions.has(proposal)) return failed('This proposal is no longer available for approval. Nothing was changed.');
      pendingWorkspaceActions.delete(proposal);
      const actions: AssistantAction[] = [cloneSafeAction(proposal.action)];
      try {
        const before = await deps.getSnapshot();
        if (before.revision !== proposal.snapshotRevision) return failed('Workspace state changed while you reviewed the proposal. Nothing was changed. Refresh and try again.');
        try { await deps.validate(before, actions); await deps.validateIntent(before, actions); }
        catch (error) { return failed(message(error)); }
        const current = await deps.getSnapshot();
        if (current.revision !== before.revision) return failed('Workspace state changed before the action could run. Nothing was changed. Refresh and try again.');
        let receipt: string;
        try { receipt = await deps.execute(current, actions); }
        catch (error) { return failed(message(error), 'unknown'); }
        if (typeof receipt !== 'string' || !receipt.trim()) return failed('Still did not return a receipt for this action. Check the workspace before trying again.', 'unknown');
        return {status:'succeeded',mutation:'applied',result:{receipt}};
      } catch (error) {
        return failed(message(error), 'unknown');
      }
    },
    executeConfirmedMemory: async proposal => {
      if (!proposal || typeof proposal !== 'object' || !pendingMemories.has(proposal)) return failed('This memory proposal is no longer available for approval. Nothing was saved.');
      pendingMemories.delete(proposal);
      if (!deps.validateMemoryIntent) return failed('Saving assistant memory is unavailable for this request.');
      try {
        const text = parseAssistantMemoryInput({text:proposal.text});
        await deps.validateMemoryIntent(text);
        const entry = addAssistantMemory(text, deps.memoryStorage);
        return {status:'succeeded',mutation:'applied',result:{receipt:'Saved this item to local assistant memory.',entry}};
      } catch (error) {
        const code = error instanceof AssistantMemoryError ? error.code : undefined;
        const mutation = code === 'write_failed' ? 'unknown' : 'none';
        return failed(memoryErrorMessage(error), mutation);
      }
    },
  };
}

function parseAssistantMemoryInput(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected one assistant memory proposal.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || typeof value.text !== 'string') throw new Error('Provide only the memory text.');
  const text = value.text.trim().replace(/\s+/g,' ');
  if (!text || text.length > ASSISTANT_MEMORY_TEXT_LIMIT || /\p{Cc}/u.test(text)) throw new Error(`Memory text must be 1 to ${ASSISTANT_MEMORY_TEXT_LIMIT} characters without control characters.`);
  return text;
}

function memoryErrorMessage(error: unknown): string {
  if (!(error instanceof AssistantMemoryError)) return message(error);
  switch (error.code) {
    case 'limit': return 'Local assistant memory is full. Delete an entry before saving another.';
    case 'too_long': return `Memory text must be no more than ${ASSISTANT_MEMORY_TEXT_LIMIT} characters.`;
    case 'duplicate': return 'This memory entry already exists.';
    case 'write_failed': return 'Still could not confirm whether the memory was saved. Check local assistant memory before retrying.';
    case 'unavailable': case 'read_failed': case 'invalid_data': case 'invalid_entry': return 'Local assistant memory is unavailable or needs attention. Nothing was saved.';
  }
}

function inspect(snapshot: StillToolSnapshot): StillWorkspaceInspection {
  const widgets = snapshot.workspace.widgets.map(widget => ({
    id: widget.id,
    type: widget.type,
    title: widget.title || `${widget.type} ${widget.instanceNumber}`,
    minimized: widget.minimized,
    placement: { ...widget.placement },
    tagColor: widget.tagColor ?? null,
    plugins: { clockTimer: widget.clockPluginEnabled, lockEnabled: widget.lockPluginEnabled, locked: widget.locked },
    ...(widget.type === 'notes' ? { openNoteTitles: widget.noteDocuments.map(document => document.title) } : {}),
    ...(widget.type === 'timetable' ? { schedule: widget.schedule.slice(0, 80).map(entry => ({
      id: entry.id, title: entry.title, day: entry.day, time: entry.time,
    })) } : {}),
  }));
  return {
    revision: snapshot.revision,
    activeWorkspace: { id: snapshot.workspace.id, name: snapshot.workspace.name, fixedWidgets: snapshot.workspace.role==='dashboard'||snapshot.workspace.role==='library' },
    preferences: snapshot.preferences,
    ...(snapshot.canvasSize ? { canvasSize: snapshot.canvasSize } : {}),
    workspaces: snapshot.workspaces.map(({ id, name }) => ({ id, name })),
    savedItems: snapshot.savedTrayItems.map(({ id, name, type, kind }) => ({ id, name, type, kind })),
    widgets,
  };
}

function emptyObject(input: unknown): boolean {
  return !!input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0;
}

function parseSafeWorkspaceAction(input: unknown): { revision: string; action: SafeWorkspaceAction } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a workspace action proposal.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'snapshotRevision' && key !== 'action')
    || typeof value.snapshotRevision !== 'string' || !value.snapshotRevision || value.snapshotRevision.length > 256
    || !value.action || typeof value.action !== 'object' || Array.isArray(value.action)) {
    throw new Error('A workspace revision and one supported action are required.');
  }
  const raw = value.action as Record<string, unknown>;
  const type = raw.type;
  if (typeof type !== 'string') throw new Error('Choose one supported workspace action.');
  const ids = raw.ids;
  const validWidgetId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
  const keys = Object.keys(raw);
  const onlyKeys = (...allowed: string[]) => keys.every(key => allowed.includes(key));
  if (type === 'minimize' || type === 'restore') {
    if (!onlyKeys('type','ids') || !Array.isArray(ids) || ids.length < 1 || ids.length > 100
      || ids.some(id => !validWidgetId(id)) || new Set(ids).size !== ids.length) throw new Error('Choose one or more current widgets to minimize or restore.');
    return {revision:value.snapshotRevision,action:{type,ids:[...ids]}};
  }
  if (type === 'set_timer') {
    if (!onlyKeys('type','ids','seconds') || !Array.isArray(ids) || ids.length !== 1 || !validWidgetId(ids[0])
      || !Number.isSafeInteger(raw.seconds) || (raw.seconds as number) < 1 || (raw.seconds as number) > 31536000) throw new Error('Choose one timer widget and a duration from one second to one year.');
    return {revision:value.snapshotRevision,action:{type,ids:[ids[0]],seconds:raw.seconds as number}};
  }
  if (type === 'control_timer') {
    if (!onlyKeys('type','ids','operation') || !Array.isArray(ids) || ids.length !== 1 || !validWidgetId(ids[0])
      || !['pause','resume','reset'].includes(String(raw.operation))) throw new Error('Choose one timer and pause, resume, or reset it.');
    return {revision:value.snapshotRevision,action:{type,ids:[ids[0]],operation:raw.operation as 'pause'|'resume'|'reset'}};
  }
  if (type === 'set_ui_visibility') {
    if (!onlyKeys('type','ids','enabled') || !Array.isArray(ids) || ids.length !== 1
      || !['sidebar','apps-bar'].includes(String(ids[0])) || typeof raw.enabled !== 'boolean') throw new Error('Choose the Still sidebar or Apps bar and set its visibility.');
    return {revision:value.snapshotRevision,action:{type,ids:[ids[0] as 'sidebar'|'apps-bar'],enabled:raw.enabled}};
  }
  if (type === 'set_sidebar_plugin') {
    if(!onlyKeys('type','ids','enabled')||!Array.isArray(ids)||ids.length!==1||!['stack','layout'].includes(String(ids[0]))||typeof raw.enabled!=='boolean')throw new Error('Choose one supported sidebar plugin and turn it on or off.');
    return {revision:value.snapshotRevision,action:{type,ids:[ids[0] as 'stack'|'layout'],enabled:raw.enabled}};
  }
  if (type === 'set_widget_plugin') {
    if(!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>!validWidgetId(id))||typeof raw.enabled!=='boolean')throw new Error('Choose valid widgets and turn one supported plugin on or off.');
    if(raw.plugin==='clock-timer'&&onlyKeys('type','ids','plugin','enabled'))return {revision:value.snapshotRevision,action:{type,ids:ids as string[],plugin:'clock-timer',enabled:raw.enabled}};
    if(raw.plugin==='lock'&&onlyKeys('type','ids','plugin','enabled')&&!raw.enabled)return {revision:value.snapshotRevision,action:{type,ids:ids as string[],plugin:'lock',enabled:false}};
    if(raw.plugin==='lock'&&onlyKeys('type','ids','plugin','enabled','locked')&&raw.enabled&&typeof raw.locked==='boolean')return {revision:value.snapshotRevision,action:{type,ids:ids as string[],plugin:'lock',enabled:true,locked:raw.locked}};
    throw new Error('Choose a supported widget plugin and a valid lock state.');
  }
  if (type === 'set_setting') {
    if (!onlyKeys('type','ids','settingValue') || !Array.isArray(ids) || ids.length !== 1 || typeof ids[0]!=='string'
      || typeof raw.settingValue!=='string') throw new Error('Choose a supported reversible display setting and one of its listed values.');
    const key=ids[0], settingValue=raw.settingValue;
    if(key==='theme'&&['light','dark'].includes(settingValue))return {revision:value.snapshotRevision,action:{type,ids:[key],settingValue:settingValue as 'light'|'dark'}};
    if(key==='density'&&['comfortable','compact'].includes(settingValue))return {revision:value.snapshotRevision,action:{type,ids:[key],settingValue:settingValue as 'comfortable'|'compact'}};
    if(key==='background'&&['solid','dots','transparent'].includes(settingValue))return {revision:value.snapshotRevision,action:{type,ids:[key],settingValue:settingValue as 'solid'|'dots'|'transparent'}};
    if(key==='appearance'&&['minimal','liquid-glass'].includes(settingValue))return {revision:value.snapshotRevision,action:{type,ids:[key],settingValue:settingValue as 'minimal'|'liquid-glass'}};
    throw new Error('Choose a supported reversible display setting and one of its listed values.');
  }
  if (type === 'set_widget_geometry') {
    if (raw.operation === 'move' && onlyKeys('type','ids','operation','x','y') && Array.isArray(ids) && ids.length===1 && validWidgetId(ids[0])
      && Number.isSafeInteger(raw.x) && Number.isSafeInteger(raw.y) && (raw.x as number)>=0 && (raw.x as number)<=20000 && (raw.y as number)>=0 && (raw.y as number)<=20000) {
      return {revision:value.snapshotRevision,action:{type,ids:[ids[0]],operation:'move',x:raw.x as number,y:raw.y as number}};
    }
    if (raw.operation === 'resize' && onlyKeys('type','ids','operation','width','height') && Array.isArray(ids) && ids.length===1 && validWidgetId(ids[0])
      && Number.isSafeInteger(raw.width) && Number.isSafeInteger(raw.height) && (raw.width as number)>=120 && (raw.width as number)<=3000 && (raw.height as number)>=100 && (raw.height as number)<=3000) {
      return {revision:value.snapshotRevision,action:{type,ids:[ids[0]],operation:'resize',width:raw.width as number,height:raw.height as number}};
    }
    throw new Error('Choose one selected regular widget and explicit move coordinates or resize dimensions within supported limits.');
  }
  if (type === 'create_note_document') {
    if (!onlyKeys('type','ids','title','text') || !Array.isArray(ids) || ids.length !== 1 || !validWidgetId(ids[0])
      || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 60
      || !Object.hasOwn(raw, 'text')
      || raw.text !== null && (typeof raw.text !== 'string' || raw.text.length > 12000)) throw new Error('Choose one Notes widget, a title up to 60 characters, and note text or null up to 12,000 characters.');
    return {revision:value.snapshotRevision,action:{type,ids:[ids[0]],title:raw.title.trim(),...(typeof raw.text === 'string' ? {text:raw.text} : {})}};
  }
  throw new Error('This action is not available to the agent tool.');
}

function freezeSafeAction(action: SafeWorkspaceAction): Readonly<SafeWorkspaceAction> {
  return Object.freeze({...action,ids:Object.freeze([...action.ids])}) as Readonly<SafeWorkspaceAction>;
}

function cloneSafeAction(action: Readonly<SafeWorkspaceAction>): SafeWorkspaceAction {
  return {...action,ids:[...action.ids]} as SafeWorkspaceAction;
}

function parseAddWidgetInput(input: unknown): { revision: string; widgetType: WidgetType } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an add Notes widget request.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'widgetType' && key !== 'snapshotRevision')
    || typeof value.widgetType !== 'string' || !workspaceWidgetTypes.includes(value.widgetType as WidgetType)
    || typeof value.snapshotRevision !== 'string'
    || !value.snapshotRevision
    || value.snapshotRevision.length > 256) {
    throw new Error('Choose one supported widget type using a revision from the latest workspace inspection.');
  }
  return { revision: value.snapshotRevision, widgetType: value.widgetType as WidgetType };
}

function failed(error: string, mutation: 'none' | 'unknown' = 'none'): AgentToolExecution {
  return { status: 'failed', mutation, error };
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
