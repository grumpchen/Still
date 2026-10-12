export interface Shortcut { key: string; ctrl: boolean; alt: boolean; shift: boolean }
export interface WorkspaceShortcuts {
  up: Shortcut; down: Shortcut; overview: Shortcut; clickThrough: Shortcut;
  commandPalette: Shortcut; undo: Shortcut; numbered: Shortcut[];
  minimizeModifiers:{ctrl:boolean;alt:boolean;shift:boolean};
}
export type WorkspaceDirection = 'up' | 'down';
export type AppShortcutAction = 'up'|'down'|'overview'|'clickThrough'|'commandPalette'|'undo'|`workspace:${number}`;
export interface ShortcutKeyEvent {
  key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean;
  isComposing?: boolean; getModifierState?: (key: string) => boolean;
}
const binding=(key:string,ctrl:boolean,alt=false,shift=false):Shortcut=>({key,ctrl,alt,shift});
export const defaultShortcuts = (): WorkspaceShortcuts => ({
  up: binding('W',false,true), down: binding('S',false,true),
  overview: binding('M',true), clickThrough: binding('P',true,false,true),
  commandPalette: binding('K',true), undo: binding('Z',true),
  numbered: Array.from({length:9},(_,index)=>binding(String(index+1),true)),
  minimizeModifiers:{ctrl:true,alt:false,shift:true},
});
const specialKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'];
function normalizedKey(key: string): string { return /^[a-z0-9]$/i.test(key)?key.toUpperCase():key }
export function shortcutLabel(shortcut: Shortcut): string {
  const key = ({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',PageUp:'Page Up',PageDown:'Page Down'} as Record<string,string>)[shortcut.key]??shortcut.key;
  return [...(shortcut.ctrl?['Ctrl']:[]),...(shortcut.alt?['Alt']:[]),...(shortcut.shift?['Shift']:[]),key].join(' + ');
}
const sameShortcut=(a:Shortcut,b:Shortcut)=>a.key===b.key&&a.ctrl===b.ctrl&&a.alt===b.alt&&a.shift===b.shift;
function keyError(shortcut:Shortcut):string{
  if(!shortcut||typeof shortcut!=='object'||typeof shortcut.key!=='string'||![shortcut.ctrl,shortcut.alt,shortcut.shift].every(value=>typeof value==='boolean'))return 'Choose a valid key combination.';
  if(!shortcut.ctrl&&!shortcut.alt&&!shortcut.shift)return 'Include Alt, Ctrl or Shift with a letter, number, or navigation key.';
  if(!/^[A-Z0-9]$/.test(shortcut.key)&&!specialKeys.includes(shortcut.key))return 'Use a letter, number, arrow, Home, End, Page Up, or Page Down.';
  if(shortcut.ctrl&&!shortcut.alt&&!shortcut.shift&&'ACF LNPRSTUVWXY'.replaceAll(' ','').includes(shortcut.key))return 'That shortcut is reserved for editing, browsing, or the operating system.';
  if(shortcut.alt&&!shortcut.ctrl&&!shortcut.shift&&['ArrowLeft','ArrowRight','D'].includes(shortcut.key))return 'That shortcut is reserved for browser navigation.';
  return '';
}
export function shortcutError(shortcut: Shortcut): string { return keyError(shortcut); }
export function shortcutsError(shortcuts: WorkspaceShortcuts): string {
  const all=[shortcuts.up,shortcuts.down,shortcuts.overview,shortcuts.clickThrough,shortcuts.commandPalette,shortcuts.undo,...(Array.isArray(shortcuts.numbered)?shortcuts.numbered:[])];
  for(const item of all){const error=keyError(item);if(error)return error}
  if(shortcuts.numbered.length!==9)return 'Keep one shortcut for each workspace number from 1 to 9.';
  if(new Set(all.map(item=>`${item.key}|${item.ctrl}|${item.alt}|${item.shift}`)).size!==all.length)return 'Each action needs a different shortcut.';
  return '';
}
export function shortcutFromEvent(event: ShortcutKeyEvent): Shortcut | null {
  if(event.isComposing||event.metaKey||event.getModifierState?.('AltGraph'))return null;
  if(['Alt','Control','Shift','Meta'].includes(event.key))return null;
  return {key:normalizedKey(event.key),ctrl:event.ctrlKey,alt:event.altKey,shift:event.shiftKey};
}
export function shortcutAction(event:ShortcutKeyEvent,shortcuts:WorkspaceShortcuts,editing=false):AppShortcutAction|null{
  const captured=shortcutFromEvent(event);if(!captured)return null;
  if(editing&&captured.shift&&!captured.ctrl&&!captured.alt)return null;
  for(const action of ['up','down','overview','clickThrough','commandPalette','undo'] as const)if(sameShortcut(captured,shortcuts[action]))return action;
  const index=shortcuts.numbered.findIndex(item=>sameShortcut(captured,item));return index<0?null:`workspace:${index+1}`;
}
export function shortcutDirection(event: ShortcutKeyEvent,shortcuts: WorkspaceShortcuts,editing=false): WorkspaceDirection | null {
  const action=shortcutAction(event,shortcuts,editing);return action==='up'||action==='down'?action:null;
}
export function parseShortcuts(value: unknown): WorkspaceShortcuts {
  const defaults=defaultShortcuts();
  if(!value||typeof value!=='object')return defaults;
  const candidate=value as Partial<WorkspaceShortcuts>;
  const checked=(binding: unknown): binding is Shortcut=>!!binding&&typeof binding==='object'&&typeof (binding as Shortcut).key==='string'&&[ (binding as Shortcut).ctrl,(binding as Shortcut).alt,(binding as Shortcut).shift].every(v=>typeof v==='boolean')&&!keyError(binding as Shortcut);
  // Migrate the original two workspace bindings and fill the newer actions with defaults.
  const parsed:WorkspaceShortcuts={...defaults,up:checked(candidate.up)?candidate.up:defaults.up,down:checked(candidate.down)?candidate.down:defaults.down,
    overview:checked(candidate.overview)?candidate.overview:defaults.overview,clickThrough:checked(candidate.clickThrough)?candidate.clickThrough:defaults.clickThrough,
    commandPalette:checked(candidate.commandPalette)?candidate.commandPalette:defaults.commandPalette,undo:checked(candidate.undo)?candidate.undo:defaults.undo,
    numbered:Array.isArray(candidate.numbered)&&candidate.numbered.length===9&&candidate.numbered.every(checked)?candidate.numbered:defaults.numbered,
    minimizeModifiers:candidate.minimizeModifiers&&typeof candidate.minimizeModifiers==='object'&&[candidate.minimizeModifiers.ctrl,candidate.minimizeModifiers.alt,candidate.minimizeModifiers.shift].every(value=>typeof value==='boolean')&&(candidate.minimizeModifiers.ctrl||candidate.minimizeModifiers.alt||candidate.minimizeModifiers.shift)?candidate.minimizeModifiers:defaults.minimizeModifiers};
  return shortcutsError(parsed)?defaults:parsed;
}
export function adjacentWorkspaceId(workspaces: ReadonlyArray<{id:string}>,activeId: string,direction: WorkspaceDirection): string {
  if(!workspaces.length)return activeId;
  const current=Math.max(0,workspaces.findIndex(w=>w.id===activeId));
  return workspaces[(current+(direction==='up'?-1:1)+workspaces.length)%workspaces.length].id;
}
