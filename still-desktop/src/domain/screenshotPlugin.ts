import type {WidgetTagColor} from './workspaces.ts';

export type ScreenshotPluginMode='global'|'tag-colors'|'off';
export type ScreenshotColorOverrides=Partial<Record<WidgetTagColor,boolean>>;

/** Decide whether the built-in screenshot control is available on a workspace card. */
export function showScreenshotControl(mode:ScreenshotPluginMode,colors:WidgetTagColor[],tagColor:WidgetTagColor|null,overrides:ScreenshotColorOverrides={}):boolean{
 if(tagColor&&typeof overrides[tagColor]==='boolean')return overrides[tagColor]!;
 if(mode==='off')return false;
 if(mode==='global')return true;
 return tagColor!==null&&colors.includes(tagColor);
}
