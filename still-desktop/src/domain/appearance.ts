export type Appearance = 'minimal' | 'liquid-glass';
export type WorkspaceBackground = 'solid' | 'transparent' | 'dots';
export type GlassBackgroundEffect = 'liquid-chrome' | 'line-waves' | 'wave-wallpaper';
export interface GlassSettings { blur: number; saturation: number; opacity: number; widgetHeaders:boolean; backgroundEffect:GlassBackgroundEffect }
export const defaultGlass = (): GlassSettings => ({blur:6,saturation:78,opacity:68,widgetHeaders:true,backgroundEffect:'liquid-chrome'});
export function parseGlass(value: unknown): GlassSettings {
  const candidate=(value&&typeof value==='object'?value:{}) as Partial<GlassSettings>;
  const defaults=defaultGlass();
  const clamp=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;
  const backgroundEffect=candidate.backgroundEffect==='line-waves'||candidate.backgroundEffect==='wave-wallpaper'?candidate.backgroundEffect:'liquid-chrome';
  return {blur:clamp(candidate.blur,defaults.blur,0,18),saturation:clamp(candidate.saturation,defaults.saturation,40,100),opacity:clamp(candidate.opacity,defaults.opacity,45,90),widgetHeaders:candidate.widgetHeaders!==false,backgroundEffect};
}
