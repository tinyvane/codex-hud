// Maps Codex App Server JSON-RPC notifications to HUD state patches.
// All functions here are pure (no I/O) for independent testability.

import type {
  JsonRpcNotification,
  TokenUsageParams,
  TurnCompletedParams,
  ItemStartedParams,
  ItemCompletedParams,
  AccountRateLimitsUpdatedParams,
} from './schema.js';
import type { HudState, RateLimitWindowState } from '../../state/types.js';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function mergeRateLimitWindow(
  current: RateLimitWindowState | null,
  value: unknown,
): RateLimitWindowState | null {
  if (!isRecord(value) || !isIntegerInRange(value['usedPercent'], 0, 100)) return current;

  const duration = value['windowDurationMins'];
  const reset = value['resetsAt'];
  return {
    usedPercent: value['usedPercent'],
    windowDurationMins: isIntegerInRange(duration, 1, Number.MAX_SAFE_INTEGER)
      ? duration
      : (current?.windowDurationMins ?? null),
    resetsAt: isIntegerInRange(reset, 1, Number.MAX_SAFE_INTEGER)
      ? reset
      : (current?.resetsAt ?? null),
  };
}

function applyRateLimits(state: HudState, params: unknown, now: number): HudState {
  if (!isRecord(params) || !isRecord(params['rateLimits'])) return state;

  const rateLimits = params[
    'rateLimits'
  ] as unknown as AccountRateLimitsUpdatedParams['rateLimits'];
  const primary = mergeRateLimitWindow(state.rateLimits.primary, rateLimits.primary);
  const secondary = mergeRateLimitWindow(state.rateLimits.secondary, rateLimits.secondary);
  if (primary === state.rateLimits.primary && secondary === state.rateLimits.secondary)
    return state;

  return {
    ...state,
    lastUpdated: now,
    rateLimits: { primary, secondary },
  };
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
    case 'account/rateLimits/updated':
      return applyRateLimits(state, notification.params, now);

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
