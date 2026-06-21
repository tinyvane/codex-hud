// Maps Codex App Server JSON-RPC notifications to HUD state patches.
// All functions here are pure (no I/O) for independent testability.

import type {
  JsonRpcNotification,
  TokenUsageParams,
  TurnCompletedParams,
  ItemStartedParams,
  ItemCompletedParams,
} from './schema.js';
import type { HudState } from '../../state/types.js';

const TOOL_ITEM_TYPES = new Set(['toolCall', 'commandExecution']);

function isToolItem(type: string): boolean {
  return TOOL_ITEM_TYPES.has(type);
}

// Derive a display name from an item payload
function toolNameFromItem(
  item: ItemStartedParams['item'] | ItemCompletedParams['item'],
): string | null {
  return item.tool ?? item.toolName ?? null;
}

// Apply a single App Server notification to the current state.
// Returns the same state reference if no relevant fields changed.
export function applyNotification(
  state: HudState,
  notification: JsonRpcNotification,
  now: number,
): HudState {
  const base: Pick<HudState, 'lastUpdated'> = { lastUpdated: now };

  switch (notification.method) {
    case 'thread/tokenUsage/updated': {
      const p = notification.params as TokenUsageParams;
      return {
        ...state,
        ...base,
        tokens: {
          inputUsed: p.usage.inputTokens ?? state.tokens.inputUsed,
          outputUsed: p.usage.outputTokens ?? state.tokens.outputUsed,
          contextLimit:
            p.usage.contextLimit !== undefined ? p.usage.contextLimit : state.tokens.contextLimit,
        },
      };
    }

    case 'turn/started':
      return { ...state, ...base };

    case 'turn/completed': {
      const p = notification.params as TurnCompletedParams;
      const next: HudState = {
        ...state,
        ...base,
        activeTool: null,
        turnCount: state.turnCount + 1,
      };
      // Absorb token usage snapshot if included in the turn completion
      if (p.tokenUsage) {
        next.tokens = {
          inputUsed: p.tokenUsage.inputTokens ?? state.tokens.inputUsed,
          outputUsed: p.tokenUsage.outputTokens ?? state.tokens.outputUsed,
          contextLimit: state.tokens.contextLimit,
        };
      }
      return next;
    }

    case 'item/started': {
      const p = notification.params as ItemStartedParams;
      if (!isToolItem(p.item.type)) return { ...state, ...base };
      return { ...state, ...base, activeTool: toolNameFromItem(p.item) };
    }

    case 'item/completed': {
      const p = notification.params as ItemCompletedParams;
      if (!isToolItem(p.item.type)) return { ...state, ...base };
      return {
        ...state,
        ...base,
        activeTool: null,
        lastToolName: toolNameFromItem(p.item),
        lastToolStatus: p.item.status === 'failed' ? 'error' : 'success',
      };
    }

    default:
      return state;
  }
}
