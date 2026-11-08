import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentToolDispatcher,defineAgentTool,runAgentLoop,resumeAgentLoop} from '../src/domain/agentLoop.ts';

const userMessage={role:'user',text:'Add two widgets, then tell me what happened.'};
function appendToolRound(history,assistantMessage,results){
  return [...history,assistantMessage,...results.map(result=>({role:'tool',...result}))];
}

test('passes actual tool results into the next model request and reports completed mutation',async()=>{
  const calls=[];
  const dispatch=createAgentToolDispatcher({
    add_widget:defineAgentTool(input=>{
      if(typeof input?.type!=='string')throw new Error('type is required');
      return input;
    },async input=>({status:'succeeded',mutation:'applied',result:{id:'widget-1',type:input.type}})),
  });
  const outcome=await runAgentLoop({
    history:[userMessage],
    executeTool:dispatch,
    appendToolRound,
    requestModel:async history=>{
      calls.push(history);
      if(calls.length===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',toolCalls:['c1']},calls:[{id:'c1',name:'add_widget',input:{type:'notes'}}]};
      assert.deepEqual(history.at(-1),{role:'tool',toolCallId:'c1',toolName:'add_widget',execution:{status:'succeeded',mutation:'applied',result:{id:'widget-1',type:'notes'}}});
      return {kind:'final',response:'The Notes widget was added.'};
    },
  });
  assert.equal(calls.length,2);
  assert.equal(outcome.status,'final');
  assert.equal(outcome.response,'The Notes widget was added.');
  assert.equal(outcome.actionOutcome,'succeeded');
  assert.equal(outcome.toolCalls,1);
});

test('does not count a provider claim as success when a requested tool failed',async()=>{
  const dispatch=createAgentToolDispatcher({});
  let modelRequests=0,nextHistory;
  const outcome=await runAgentLoop({
    history:[userMessage],executeTool:dispatch,appendToolRound,
    requestModel:async history=>{
      modelRequests++;
      if(modelRequests===1){
        return {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'missing-1',name:'remove_everything',input:{}}]};
      }
      nextHistory=history;
      return {kind:'final',response:'Done, everything was removed.'};
    },
  });
  assert.equal(outcome.status,'final');
  assert.equal(outcome.actionOutcome,'failed');
  assert.equal(outcome.toolResults[0].execution.status,'failed');
  assert.equal(outcome.toolResults[0].execution.mutation,'none');
  assert.match(outcome.toolResults[0].execution.error,/Unknown tool/);
  assert.equal(nextHistory.at(-1).role,'tool');
});

test('distinguishes validation failure, thrown possibly-mutating failure, and successful no-op',async()=>{
  const validate=defineAgentTool(input=>{
    if(input!=='allowed')throw new Error('invalid input');
    return input;
  },()=>({status:'succeeded',mutation:'none',result:{found:false}}));
  const uncertain=defineAgentTool(input=>input,()=>{throw new Error('disk write interrupted');});
  const dispatch=createAgentToolDispatcher({validate,uncertain});
  assert.deepEqual(await dispatch({id:'a',name:'validate',input:'bad'}),{status:'failed',mutation:'none',error:'invalid input'});
  assert.deepEqual(await dispatch({id:'b',name:'uncertain',input:{}}),{status:'failed',mutation:'unknown',error:'disk write interrupted'});
  assert.deepEqual(await dispatch({id:'c',name:'validate',input:'allowed'}),{status:'succeeded',mutation:'none',result:{found:false}});

  const outcome=await runAgentLoop({history:[userMessage],executeTool:async()=>({status:'succeeded',mutation:'none',result:{found:false}}),appendToolRound,
    requestModel:async history=>history.length===1
      ? {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'read-1',name:'lookup',input:{}}]}
      : {kind:'final',response:'There was nothing to update.'},
  });
  assert.equal(outcome.actionOutcome,'no_mutation');
});

test('allows a final response after the configured tool-round budget',async()=>{
  let modelRequests=0,executions=0;
  const outcome=await runAgentLoop({history:[userMessage],maxSteps:1,
    requestModel:async()=>{modelRequests++;return modelRequests===1
      ? {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'c1',name:'read',input:{}}]}
      : {kind:'final',response:'The read completed.'};},
    executeTool:async()=>{executions++;return {status:'succeeded',mutation:'none',result:{value:'actual'}};},
    appendToolRound,
  });
  assert.equal(outcome.status,'final');
  assert.equal(outcome.response,'The read completed.');
  assert.equal(outcome.steps,1);
  assert.equal(modelRequests,2);
  assert.equal(executions,1);
  assert.deepEqual(outcome.toolResults[0].execution,{status:'succeeded',mutation:'none',result:{value:'actual'}});
});

test('does not execute a new tool after the configured budget but reports the refusal',async()=>{
  let modelRequests=0,executions=0;
  const outcome=await runAgentLoop({history:[userMessage],maxSteps:1,
    requestModel:async()=>{modelRequests++;return {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:`c${modelRequests}`,name:'read',input:{}}]};},
    executeTool:async()=>{executions++;return {status:'succeeded',mutation:'none',result:{value:'actual'}};},
    appendToolRound,
  });
  assert.equal(outcome.status,'step_limit');
  assert.equal(outcome.steps,1);
  assert.equal(modelRequests,2);
  assert.equal(executions,1);
  assert.equal(outcome.toolResults.length,2);
  assert.deepEqual(outcome.toolResults[0].execution,{status:'succeeded',mutation:'none',result:{value:'actual'}});
  assert.deepEqual(outcome.toolResults[1].execution,{status:'failed',mutation:'none',error:'Step limit reached; this call was not executed.'});
});

test('enforces total tool-call limit and returns failures for calls it refused to run',async()=>{
  let executions=0,modelRequests=0;
  const outcome=await runAgentLoop({history:[userMessage],maxToolCalls:1,
    requestModel:async()=>{modelRequests++;return {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[
      {id:'c1',name:'first',input:{}},{id:'c2',name:'second',input:{}},
    ]};},
    executeTool:async call=>{executions++;return {status:'succeeded',mutation:'applied',result:{ran:call.id}};},
    appendToolRound,
  });
  assert.equal(outcome.status,'tool_limit');
  assert.equal(modelRequests,1);
  assert.equal(executions,1);
  assert.equal(outcome.toolCalls,1);
  assert.equal(outcome.toolResults.length,2);
  assert.equal(outcome.toolResults[0].execution.status,'succeeded');
  assert.deepEqual(outcome.toolResults[1].execution,{status:'failed',mutation:'none',error:'Tool call limit reached; this call was not executed.'});
  assert.equal(outcome.actionOutcome,'partially_failed');
});

test('rejects invalid limits and repeated tool-call ids before executing them',async()=>{
  await assert.rejects(()=>runAgentLoop({history:[],maxSteps:13,requestModel:async()=>({kind:'final',response:'ok'}),executeTool:()=>({status:'succeeded',mutation:'none',result:null}),appendToolRound}),/maxSteps/);
  let executions=0;
  await assert.rejects(()=>runAgentLoop({history:[],requestModel:async()=>({kind:'tool_calls',assistantMessage:{},calls:[
    {id:'same',name:'one',input:{}},{id:'same',name:'two',input:{}},
  ]}),executeTool:async()=>{executions++;return {status:'succeeded',mutation:'applied',result:null};},appendToolRound}),/duplicate call id/);
  assert.equal(executions,0);
});

test('maxSteps zero refuses tools but still permits a plain final answer',async()=>{
  let executions=0;
  const outcome=await runAgentLoop({history:[userMessage],maxSteps:0,
    requestModel:async()=>({kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'not-run',name:'write',input:{}}]}),
    executeTool:async()=>{executions++;return {status:'succeeded',mutation:'applied',result:null};},
    appendToolRound,
  });
  assert.equal(outcome.status,'step_limit');
  assert.equal(outcome.steps,0);
  assert.equal(executions,0);
  assert.deepEqual(outcome.toolResults[0].execution,{status:'failed',mutation:'none',error:'Step limit reached; this call was not executed.'});
  const final=await runAgentLoop({history:[userMessage],maxSteps:0,
    requestModel:async()=>({kind:'final',response:'No tool needed.'}),executeTool:async()=>{executions++;return {status:'succeeded',mutation:'none',result:null};},appendToolRound,
  });
  assert.equal(final.status,'final');
  assert.equal(final.response,'No tool needed.');
  assert.equal(executions,0);
});

test('rejects inherited names instead of dispatching prototype properties',async()=>{
  const dispatch=createAgentToolDispatcher({safe:async()=>({status:'succeeded',mutation:'none',result:'ok'})});
  for(const name of ['constructor','toString','__proto__']){
    const result=await dispatch({id:name,name,input:{}});
    assert.equal(result.status,'failed');
    assert.equal(result.mutation,'none');
    assert.match(result.error,/Unknown tool/);
  }
});

test('treats malformed tool receipts as unknown failure rather than success',async()=>{
  const outcome=await runAgentLoop({history:[userMessage],
    requestModel:async history=>history.length===1
      ? {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'bad-receipt',name:'bad',input:{}}]}
      : {kind:'final',response:'Done.'},
    executeTool:async()=>({status:'succeeded',mutation:'applied'}),appendToolRound,
  });
  assert.deepEqual(outcome.toolResults[0].execution,{status:'failed',mutation:'unknown',error:'Tool returned an invalid execution result.'});
  assert.equal(outcome.actionOutcome,'partially_failed');
});

test('cancellation blocks tools that have not started and returns no final success claim',async()=>{
  const controller=new AbortController();let executions=0;
  const outcome=await runAgentLoop({history:[userMessage],signal:controller.signal,
    requestModel:async()=>({kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'c1',name:'first',input:{}},{id:'c2',name:'second',input:{}}]}),
    executeTool:async(call,signal)=>{
      executions++;
      assert.equal(signal,controller.signal);
      if(call.id==='c1')controller.abort();
      return {status:'succeeded',mutation:'applied',result:{ran:call.id}};
    },appendToolRound,
  });
  assert.equal(outcome.status,'cancelled');
  assert.equal(executions,1);
  assert.equal(outcome.toolResults[0].execution.status,'succeeded');
  assert.deepEqual(outcome.toolResults[1].execution,{status:'failed',mutation:'none',error:'Agent run cancelled before this call was executed.'});
  assert.equal(outcome.actionOutcome,'partially_failed');
});

test('pauses a confirmation-gated call and resumes with the exact applied receipt',async()=>{
  let modelRequests=0,toolExecutions=0,appExecutions=0;
  const options={history:[userMessage],confirmationRequiredToolNames:['add_widget'],appendToolRound,
    requestModel:async history=>{
      modelRequests++;
      if(modelRequests===1)return {kind:'tool_calls',assistantMessage:{role:'assistant',toolCalls:['add-widget-call']},calls:[{id:'add-widget-call',name:'add_widget',input:{widgetType:'notes',snapshotRevision:'rev-1'}}]};
      assert.deepEqual(history.at(-1),{role:'tool',toolCallId:'add-widget-call',toolName:'add_widget',execution:{status:'succeeded',mutation:'applied',result:{receipt:'Added a Notes widget.'}}});
      return {kind:'final',response:'The Notes widget was added.'};
    },
    executeTool:async()=>{toolExecutions++;return {status:'requires_confirmation',proposal:{type:'add_widget',widgetType:'notes'}};},
  };
  const pending=await runAgentLoop(options);
  assert.equal(pending.status,'awaiting_confirmation');
  assert.equal(pending.proposal.widgetType,'notes');
  assert.equal(modelRequests,1);
  assert.equal(toolExecutions,1);
  assert.equal(pending.history.length,1,'unresolved provider tool call is not appended as a fake result');
  const actualExecution={status:'succeeded',mutation:'applied',result:{receipt:'Added a Notes widget.'}};
  const resumed=await resumeAgentLoop(options,pending.continuation,actualExecution);
  assert.equal(resumed.status,'final');
  assert.equal(resumed.response,'The Notes widget was added.');
  assert.equal(resumed.actionOutcome,'succeeded');
  assert.equal(resumed.toolResults[0].execution.result.receipt,'Added a Notes widget.');
  assert.equal(appExecutions,0,'agent loop only consumes an externally obtained app receipt');
});

test('resumes declined proposals as non-mutating failures',async()=>{
  let modelRequests=0;
  const options={history:[userMessage],confirmationRequiredToolNames:['add_widget'],appendToolRound,
    requestModel:async history=>{
      modelRequests++;
      if(modelRequests===1)return {kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'declined',name:'add_widget',input:{}}]};
      assert.equal(history.at(-1).execution.error,'The user declined this proposal. Nothing was changed.');
      return {kind:'final',response:'I did not add the widget.'};
    },executeTool:async()=>({status:'requires_confirmation',proposal:{type:'add_widget'}}),
  };
  const pending=await runAgentLoop(options);
  const resumed=await resumeAgentLoop(options,pending.continuation,{status:'failed',mutation:'none',error:'The user declined this proposal. Nothing was changed.'});
  assert.equal(resumed.status,'final');
  assert.equal(resumed.actionOutcome,'failed');
  assert.equal(resumed.toolResults[0].execution.status,'failed');
});

test('refuses confirmation-gated calls mixed with other calls before executing either',async()=>{
  let executions=0;
  const outcome=await runAgentLoop({history:[userMessage],confirmationRequiredToolNames:['add_widget'],
    requestModel:async()=>({kind:'tool_calls',assistantMessage:{role:'assistant'},calls:[{id:'read',name:'inspect',input:{}},{id:'write',name:'add_widget',input:{}}]}),
    executeTool:async()=>{executions++;return {status:'succeeded',mutation:'none',result:null}},appendToolRound,
  });
  assert.equal(outcome.status,'invalid_tool_round');
  assert.equal(executions,0);
  assert.equal(outcome.toolResults.length,2);
  assert.ok(outcome.toolResults.every(result=>result.execution.status==='failed'&&result.execution.mutation==='none'));
});
