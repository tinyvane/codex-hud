import WebSocket from 'ws';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseMessage, isNotification, isResponse } from './schema.js';
import type {
  GetAccountRateLimitsResponse,
  JsonRpcNotification,
  InitializeParams,
  InitializeResult,
} from './schema.js';

export const DEFAULT_SOCKET_PATH = join(
  homedir(),
  '.codex',
  'app-server-control',
  'app-server-control.sock',
);

export interface AppServerClientOptions {
  socketPath?: string;
  onNotification: (n: JsonRpcNotification) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (err: Error) => void;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class AppServerClient {
  private readonly socketPath: string;
  private readonly opts: AppServerClientOptions;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (r: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private reconnectDelay = RECONNECT_BASE_MS;
  private stopped = false;

  constructor(opts: AppServerClientOptions) {
    this.socketPath = opts.socketPath ?? DEFAULT_SOCKET_PATH;
    this.opts = opts;
  }

  start(): void {
    this.stopped = false;
    this.reconnectDelay = RECONNECT_BASE_MS;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    for (const { reject, timer } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('Client stopped'));
    }
    this.pendingRequests.clear();
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    const ws = new WebSocket('ws://localhost', { socketPath: this.socketPath });
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.initialize()
        .then(() => {
          this.opts.onConnected?.();
          void this.publishRateLimitsSnapshot().catch((err: Error) => {
            this.opts.onError?.(new Error(`rate-limit read failed: ${err.message}`));
          });
        })
        .catch((err: Error) => {
          this.opts.onError?.(new Error(`initialize failed: ${err.message}`));
          ws.close();
        });
    });

    ws.on('message', (data: WebSocket.RawData) => {
      this.handleRaw(data.toString());
    });

    ws.on('error', (err: Error) => {
      this.opts.onError?.(err);
    });

    ws.on('close', () => {
      this.ws = null;
      // Reject any in-flight requests
      for (const { reject, timer } of this.pendingRequests.values()) {
        clearTimeout(timer);
        reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();
      this.opts.onDisconnected?.();
      if (!this.stopped) {
        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
        setTimeout(() => this.connect(), delay);
      }
    });
  }

  private sendRaw(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private call(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.sendRaw({ jsonrpc: '2.0', id, method, params });
    });
  }

  private async initialize(): Promise<InitializeResult> {
    const params: InitializeParams = {
      clientInfo: { name: 'codex-hud', title: 'Codex HUD', version: '0.0.1' },
      capabilities: { experimentalApi: true },
    };
    const result = (await this.call('initialize', params)) as InitializeResult;
    // Acknowledge initialization before any other method calls
    this.sendRaw({ jsonrpc: '2.0', method: 'initialized' });
    return result;
  }

  private async publishRateLimitsSnapshot(): Promise<void> {
    const result = (await this.call('account/rateLimits/read')) as GetAccountRateLimitsResponse;
    this.opts.onNotification({
      jsonrpc: '2.0',
      method: 'account/rateLimits/updated',
      params: { rateLimits: result.rateLimits },
    });
  }

  private handleRaw(raw: string): void {
    const msg = parseMessage(raw);
    if (!msg) return;

    if (isResponse(msg)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if ('error' in msg) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    if (isNotification(msg)) {
      this.opts.onNotification(msg);
    }
  }
}
