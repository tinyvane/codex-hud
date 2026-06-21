import { sanitize, withReset } from './sanitize.js';
import { formatDuration, formatTokens } from './format.js';
import type { HudState } from '../state/types.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const SEP = `${DIM} | ${RESET}`;

export function renderStatusLine(state: HudState, now: number): string {
  const parts: string[] = [];

  if (state.model) {
    parts.push(`${CYAN}${sanitize(state.model)}${RESET}`);
  }

  if (state.gitBranch) {
    parts.push(`${DIM}@${sanitize(state.gitBranch)}${RESET}`);
  }

  if (state.sessionStart !== null) {
    parts.push(`${YELLOW}${formatDuration(now - state.sessionStart)}${RESET}`);
  }

  const totalTokens = state.tokens.inputUsed + state.tokens.outputUsed;
  if (totalTokens > 0) {
    parts.push(`tok:${formatTokens(totalTokens)}`);
  }

  if (state.activeTool) {
    parts.push(`${MAGENTA}> ${sanitize(state.activeTool)}${RESET}`);
  } else if (state.lastToolName) {
    const icon = state.lastToolStatus === 'error' ? `${RED}x${RESET}` : `${GREEN}+${RESET}`;
    parts.push(`${icon} ${sanitize(state.lastToolName)}`);
  }

  if (state.turnCount > 0) {
    parts.push(`turns:${state.turnCount}`);
  }

  if (state.subagentCount > 0) {
    parts.push(`agents:${state.subagentCount}`);
  }

  parts.push(`${DIM}v${sanitize(state.hudVersion)}${RESET}`);

  return withReset(parts.join(SEP));
}
