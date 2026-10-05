import {placement,type Placement} from './layout.ts';
export function lecturePlacement(width:number,height:number,x=0,y=0):Placement {
  return placement('browser',{x,y,width:Math.floor(width*.8),height:Math.floor(height)-4});
}
export function toggleLecture(current:Placement,restore:Placement|null,width:number,height:number,x=0,y=0):{placement:Placement;lectureRestore:Placement|null} {
  return restore?{placement:placement('browser',restore),lectureRestore:null}:{placement:lecturePlacement(width,height,x,y),lectureRestore:{...current}};
}
