// Add metadata here and a renderer to widgets.tsx to introduce a new widget type.
export const widgetCatalog = {
  group: {name:'Group', icon:'group', description:'Named tray collections · reusable widget types and course links', width:400, height:360, minWidth:280, minHeight:240},
  desmos: {name:'Calculator', icon:'desmos', description:'Live Desmos scientific calculator', width:440, height:490, minWidth:280, minHeight:300},
  notes: {name:'Notes', icon:'notes', description:'Independent notes, saved locally', width:400, height:340, minWidth:240, minHeight:180},
  focus: {name:'Focus', icon:'focus', description:'A timer for your next study session', width:360, height:430, minWidth:280, minHeight:330},
  files: {name:'Files', icon:'files', description:'Your local course files', width:400, height:380, minWidth:280, minHeight:240},
  apps: {name:'Apps', icon:'apps', description:'Real desktop apps inside movable panels', width:360, height:280, minWidth:280, minHeight:220},
  timetable: {name:'Timetable', icon:'study', description:'A weekly schedule you can edit', width:460, height:360, minWidth:280, minHeight:220},
  calendar: {name:'Calendar', icon:'calendar', description:'Plan classes, assignments, exams, and study sessions', width:560, height:480, minWidth:320, minHeight:300},
  ai: {name:'Assistant', icon:'ai', description:'Gemini chat · read selected widgets · propose workspace layouts', width:380, height:300, minWidth:260, minHeight:220},
  tagStatus: {name:'Tag Color Status', icon:'stack', description:'Quick controls for widget relaunch and other enabled widget plugins', width:400, height:300, minWidth:280, minHeight:200},
} as const;
export type WidgetType = keyof typeof widgetCatalog;
export const widgetTypes = Object.keys(widgetCatalog) as WidgetType[];
