import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWidget,createWorkspace} from '../src/domain/workspaces.ts';
import {assistantWorkspaceContext} from '../src/domain/assistant.ts';
import {removeAssistantWidgetMention,resolveAssistantWidgetMentions} from '../src/domain/assistantMentions.ts';

test('typed @ names select one matching widget and an ambiguous generic name selects none',()=>{
  const workspace=createWorkspace('Study',[]),edge=createWidget('apps'),timetable=createWidget('timetable');
  edge.title='Microsoft Edge';workspace.widgets=[edge,timetable];
  const selected=resolveAssistantWidgetMentions('@Microsoft Edge @Timetable can you create a timetable',workspace,[edge.id]);
  assert.deepEqual(selected,[edge.id,timetable.id]);
  const context=assistantWorkspaceContext(workspace,900,700,selected);
  assert.deepEqual(context.widgetData.map(widget=>widget.type),['apps','timetable']);
  assert.deepEqual(context.widgetData.map(widget=>widget.quickSelected),[true,true]);
  assert.equal(context.capabilities.contentEditingRequiresWidgetSelection,false);
  assert.equal(removeAssistantWidgetMention('@Microsoft Edge @Timetable make one',workspace,timetable.id),'@Microsoft Edge make one');
  workspace.widgets.push(createWidget('timetable'));
  assert.deepEqual(resolveAssistantWidgetMentions('@Microsoft Edge @Timetable',workspace,[edge.id]),[edge.id]);
});
