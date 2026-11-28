import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantReply} from '../src/domain/assistant.ts';

const reply=(workbenchActions,extra={})=>parseAssistantReply({intent:'workspace_action',reply:'Ready.',layout:[],actions:[],workbenchActions,...extra});

test('legacy replies remain compatible when workbenchActions is omitted',()=>{
 const parsed=parseAssistantReply({reply:'Hello',layout:[],actions:[]});
 assert.equal(parsed.workbenchActions,undefined);
});

test('workbench actions parse to the tagged canonical requests',()=>{
 const layout={operation:'layout.apply',layoutId:'layout-1',targetWorkspaceId:'workspace-2',mode:'append'};
 const link={operation:'link.rename',origin:{kind:'browser',workspaceId:'workspace-2',widgetId:'browser-1'},linkId:'link-1',name:'Course'};
 assert.deepEqual(reply([layout]).workbenchActions,[layout]);
 assert.deepEqual(reply([link]).workbenchActions,[link]);
});

test('Files reference operations are distinct from physical disk actions',()=>{
 const move=reply([{operation:'file.moveReference',widgetId:'files-card-1',destinationWorkspaceId:'workspace-2'}]).workbenchActions[0];
 const rename=reply([{operation:'file.renameReference',widgetId:'files-card-2',name:'Reading list'}]).workbenchActions[0];
 const remove=reply([{operation:'file.deleteReference',widgetId:'files-card-3'}]).workbenchActions[0];
 assert.equal(move.destinationWorkspaceId,'workspace-2');
 assert.equal(rename.name,'Reading list');
 assert.equal(remove.widgetId,'files-card-3');
 assert.throws(()=>reply([{operation:'file.deleteReference',widgetId:'files-card-3',path:'actual.pdf'}]));
});

test('query operations can batch while mutations remain singular',()=>{
 const actions=[{operation:'layout.list'},{operation:'layout.find',query:'Chemistry'},{operation:'resource.find',query:'lecture notes'}];
 assert.deepEqual(reply(actions).workbenchActions,actions);
 const movedLink={operation:'link.move',origin:{kind:'browser',workspaceId:'w1',widgetId:'browser-1'},linkId:'l1',destinationWorkspaceId:'w2'};
 assert.deepEqual(reply([movedLink]).workbenchActions,[movedLink]);
 assert.throws(()=>reply([{operation:'link.delete',origin:{kind:'group',workspaceId:'w1',groupId:'g1'},linkId:'l1'},{operation:'file.delete',widgetId:'files-1',path:'CHEM111/old.pdf'}]));
});

test('workbench mutations cannot mix with legacy workspace changes or another reply intent',()=>{
 const action={operation:'rule.save',text:'When I capture links matching lecture, file them to Chemistry once Friday 09:00 Pacific/Auckland'};
 assert.throws(()=>reply([action],{actions:[{type:'remove_widget',ids:['notes-1']}]}),/mixed Still actions/);
 assert.throws(()=>parseAssistantReply({intent:'layout',reply:'Ready.',layout:[{id:'notes-1',x:0,y:0,width:300,height:250}],actions:[],workbenchActions:[action]}),/mixed Still actions/);
 assert.throws(()=>parseAssistantReply({intent:'clarification',reply:'Which one?',layout:[],actions:[],workbenchActions:[action]}),/mixed Still actions/);
});

test('resource paths, URLs, origin variants, ids and unknown fields are rejected strictly',()=>{
 for(const action of [
  {operation:'file.move',widgetId:'files-1',path:'../secret.txt',destinationFolder:''},
  {operation:'file.move',widgetId:'files-1',path:'file.txt',destinationFolder:'C:/outside'},
  {operation:'link.create',workspaceId:'workspace-1',name:'Search',url:'https://user:pass@example.com'},
  {operation:'link.delete',origin:{kind:'group',workspaceId:'w1',groupId:'g1',extra:'x'},linkId:'l1'},
  {operation:'layout.delete',layoutId:'layout-1',mode:'replace'},
  {operation:'file.delete',widgetId:'files-1',path:'notes.md',unexpected:true},
  {operation:'resource.find',query:'   '},
  {operation:'rule.save',text:'x'.repeat(2001)},
 ])assert.throws(()=>reply([action]));
});

test('file contents and annotations preserve intentional whitespace',()=>{
 const parsed=reply([
  {operation:'file.editText',widgetId:'files-1',path:'notes.md',text:'\nUpdated text\n',expectedText:' old content\n'},
 ]);
 assert.equal(parsed.workbenchActions[0].text,'\nUpdated text\n');
 assert.equal(parsed.workbenchActions[0].expectedText,' old content\n');
 const annotation=reply([{operation:'file.annotation',widgetId:'files-1',path:'notes.md',text:'  note  '}]);
 assert.equal(annotation.workbenchActions[0].text,'  note  ');
});

test('file.createText accepts only bounded relative .md and .txt paths',()=>{
 const action={operation:'file.createText',widgetId:'files-1',path:'Course/new notes.md',text:'# Notes\n'};
 assert.deepEqual(reply([action]).workbenchActions,[action]);
 for(const path of ['Course/new.csv','../outside.txt','C:/outside.txt','Course/.txt','Course/folder/'])assert.throws(()=>reply([{...action,path}]));
 assert.throws(()=>reply([{...action,text:'x'.repeat(1_000_001)}]));assert.throws(()=>reply([{...action,text:'é'.repeat(500_001)}]));
});

test('built-in widget operations are strict, tagged actions',()=>{
 const browser={operation:'widget.browser.navigate',widgetId:'browser-1',url:'https://example.edu/path'};
 const calendar={operation:'calendar.add',widgetId:'calendar-1',events:[{date:'2026-12-01',title:'Final exam',time:'10:30',category:'exam'}]};
 const status={operation:'widget.taskStatus.set',widgetId:'notes-1',status:'done'};
 assert.deepEqual(reply([browser]).workbenchActions,[browser]);assert.deepEqual(reply([calendar]).workbenchActions,[calendar]);assert.deepEqual(reply([status]).workbenchActions,[status]);
 for(const action of [{...browser,url:'http://example.edu'},{...calendar,events:[{date:'2026-02-30',title:'Bad date',time:'',category:'study'}]},{...status,unknown:true},{operation:'widget.aiCommand.edit',widgetId:'command-1'}])assert.throws(()=>reply([action]));
});
