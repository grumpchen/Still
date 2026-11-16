import type {WidgetInstance,WidgetType} from './workspaces.ts';
import {setWidgetLock} from './widgetLock.ts';

/** First-party widget add-ons that can be installed from a card's + menu. */
export interface WidgetAddonDefinition {
 id:string;
 label:string;
 addLabel:string;
 removeLabel:string;
 icon:string;
 availableFor:(type:WidgetType)=>boolean;
 isEnabled:(widget:WidgetInstance)=>boolean;
 toggle:(widget:WidgetInstance)=>Partial<WidgetInstance>;
}

const allWidgets=()=>true;

/**
 * Keep add-on menu metadata and state transitions together so adding a built-in
 * add-on does not require another hand-written menu item in WorkspaceCanvas.
 * Feature behavior remains implemented by the widget and workspace modules.
 */
export const widgetAddonCatalog:readonly WidgetAddonDefinition[]=[
 {
  id:'color-tag',label:'tagColor',addLabel:'addColorTagPlugin',removeLabel:'removeColorTagPlugin',icon:'stack',availableFor:allWidgets,
  isEnabled:widget=>widget.tagColor!==null,
  toggle:widget=>({tagColor:widget.tagColor===null?'blue':null}),
 },
 {
  id:'clock-timer',label:'clockAddon',addLabel:'addClockTimerPlugin',removeLabel:'removeClockTimerPlugin',icon:'clock',availableFor:type=>type!=='group',
  isEnabled:widget=>widget.clockPluginEnabled,
  toggle:widget=>({clockPluginEnabled:!widget.clockPluginEnabled}),
 },
 {
  id:'lock',label:'lockWidgetAction',addLabel:'addLockPlugin',removeLabel:'removeLockPlugin',icon:'lock',availableFor:allWidgets,
  isEnabled:widget=>widget.lockPluginEnabled,
  toggle:widget=>{const next=setWidgetLock(widget,!widget.lockPluginEnabled);return{lockPluginEnabled:next.lockPluginEnabled,locked:next.locked}},
 },
 {
  id:'pin-to-front',label:'plugin_pin_to_front_name',addLabel:'addPinFrontPlugin',removeLabel:'removePinFrontPlugin',icon:'pin',availableFor:allWidgets,
  isEnabled:widget=>widget.pinPluginEnabled,
  toggle:widget=>({pinPluginEnabled:!widget.pinPluginEnabled,pinned:!widget.pinPluginEnabled}),
 },
];

export function availableWidgetAddons(widget:WidgetInstance):WidgetAddonDefinition[]{
 return widgetAddonCatalog.filter(addon=>addon.availableFor(widget.type));
}

export function widgetAddonTransition(widget:WidgetInstance,addonId:string):Partial<WidgetInstance>|null{
 const addon=widgetAddonCatalog.find(candidate=>candidate.id===addonId);
 return addon?.availableFor(widget.type)?addon.toggle(widget):null;
}
