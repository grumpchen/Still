type Rect={left:number;top:number;right:number;bottom:number;width?:number;height?:number};
export function overlayVisible(r:Rect,v:Rect,active:boolean,obscured:boolean,overlap:boolean):boolean{
 return active&&!obscured&&!overlap&&(r.width??r.right-r.left)>=500&&(r.height??r.bottom-r.top)>=220&&r.left>=v.left-.5&&r.top>=v.top-.5&&r.right<=v.right+.5&&r.bottom<=v.bottom+.5;
}
