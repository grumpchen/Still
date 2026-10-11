export type Appearance = 'minimal' | 'liquid-glass';
export type WorkspaceBackground = 'solid' | 'transparent' | 'dots';
export type WorkspaceBackgroundChoice = WorkspaceBackground | 'leaf-photo';
export function backgroundSettingsValue(appearance:Appearance,background:WorkspaceBackground):WorkspaceBackgroundChoice{
  return appearance==='liquid-glass'&&background==='solid'?'leaf-photo':background;
}
export function backgroundSettingsUpdate(choice:WorkspaceBackgroundChoice):{appearance?:Appearance;background:WorkspaceBackground}{
  return choice==='leaf-photo'?{appearance:'liquid-glass',background:'solid'}:{background:choice};
}
export interface GlassSettings { blur: number; saturation: number; opacity: number }
export const defaultGlass = (): GlassSettings => ({blur:6,saturation:78,opacity:68});
export function parseGlass(value: unknown): GlassSettings {
  const candidate=(value&&typeof value==='object'?value:{}) as Partial<GlassSettings>;
  const defaults=defaultGlass();
  const clamp=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;
  return {blur:clamp(candidate.blur,defaults.blur,0,18),saturation:clamp(candidate.saturation,defaults.saturation,40,100),opacity:clamp(candidate.opacity,defaults.opacity,45,90)};
}
