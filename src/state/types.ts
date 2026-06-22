export const HUD_VERSION = '0.1.4';

export interface TokenUsage {
  inputUsed: number;
  outputUsed: number;
  contextLimit: number | null;
}

export interface HudState {
  sessionId: string | null;
  sessionStart: number | null;
  model: string | null;
  cwd: string | null;
  gitBranch: string | null;
  tokens: TokenUsage;
  activeTool: string | null;
  lastToolName: string | null;
  lastToolStatus: 'success' | 'error' | null;
  turnCount: number;
  subagentCount: number;
  lastEvent: string | null;
  lastUpdated: number;
  hudVersion: string;
  appServerConnected: boolean;
}

export const INITIAL_STATE: HudState = {
  sessionId: null,
  sessionStart: null,
  model: null,
  cwd: null,
  gitBranch: null,
  tokens: { inputUsed: 0, outputUsed: 0, contextLimit: null },
  activeTool: null,
  lastToolName: null,
  lastToolStatus: null,
  turnCount: 0,
  subagentCount: 0,
  lastEvent: null,
  lastUpdated: 0,
  hudVersion: HUD_VERSION,
  appServerConnected: false,
};
