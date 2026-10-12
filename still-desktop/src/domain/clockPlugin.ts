import type {WidgetTagColor} from './widgetTags.ts';

export type ClockPluginMode='global'|'tag-colors'|'off';
export type ClockPluginColorOverrides=Partial<Record<WidgetTagColor,boolean>>;

/** Whether a card with its Clock add-on should expose the timer control. */
export function showClockControl(mode:ClockPluginMode,colors:WidgetTagColor[],tagColor:WidgetTagColor|null,overrides:ClockPluginColorOverrides={}):boolean{
 if(tagColor&&typeof overrides[tagColor]==='boolean')return overrides[tagColor]!;
 if(mode==='off')return false;
 if(mode==='global')return true;
 return tagColor!==null&&colors.includes(tagColor);
}
