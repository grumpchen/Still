export interface ClockPopupRect {top:number;bottom:number;right:number}
export interface ClockPopupPosition {top:number;right:number;maxHeight:number;side:'above'|'below'}

export function clockPopupPosition(rect:ClockPopupRect,viewport:{width:number;height:number},width=180,height=220,gap=8,margin=8,minRoom=120):ClockPopupPosition{
 const above=Math.max(0,rect.top-gap-margin),below=Math.max(0,viewport.height-rect.bottom-gap-margin);
 const minimum=Math.min(height,minRoom);
 const side:ClockPopupPosition['side']=above>=minimum?'above':below>=minimum?'below':above>=below?'above':'below';
 const room=side==='above'?above:below,maxHeight=Math.min(height,room);
 return{top:side==='above'?rect.top-gap-maxHeight:rect.bottom+gap,right:Math.max(margin,Math.min(viewport.width-rect.right,viewport.width-width-margin)),maxHeight,side};
}
