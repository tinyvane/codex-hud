// Raw Codex lifecycle hook payload types.
// Source: https://developers.openai.com/codex/hooks

export type HookEventName =
  | 'SessionStart'
  | 'SubagentStart'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PreCompact'
  | 'PostCompact'
  | 'UserPromptSubmit'
  | 'SubagentStop'
  | 'Stop';

export interface HookCommonFields {
  session_id: string;
  cwd: string;
  hook_event_name: HookEventName;
  model: string;
  transcript_path: string;
}

export interface TurnScopedFields extends HookCommonFields {
  turn_id: string;
  permission_mode: string;
}

export interface SessionStartPayload extends HookCommonFields {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
}

export interface SubagentStartPayload extends HookCommonFields {
  hook_event_name: 'SubagentStart';
  agent_id: string;
  agent_type: string;
  turn_id: string;
}

export interface PreToolUsePayload extends TurnScopedFields {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
}

export interface PermissionRequestPayload extends TurnScopedFields {
  hook_event_name: 'PermissionRequest';
  tool_name: string;
  tool_input: unknown;
}

export interface PostToolUsePayload extends TurnScopedFields {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
}

export interface PreCompactPayload extends TurnScopedFields {
  hook_event_name: 'PreCompact';
  trigger: 'manual' | 'auto';
}

export interface PostCompactPayload extends TurnScopedFields {
  hook_event_name: 'PostCompact';
  trigger: 'manual' | 'auto';
}

export interface UserPromptSubmitPayload extends TurnScopedFields {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

export interface SubagentStopPayload extends TurnScopedFields {
  hook_event_name: 'SubagentStop';
  agent_id: string;
  agent_type: string;
  last_assistant_message: string;
}

export interface StopPayload extends TurnScopedFields {
  hook_event_name: 'Stop';
  last_assistant_message: string;
  stop_hook_active: boolean;
}

export type HookPayload =
  | SessionStartPayload
  | SubagentStartPayload
  | PreToolUsePayload
  | PermissionRequestPayload
  | PostToolUsePayload
  | PreCompactPayload
  | PostCompactPayload
  | UserPromptSubmitPayload
  | SubagentStopPayload
  | StopPayload;

// Hook stdout response (Codex reads this after command hook exits)
export interface HookResponse {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  additionalContext?: string;
  decision?: string;
}
