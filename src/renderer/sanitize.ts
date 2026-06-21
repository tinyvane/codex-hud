// Sanitize strings before writing to the terminal.
// Strips ANSI escape sequences and C0/C1 control characters so that untrusted
// event payloads (model names, tool names, cwd) cannot inject terminal commands.
// Newline (0x0a) and tab (0x09) are preserved; all other control bytes are removed.

const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b[()][AB012]/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/g;

export function sanitize(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, '').replace(CONTROL_CHAR_RE, '');
}

// Wrap styled text with a trailing full ANSI reset so stray styles cannot
// bleed into the calling process's terminal state.
export function withReset(text: string): string {
  return `${text}\x1b[0m`;
}
