/**
 * Small provider-independent orchestration loop for tool-using assistants.
 * Provider adapters own message encoding; this module owns budgets, dispatch,
 * and truthful accounting of tool outcomes.
 */

export const DEFAULT_AGENT_MAX_STEPS = 5;
export const DEFAULT_AGENT_MAX_TOOL_CALLS = 20;
export const MAX_AGENT_STEPS = 12;
export const MAX_AGENT_TOOL_CALLS = 32;
export const MAX_AGENT_TOOL_CALLS_PER_TURN = 32;

export type AgentMutation = 'none' | 'applied' | 'partial' | 'unknown';

/** A successful no-op/read is distinct from an attempted mutation. */
export type AgentToolExecution =
  | { status: 'succeeded'; mutation: 'none' | 'applied'; result: unknown }
  | { status: 'failed'; mutation: 'none' | 'partial' | 'unknown'; error: string };
export type AgentToolConfirmation = { status: 'requires_confirmation'; proposal: unknown };
export type AgentToolDispatchResult = AgentToolExecution | AgentToolConfirmation;

export type AgentToolCall = { id: string; name: string; input: unknown };

export type AgentToolCallResult = {
  toolCallId: string;
  toolName: string;
  execution: AgentToolExecution;
};

/** A function registered in Still's local, allowlisted tool table. */
export type AgentToolHandler = (input: unknown) => AgentToolDispatchResult | Promise<AgentToolDispatchResult>;

/**
 * Make a handler that validates untrusted model input before running a typed
 * operation. Parse failures are known to have made no change. A thrown runtime
 * error is marked unknown because the operation may have changed state before
 * it threw.
 */
export function defineAgentTool<Input>(
  parse: (input: unknown) => Input,
  run: (input: Input) => AgentToolExecution | Promise<AgentToolExecution>,
): AgentToolHandler {
  return async input => {
    let parsed: Input;
    try {
      parsed = parse(input);
    } catch (error) {
      return { status: 'failed', mutation: 'none', error: errorMessage(error) };
    }

    try {
      return await run(parsed);
    } catch (error) {
      return { status: 'failed', mutation: 'unknown', error: errorMessage(error) };
    }
  };
}

/** Dispatch only registered tools. Unknown names are reported as non-mutating failures. */
export function createAgentToolDispatcher(
  tools: Readonly<Record<string, AgentToolHandler>>,
): (call: AgentToolCall) => Promise<AgentToolDispatchResult> {
  return async call => {
    let handler: AgentToolHandler | undefined;
    try {
      handler = Object.hasOwn(tools, call.name) ? tools[call.name] : undefined;
    } catch (error) {
      return { status: 'failed', mutation: 'unknown', error: errorMessage(error) };
    }
    if (!handler) return { status: 'failed', mutation: 'none', error: `Unknown tool: ${call.name}` };
    try {
      return checkedDispatchResult(await handler(call.input));
    } catch (error) {
      // Defensively cover plain handlers too; a thrown call cannot be reported as success.
      return { status: 'failed', mutation: 'unknown', error: errorMessage(error) };
    }
  };
}

export type AgentModelTurn<Message, Final> =
  | { kind: 'final'; response: Final }
  | { kind: 'tool_calls'; assistantMessage: Message; calls: AgentToolCall[] };

export type AgentActionOutcome = 'no_tools' | 'no_mutation' | 'succeeded' | 'failed' | 'partially_failed';

export type AgentLoopResult<Message, Final> =
  | {
      status: 'final';
      response: Final;
      history: Message[];
      toolResults: AgentToolCallResult[];
      steps: number;
      toolCalls: number;
      actionOutcome: AgentActionOutcome;
    }
  | {
      status: 'awaiting_confirmation';
      history: Message[];
      toolResults: AgentToolCallResult[];
      steps: number;
      toolCalls: number;
      actionOutcome: AgentActionOutcome;
      continuation: AgentLoopContinuation<Message>;
      proposal: unknown;
    }
  | {
      status: 'step_limit' | 'tool_limit' | 'cancelled' | 'invalid_tool_round';
      history: Message[];
      toolResults: AgentToolCallResult[];
      steps: number;
      toolCalls: number;
      actionOutcome: AgentActionOutcome;
    };

/** Ephemeral continuation held by the UI; it is never persisted or sent to the provider. */
export type AgentLoopContinuation<Message> = {
  history: Message[];
  assistantMessage: Message;
  call: AgentToolCall;
  toolResults: AgentToolCallResult[];
  steps: number;
  toolCalls: number;
  seenIds: string[];
};

export type AgentLoopOptions<Message, Final> = {
  history: readonly Message[];
  requestModel: (history: readonly Message[], signal?: AbortSignal) => Promise<AgentModelTurn<Message, Final>>;
  executeTool: (call: AgentToolCall, signal?: AbortSignal) => Promise<AgentToolDispatchResult> | AgentToolDispatchResult;
  /** Append the provider's tool-call message and the exact execution results as tool messages. */
  appendToolRound: (
    history: readonly Message[],
    assistantMessage: Message,
    results: readonly AgentToolCallResult[],
  ) => Message[];
  maxSteps?: number;
  maxToolCalls?: number;
  signal?: AbortSignal;
  /** Confirmation-gated tools must be alone in their provider round. */
  confirmationRequiredToolNames?: readonly string[];
};

/**
 * Execute sequential model/tool rounds. Sequential dispatch preserves order
 * for stateful workspace operations. Model and history-adapter errors bubble
 * to the caller, so an interrupted run cannot be mistaken for a final answer.
 */
export async function runAgentLoop<Message, Final>(
  options: AgentLoopOptions<Message, Final>,
): Promise<AgentLoopResult<Message, Final>> {
  return runAgentLoopFromState(options, {
    history: [...options.history], steps: 0, toolCalls: 0, toolResults: [], seenIds: new Set<string>(),
  });
}

/** Continue a user-approved or user-declined tool call using its actual execution result. */
export async function resumeAgentLoop<Message, Final>(
  options: AgentLoopOptions<Message, Final>,
  continuation: AgentLoopContinuation<Message>,
  execution: AgentToolExecution,
): Promise<AgentLoopResult<Message, Final>> {
  const result: AgentToolCallResult = {
    toolCallId: continuation.call.id,
    toolName: continuation.call.name,
    execution: checkedExecution(execution),
  };
  const history = options.appendToolRound(continuation.history, continuation.assistantMessage, [result]);
  return runAgentLoopFromState(options, {
    history,
    steps: continuation.steps,
    toolCalls: continuation.toolCalls,
    toolResults: [...continuation.toolResults, result],
    seenIds: new Set(continuation.seenIds),
  });
}

type AgentLoopState<Message> = {
  history: Message[];
  steps: number;
  toolCalls: number;
  toolResults: AgentToolCallResult[];
  seenIds: Set<string>;
};

async function runAgentLoopFromState<Message, Final>(
  options: AgentLoopOptions<Message, Final>,
  state: AgentLoopState<Message>,
): Promise<AgentLoopResult<Message, Final>> {
  const maxSteps = boundedLimit(options.maxSteps, DEFAULT_AGENT_MAX_STEPS, MAX_AGENT_STEPS, 'maxSteps', 0);
  const maxToolCalls = boundedLimit(options.maxToolCalls, DEFAULT_AGENT_MAX_TOOL_CALLS, MAX_AGENT_TOOL_CALLS, 'maxToolCalls', 0);
  let { history, steps, toolCalls, toolResults, seenIds } = state;

  while (true) {
    if (options.signal?.aborted) return loopResult('cancelled', history, toolResults, steps, toolCalls);
    let turn: AgentModelTurn<Message, Final>;
    try {
      turn = await options.requestModel(history, options.signal);
    } catch (error) {
      if (options.signal?.aborted) return loopResult('cancelled', history, toolResults, steps, toolCalls);
      throw error;
    }
    if (options.signal?.aborted) return loopResult('cancelled', history, toolResults, steps, toolCalls);
    if (turn.kind === 'final') {
      return {
        status: 'final', response: turn.response, history, toolResults, steps, toolCalls,
        actionOutcome: summarizeActionOutcome(toolResults),
      };
    }
    if (turn.kind !== 'tool_calls' || !Array.isArray(turn.calls) || turn.calls.length === 0) {
      throw new Error('Invalid agent turn: expected at least one tool call or a final response.');
    }
    if (turn.calls.length > MAX_AGENT_TOOL_CALLS_PER_TURN) {
      throw new Error(`Invalid agent turn: at most ${MAX_AGENT_TOOL_CALLS_PER_TURN} tool calls are allowed per turn.`);
    }
    validateCalls(turn.calls, seenIds);
    const confirmationRequired = new Set(options.confirmationRequiredToolNames ?? []);
    if (turn.calls.length > 1 && turn.calls.some(call => confirmationRequired.has(call.name))) {
      const results = turn.calls.map(call => ({
        toolCallId: call.id,
        toolName: call.name,
        execution: { status: 'failed', mutation: 'none', error: 'Confirmation-gated tools must be called alone; no calls in this round were executed.' } as AgentToolExecution,
      }));
      toolResults.push(...results);
      history = options.appendToolRound(history, turn.assistantMessage, results);
      return loopResult('invalid_tool_round', history, toolResults, steps, toolCalls);
    }

    // A zero round budget still lets the model answer normally, but none of its tools run.
    if (steps >= maxSteps) {
      const results = turn.calls.map(call => ({
        toolCallId: call.id,
        toolName: call.name,
        execution: { status: 'failed', mutation: 'none', error: 'Step limit reached; this call was not executed.' } as AgentToolExecution,
      }));
      toolResults.push(...results);
      history = options.appendToolRound(history, turn.assistantMessage, results);
      return loopResult('step_limit', history, toolResults, steps, toolCalls);
    }

    steps += 1;
    const results: AgentToolCallResult[] = [];
    let overToolLimit = false;
    let wasCancelled = false;
    // Never run calls in parallel: each result is based on the state left by the previous operation.
    for (const call of turn.calls) {
      let execution: AgentToolDispatchResult;
      if (options.signal?.aborted) {
        wasCancelled = true;
        execution = { status: 'failed', mutation: 'none', error: 'Agent run cancelled before this call was executed.' };
      } else if (toolCalls >= maxToolCalls) {
        overToolLimit = true;
        execution = { status: 'failed', mutation: 'none', error: 'Tool call limit reached; this call was not executed.' };
      } else {
        toolCalls += 1;
        try {
          execution = checkedDispatchResult(await options.executeTool(call, options.signal));
        } catch (error) {
          execution = { status: 'failed', mutation: 'unknown', error: errorMessage(error) };
        }
        if (options.signal?.aborted) wasCancelled = true;
      }
      if (execution.status === 'requires_confirmation') {
        if (turn.calls.length !== 1) throw new Error('A confirmation-gated tool unexpectedly shared a provider round.');
        return {
          status: 'awaiting_confirmation', history, toolResults, steps, toolCalls,
          actionOutcome: summarizeActionOutcome(toolResults),
          proposal: execution.proposal,
          continuation: {
            history: [...history], assistantMessage: turn.assistantMessage, call,
            toolResults: [...toolResults], steps, toolCalls, seenIds: [...seenIds],
          },
        };
      }
      results.push({ toolCallId: call.id, toolName: call.name, execution });
    }

    toolResults.push(...results);
    history = options.appendToolRound(history, turn.assistantMessage, results);

    if (wasCancelled || options.signal?.aborted) return loopResult('cancelled', history, toolResults, steps, toolCalls);
    if (overToolLimit) return loopResult('tool_limit', history, toolResults, steps, toolCalls);
    if (steps >= maxSteps) return loopResult('step_limit', history, toolResults, steps, toolCalls);
  }
}

export function summarizeActionOutcome(results: readonly AgentToolCallResult[]): AgentActionOutcome {
  if (results.length === 0) return 'no_tools';
  const failures = results.filter(result => result.execution.status === 'failed');
  if (failures.length > 0) {
    const anyPossibleChange = results.some(result => result.execution.mutation === 'applied'
      || result.execution.mutation === 'partial' || result.execution.mutation === 'unknown');
    return anyPossibleChange ? 'partially_failed' : 'failed';
  }
  return results.some(result => result.execution.mutation === 'applied') ? 'succeeded' : 'no_mutation';
}

function loopResult<Message, Final>(
  status: 'step_limit' | 'tool_limit' | 'cancelled' | 'invalid_tool_round',
  history: Message[],
  toolResults: AgentToolCallResult[],
  steps: number,
  toolCalls: number,
): AgentLoopResult<Message, Final> {
  return { status, history, toolResults, steps, toolCalls, actionOutcome: summarizeActionOutcome(toolResults) };
}

function boundedLimit(value: number | undefined, fallback: number, hardMaximum: number, name: string, minimum: number): number {
  const limit = value ?? fallback;
  if (!Number.isInteger(limit) || limit < minimum || limit > hardMaximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${hardMaximum}.`);
  }
  return limit;
}

function validateCalls(calls: readonly AgentToolCall[], seenIds: Set<string>): void {
  for (const call of calls) {
    if (!call || typeof call.id !== 'string' || call.id.trim() === '' || typeof call.name !== 'string' || call.name.trim() === '') {
      throw new Error('Invalid agent tool call: each call needs a non-empty id and name.');
    }
    if (seenIds.has(call.id)) throw new Error(`Invalid agent tool call: duplicate call id ${call.id}.`);
    seenIds.add(call.id);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkedDispatchResult(value: unknown): AgentToolDispatchResult {
  if (typeof value === 'object' && value !== null && (value as { status?: unknown }).status === 'requires_confirmation') {
    const confirmation = value as { status: 'requires_confirmation'; proposal?: unknown };
    if (Object.hasOwn(confirmation, 'proposal')) return confirmation as AgentToolConfirmation;
    return { status: 'failed', mutation: 'unknown', error: 'Tool returned an invalid confirmation proposal.' };
  }
  return checkedExecution(value);
}

function checkedExecution(value: unknown): AgentToolExecution {
  if (typeof value !== 'object' || value === null) {
    return { status: 'failed', mutation: 'unknown', error: 'Tool returned an invalid execution result.' };
  }
  const execution = value as Partial<AgentToolExecution>;
  if (execution.status === 'succeeded'
    && (execution.mutation === 'none' || execution.mutation === 'applied')
    && Object.hasOwn(execution, 'result')) {
    return execution as AgentToolExecution;
  }
  if (execution.status === 'failed'
    && (execution.mutation === 'none' || execution.mutation === 'partial' || execution.mutation === 'unknown')
    && typeof execution.error === 'string') {
    return execution as AgentToolExecution;
  }
  return { status: 'failed', mutation: 'unknown', error: 'Tool returned an invalid execution result.' };
}
