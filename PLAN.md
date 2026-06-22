# Codex HUD Development Plan

## Status

M0 complete. M1 complete. M2 complete. M3 implementation complete; integration tests with live daemon pending. M4 active: marketplace runtime acceptance and native TUI setup, including project identity and account usage limits.

## Objective

Build a reliable, cross-platform HUD for OpenAI Codex that can show useful live
session information without depending on Claude Code-specific contracts.

Initial information targets:

- active model and reasoning mode
- context and token usage
- current project and Git status
- tool activity and failures
- subagent activity
- session identity and duration
- Codex and HUD versions

## Architecture Direction

Use an event-driven design with explicit boundaries:

```text
Codex config / hooks / App Server
                 |
                 v
        provider-specific adapter
                 |
                 v
          normalized HUD state
                 |
                 v
       renderer / output surface
```

The normalized state must not contain raw App Server or hook payloads. Rendering
must be testable without starting Codex.

## Technology Decisions (resolved in M0)

- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript 5.x (strict mode, NodeNext modules)
- **Package manager**: pnpm 9+
- **Test framework**: Vitest 2.x + @vitest/coverage-v8
- **Linting**: ESLint 9 (flat config) + @typescript-eslint
- **Formatting**: Prettier 3
- **TOML parsing**: smol-toml (zero-dependency, TOML 1.0)
- **Build**: tsc (tsconfig.build.json, src/ only)

## Integration Surface Decisions (resolved in M0)

Three Codex surfaces were compared:

| Surface | Richness | Complexity | Real-time |
|---------|----------|------------|-----------|
| `tui.status_line` identifiers | Limited (identifiers undocumented) | Low | Yes |
| Lifecycle hooks | 9 event types, session/turn/tool data | Medium | Per-event |
| App Server (JSON-RPC 2.0) | Full thread/turn/item/token stream | High | Yes |

**Decision**: Lifecycle hooks are the primary M2 data source. The App Server
client is deferred to M3. The native `tui.status_line` will be configured as a
fallback alongside the hook-based display.

**Output surface**: Hooks write normalized state to `~/.codex-hud/state.json`.
A `codex-hud status` command reads that file and prints to stdout. A companion
display (terminal pane, watch mode) is deferred until M2 experimentation.

## Product Modes To Evaluate

1. Native mode: configure and complement Codex's built-in TUI status line.
2. Rich mode: consume supported App Server events for detailed live state.
3. Hook-assisted mode: use lifecycle hooks where they provide information or
   enforcement that App Server clients cannot obtain reliably.

The project must not promise a custom multi-line footer until a supported output
surface has been verified experimentally.

## Source Layout

```
src/
  adapter/hooks/
    schema.ts       Raw Codex hook payload types (9 event variants)
    handler.ts      stdin -> git enrichment -> state-file update -> stdout response
  state/
    types.ts        Normalized HUD state interface + INITIAL_STATE (includes gitBranch)
    reducer.ts      Pure (state, event, now) -> state
    store.ts        Atomic state-file read / write (~/.codex-hud/state.json)
  renderer/
    sanitize.ts     Strip control chars, reset ANSI
    format.ts       Duration and token formatters
    status-line.ts  Compose printable status-line string (model @branch time tok tool turns)
  config/
    detect.ts       Locate ~/.codex/ and report install status
    codex.ts        Safe config.toml read / write with backup
  git.ts            Walk .git/HEAD up the directory tree to find branch name
  install.ts        Pure merge/remove helpers + install/uninstall I/O commands
  cli.ts            Entry point: hook, status, install, uninstall, verify, --version
tests/
  fixtures/hooks/   Representative hook payloads (JSON)
  state/            reducer unit tests
  renderer/         sanitize, format, status-line unit tests
  adapter/          hook parsing + malformed-input unit tests
  git.test.ts       Temp-dir tests for branch detection and parent-dir walk
  install.test.ts   Pure helper unit tests (merge, remove, idempotency)
```

## Milestones

### M0: Feasibility And Contracts

- [x] Document supported Codex status-line fields and limitations.
- [x] Capture representative lifecycle hook payloads.
- [x] Compare native, companion-process, and wrapper-based display approaches.
- [x] Decide the initial output surface and write an architecture decision.
- [x] Define supported Codex versions and platform scope for the MVP.
- [ ] Generate and inspect App Server schemas from the installed Codex version.

Exit criterion: a small prototype receives supported Codex events and displays a
live state update without parsing undocumented terminal output.

### M1: Project Foundation

- [x] Select the runtime, package manager, and test framework.
- [x] Add formatting, linting, type checking, tests, and reproducible builds.
- [x] Define and validate the normalized HUD state.
- [x] Add sanitized terminal rendering primitives.
- [x] Add event fixtures and malformed-input tests.
- [x] Add CI for Windows, macOS, and Linux.

Exit criterion: the core state reducer and renderer pass tests independently of
Codex.

### M2: Native MVP

- [x] Detect Codex installation and relevant configuration locations.
- [x] Read and safely update Codex configuration with backup and rollback.
- [x] Implement the selected MVP display surface.
- [x] Show model, Git branch, session duration, tool activity, turns, agents, and version.
- [x] Document installation, upgrade, troubleshooting, and uninstall steps.

Exit criterion: a new user can install, verify, and remove the MVP safely.

### M3: Rich Telemetry

- [x] Add an App Server client using generated schemas.
- [x] Track turns, tool calls, failures, token usage, and subagents.
- [x] Handle reconnect, resume, compaction, malformed events, and shutdown.
- [ ] Bound memory, cache size, and rendering frequency.
- [ ] Add integration tests with recorded event streams (requires live daemon).

Exit criterion: the HUD remains correct through a representative full session
and recovers from transport interruptions.

### M4: Packaging And Release

- [x] Decide whether a Codex plugin is the primary distribution mechanism.
- [x] Package the CLI, lifecycle hooks, and operator workflow as a self-contained Codex plugin.
- [x] Add a repository marketplace and validate install, update, and uninstall behavior.
- [x] Add versioning, changelog, release verification, and supply-chain checks.
- [ ] Verify plugin hooks through a real App Server session on Windows, macOS, and Linux.
- [x] Configure the supported native TUI status line through an explicit, reversible setup command.
- [x] Include the current project directory name in the native TUI status line.
- [x] Include native primary and secondary account usage remaining fields in the TUI status line.
- [ ] Publish a `0.1.x` release only after MVP acceptance criteria pass.
- [ ] Gather compatibility feedback before declaring stable support.

The plugin is the primary Codex distribution mechanism. It bundles lifecycle
hooks and a dependency-free CLI artifact so marketplace installation does not
depend on a separately installed global npm command. The npm package remains a
development and standalone fallback.

## Deferred Decisions

- Exact terminal UI or companion UI framework.
- Whether hooks are required or optional.
- Whether state persists between Codex sessions.
- Whether reusable pieces should later move into `agent-hud-core`.
- Whether to provide interoperability with `claude-hud` configuration.

## Non-Goals For The First Release

- Exact visual parity with Claude HUD.
- Parsing Claude Code transcripts or settings.
- Parsing Codex screen output or undocumented internal files as the primary API.
- Sharing code across repositories before both implementations prove the shared
  contract.
- Editing user configuration without backup, validation, and rollback guidance.
