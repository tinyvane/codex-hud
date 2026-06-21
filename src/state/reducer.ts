import type { HookPayload } from '../adapter/hooks/schema.js';
import type { HudState } from './types.js';

// Pure function: (current state, hook event, timestamp) -> next state.
// Does not perform I/O.
export function reduce(state: HudState, event: HookPayload, now: number): HudState {
  const base: Partial<HudState> = {
    lastEvent: event.hook_event_name,
    lastUpdated: now,
    model: event.model || state.model,
    cwd: event.cwd || state.cwd,
    sessionId: event.session_id || state.sessionId,
  };

  switch (event.hook_event_name) {
    case 'SessionStart':
      return {
        ...state,
        ...base,
        sessionStart: now,
        turnCount: 0,
        subagentCount: 0,
        activeTool: null,
        lastToolName: null,
        lastToolStatus: null,
      };

    case 'SubagentStart':
      return {
        ...state,
        ...base,
        subagentCount: state.subagentCount + 1,
      };

    case 'SubagentStop':
      return { ...state, ...base };

    case 'PreToolUse':
      return {
        ...state,
        ...base,
        activeTool: event.tool_name,
      };

    case 'PermissionRequest':
      return { ...state, ...base };

    case 'PostToolUse':
      return {
        ...state,
        ...base,
        activeTool: null,
        lastToolName: event.tool_name,
        lastToolStatus: 'success',
      };

    case 'UserPromptSubmit':
      return { ...state, ...base };

    case 'PreCompact':
    case 'PostCompact':
      return { ...state, ...base };

    case 'Stop':
      return {
        ...state,
        ...base,
        activeTool: null,
        turnCount: state.turnCount + 1,
      };
  }
}
