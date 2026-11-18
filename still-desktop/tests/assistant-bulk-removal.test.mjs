import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget} from '../src/domain/workspaces.ts';
import {assistantBulkRemovalSelection} from '../src/domain/assistantBulkRemoval.ts';

test('bulk workspace removal keeps every locked widget and the running AI Command',()=>{
 const command=createWidget('aiCommand'),notes=createWidget('notes'),files=createWidget('files'),locked=createWidget('timetable');
 command.lockPluginEnabled=true;command.locked=true;locked.lockPluginEnabled=true;locked.locked=true;
 const selection=assistantBulkRemovalSelection([command,notes,files,locked],command.id);
 assert.deepEqual(selection.removed.map(widget=>widget.id),[notes.id,files.id]);
 assert.deepEqual(selection.preserved.map(widget=>widget.id),[command.id,locked.id]);
});

test('bulk workspace removal safely handles an all-locked or empty workspace',()=>{
 const locked=createWidget('notes');locked.lockPluginEnabled=true;locked.locked=true;
 assert.deepEqual(assistantBulkRemovalSelection([locked]).removed,[]);
 assert.deepEqual(assistantBulkRemovalSelection([]).preserved,[]);
});
