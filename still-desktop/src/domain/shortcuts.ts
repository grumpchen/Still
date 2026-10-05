export interface Shortcut { key: string; ctrl: boolean; alt: boolean; shift: boolean }
export interface WorkspaceShortcuts { up: Shortcut; down: Shortcut }
export type WorkspaceDirection = 'up' | 'down';
export interface ShortcutKeyEvent {
  key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean;
  isComposing?: boolean; getModifierState?: (key: string) => boolean;
}
export const defaultShortcuts = (): WorkspaceShortcuts => ({
  up: {key:'W',ctrl:false,alt:true,shift:false},
  down: {key:'S',ctrl:false,alt:true,shift:false},
});
const specialKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'];
function normalizedKey(key: string): string { return /^[a-z0-9]$/i.test(key)?key.toUpperCase():key }
export function shortcutLabel(shortcut: Shortcut): string {
  const key = ({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',PageUp:'Page Up',PageDown:'Page Down'} as Record<string,string>)[shortcut.key]??shortcut.key;
  return [...(shortcut.ctrl?['Ctrl']:[]),...(shortcut.alt?['Alt']:[]),...(shortcut.shift?['Shift']:[]),key].join(' + ');
}
export function shortcutError(shortcut: Shortcut): string {
  if (!shortcut.ctrl&&!shortcut.alt&&!shortcut.shift) return 'Include Alt, Ctrl or Shift with a letter, number, or navigation key.';
  if (!/^[A-Z0-9]$/.test(shortcut.key)&&!specialKeys.includes(shortcut.key)) return 'Use a letter, number, arrow, Home, End, Page Up, or Page Down.';
  // Preserve text editing, browser navigation, and the existing command palette.
  if (shortcut.ctrl&&!shortcut.alt&&!shortcut.shift&&(/^[1-9]$/.test(shortcut.key)||'ACF KLNPRSTVWXYZ'.replaceAll(' ','').includes(shortcut.key))) return 'That shortcut is already used for editing, browsing, or workspace actions.';
  if (shortcut.alt&&!shortcut.ctrl&&!shortcut.shift&&['ArrowLeft','ArrowRight','D'].includes(shortcut.key)) return 'That shortcut is already used for browser navigation.';
  return '';
}
export function shortcutsError(shortcuts: WorkspaceShortcuts): string {
  const error=shortcutError(shortcuts.up)||shortcutError(shortcuts.down);
  if(error)return error;
  return sameShortcut(shortcuts.up,shortcuts.down)?'Use different shortcuts for moving up and down.':'';
}
function sameShortcut(a: Shortcut,b: Shortcut): boolean { return a.key===b.key&&a.ctrl===b.ctrl&&a.alt===b.alt&&a.shift===b.shift }
export function shortcutFromEvent(event: ShortcutKeyEvent): Shortcut | null {
  if(event.isComposing||event.metaKey||event.getModifierState?.('AltGraph'))return null;
  if(['Alt','Control','Shift','Meta'].includes(event.key))return null;
  return {key:normalizedKey(event.key),ctrl:event.ctrlKey,alt:event.altKey,shift:event.shiftKey};
}
export function shortcutDirection(event: ShortcutKeyEvent,shortcuts: WorkspaceShortcuts,editing=false): WorkspaceDirection | null {
  const shortcut=shortcutFromEvent(event);if(!shortcut)return null;
  if(editing&&shortcut.shift&&!shortcut.ctrl&&!shortcut.alt)return null;
  return sameShortcut(shortcut,shortcuts.up)?'up':sameShortcut(shortcut,shortcuts.down)?'down':null;
}
export function parseShortcuts(value: unknown): WorkspaceShortcuts {
  if(!value||typeof value!=='object')return defaultShortcuts();
  const candidate=value as Partial<WorkspaceShortcuts>;
  const checked=(binding: unknown): binding is Shortcut=>{
    if(!binding||typeof binding!=='object')return false;
    const item=binding as Shortcut;
    return typeof item.key==='string'&&[item.ctrl,item.alt,item.shift].every(v=>typeof v==='boolean')&&!shortcutError(item);
  };
  if(!checked(candidate.up)||!checked(candidate.down)||shortcutsError(candidate as WorkspaceShortcuts))return defaultShortcuts();
  return {up:{...candidate.up},down:{...candidate.down}};
}
export function adjacentWorkspaceId(workspaces: ReadonlyArray<{id:string}>,activeId: string,direction: WorkspaceDirection): string {
  if(!workspaces.length)return activeId;
  const current=Math.max(0,workspaces.findIndex(w=>w.id===activeId));
  return workspaces[(current+(direction==='up'?-1:1)+workspaces.length)%workspaces.length].id;
}
