// JSON-RPC 2.0 base types and Codex App Server notification schemas.
// Source: https://developers.openai.com/codex/app-server

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 primitives
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return 'method' in msg && !('id' in msg);
}

export function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && !('method' in msg);
}

// Parse a raw string into a JSON-RPC message; returns null for invalid input.
export function parseMessage(raw: string): JsonRpcMessage | null {
  try {
    const msg = JSON.parse(raw) as unknown;
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return null;
    const obj = msg as Record<string, unknown>;
    if (obj['jsonrpc'] !== '2.0') return null;
    return obj as unknown as JsonRpcMessage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// App Server initialize
// ---------------------------------------------------------------------------

export interface InitializeParams {
  clientInfo: {
    name: string;
    title: string;
    version: string;
  };
  capabilities?: {
    experimentalApi?: boolean;
    optOutNotificationMethods?: string[];
  };
}

export interface InitializeResult {
  userAgent?: string;
  codexHome?: string;
  platformFamily?: string;
  platformOs?: string;
}

// Generated protocol inputs:
// schemas/app-server/0.141.0/{GetAccountRateLimitsResponse,AccountRateLimitsUpdatedNotification}.json
export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface RateLimitSnapshot {
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
}

export interface GetAccountRateLimitsResponse {
  rateLimits: RateLimitSnapshot;
}

export interface AccountRateLimitsUpdatedParams {
  rateLimits: RateLimitSnapshot;
}

// ---------------------------------------------------------------------------
// App Server notification param shapes
// ---------------------------------------------------------------------------

export interface TokenUsageParams {
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    contextLimit?: number | null;
  };
}

export interface TurnStartedParams {
  turn: { id: string; status: string };
}

export interface TurnCompletedParams {
  turn: {
    id: string;
    status: 'completed' | 'interrupted' | 'failed';
    error?: string;
  };
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

// Item types observed from App Server events
export type ItemType =
  | 'toolCall'
  | 'commandExecution'
  | 'fileChange'
  | 'agentMessage'
  | 'reasoning';

export interface ItemStartedParams {
  item: {
    id: string;
    type: ItemType | string;
    status: string;
    tool?: string;
    toolName?: string;
    command?: string;
  };
}

export interface ItemCompletedParams {
  item: {
    id: string;
    type: ItemType | string;
    status: 'completed' | 'failed' | 'canceled' | string;
    tool?: string;
    toolName?: string;
  };
}
