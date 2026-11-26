import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedWorkbenchContext} from '../src/domain/workbenchContext.ts';

test('small workbench directories keep their existing structure and recent results',()=>{
 const snapshot={workspaces:[{id:'workspace-exact',name:'Biology',role:'study',files:[{widgetId:'files-1',name:'Reading folder',kind:'folder',connected:true}],links:[{id:'link-1',name:'Lecture',url:'https://example.edu/lecture',origin:{kind:'group',workspaceId:'workspace-exact',groupId:'group-1'}}]}],layouts:[{id:'layout-1',name:'Exam setup',createdAt:12,widgetCount:3,groupCount:1}]};
 const recent=[{operation:'resource.find',summary:'Found one resource.',data:{results:[{kind:'link',linkId:'link-1'}],unavailable:[],truncated:false}}];
 assert.deepEqual(boundedWorkbenchContext(snapshot,recent),{...snapshot,recentResults:recent});
});

test('large directories and searches are bounded, explicitly partial, and retain exact workspace IDs',()=>{
 const workspaces=Array.from({length:30},(_,workspaceIndex)=>({id:`workspace-${workspaceIndex}-exact-id`,name:`Workspace ${workspaceIndex}`,role:'custom',files:Array.from({length:30},(_,index)=>({widgetId:`file-widget-${workspaceIndex}-${index}`,name:`Chosen folder ${index}`,kind:'folder',connected:true})),links:Array.from({length:80},(_,index)=>({id:`link-${workspaceIndex}-${index}`,name:`Lecture ${index}`,url:`https://example.edu/${workspaceIndex}/${index}`,origin:{kind:'browser',workspaceId:`workspace-${workspaceIndex}-exact-id`,widgetId:`browser-${workspaceIndex}`} }))}));
 const snapshot={workspaces,layouts:Array.from({length:24},(_,index)=>({id:`layout-${index}`,name:`Layout ${index}`,createdAt:index,widgetCount:4,groupCount:1}))};
 const recent=[{operation:'resource.find',summary:'Found many resources.',data:{results:Array.from({length:100},(_,index)=>({kind:'file',widgetId:`widget-${index}`,name:`file-${index}`.repeat(40),path:`/large/${index}`.repeat(30)})),unavailable:[],truncated:false}}];
 const context=boundedWorkbenchContext(snapshot,recent),json=JSON.stringify(context),bytes=new TextEncoder().encode(json).length;
 assert.ok(bytes<30_000,`context is ${bytes} UTF-8 bytes`);
 assert.deepEqual(context.workspaces.map(item=>item.id),workspaces.map(item=>item.id),'all workspace IDs remain available for exact targeting');
 assert.equal(context.directoryTruncated,true);
 assert.ok(context.directoryOmitted.links>0||context.directoryOmitted.files>0||context.directoryOmitted.layouts>0);
 assert.match(context.directoryNotice,/resource\.find or layout\.find/);
 assert.equal(context.recentResults.length,1);
 assert.equal(context.recentResults[0].data.results.length,8);
 assert.equal(context.recentResults[0].data.truncated,false,'a provider-context cap must not masquerade as a native search truncation');
 assert.equal(context.recentResults[0].data.contextTruncated,true);
 assert.equal(context.recentResultsTruncated,true);
 assert.ok(context.workspaces.every(item=>item.files.every(file=>!('content'in file))&&item.links.every(link=>!('content'in link))));
});
