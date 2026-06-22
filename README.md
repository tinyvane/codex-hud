# Codex HUD

An independent heads-up display for OpenAI Codex.

> Status: `0.1.1` marketplace plugin candidate.

## Why A Separate Project?

Claude Code and Codex expose different configuration, lifecycle, session, and
display interfaces. This repository starts from Codex's supported surfaces rather
than adapting Claude-specific stdin and transcript contracts.

## Goals

- Present useful live context without obscuring the coding workflow.
- Use supported Codex configuration, hooks, plugins, and App Server interfaces.
- Keep event ingestion, normalized state, and rendering independently testable.
- Work safely across Windows, macOS, and Linux.
- Provide reversible installation and configuration changes.
- Fail quietly and clearly without breaking a Codex session.

## Status Line Format

```
o3 @main 2m30s | > Bash | turns:4 | v0.0.1
```

Fields (left to right):

| Field | Description |
|-------|-------------|
| Model | Active model name from Codex session |
| `@branch` | Git branch detected at session start |
| Duration | Elapsed time since session started |
| `tok:N` | Total tokens used (input + output, shown when non-zero) |
| `> Tool` | Tool currently executing |
| `+ Tool` / `x Tool` | Last completed tool (green + or red x) |
| `turns:N` | Completed turns this session |
| `agents:N` | Subagents spawned (shown when non-zero) |
| Version | codex-hud version |

## Marketplace Installation

### Prerequisites

- Node.js 20 or later
- OpenAI Codex CLI with plugin support, installed and on your PATH

### 1. Add the marketplace

```bash
codex plugin marketplace add tinyvane/codex-hud
```

### 2. Install the plugin

```bash
codex plugin add codex-hud@codex-hud
```

The plugin includes its runtime, skill, and lifecycle hooks. It does not require
a global npm installation and does not edit `~/.codex/hooks.json`.

### 3. Trust and load the hooks

Start Codex, open `/hooks`, review the six Codex HUD hook definitions, and trust
them. Start a new thread after installation so Codex loads the plugin skill and
hooks.

### 4. Verify

Ask `@codex-hud Verify that Codex HUD is working.` The skill runs the bundled
runtime and reports Codex, hook, and state health.

### Migrating from 0.1.0

Version `0.1.0` incorrectly used the generic marketplace name `personal`. If
`codex plugin marketplace list` shows that `personal` points to this repository,
migrate it before reinstalling:

```bash
codex plugin remove codex-hud@personal
codex plugin marketplace remove personal
codex plugin marketplace add tinyvane/codex-hud
codex plugin add codex-hud@codex-hud
```

Do not remove `personal` when it points to a different marketplace.

Healthy output:

```
Codex:   installed  (~/.codex/)
Hooks:   bundled with installed plugin (review with /hooks)
State:   ~/.codex-hud/state.json  (updated 3s ago)
Model:   o3
Branch:  main
Session: 2m30s  |  turns: 4  |  agents: 0
```

### 5. Show the status line

Ask `@codex-hud Show my current Codex HUD status.`

Example output (ANSI-colored in a real terminal):

```
o3 @main 2m30s | > Bash | turns:3 | v0.0.1
```

For a stable shell or tmux integration, use the standalone installation below
and call `codex-hud status`:

```bash
# bash / zsh prompt
PS1='$(codex-hud status 2>/dev/null) $ '

# tmux status-right
set -g status-right '#(codex-hud status 2>/dev/null)'
```

### 6. Live telemetry

The optional watcher consumes the experimental App Server WebSocket/Unix-socket
transport. Start App Server with an explicit supported local transport before
asking `@codex-hud` to run the watcher.

```bash
codex app-server --listen unix://
```

The lifecycle-hook HUD works without the watcher.

## Standalone Installation

Node.js 20+ and pnpm 9 or 10 are required for source development or a global CLI:

```bash
git clone https://github.com/tinyvane/codex-hud
cd codex-hud
pnpm install --frozen-lockfile
pnpm build
pnpm link --global
codex-hud install
```

Standalone `install` backs up and updates the user-level Codex hooks file. It is
idempotent and remains available for terminal integrations that need a stable
global command.

## Uninstall

```bash
codex plugin remove codex-hud@codex-hud
```

For a standalone installation, `codex-hud uninstall` removes only Codex HUD
entries from `~/.codex/hooks.json`. Other hooks and backup files are preserved.

## Troubleshooting

**HUD shows no data after starting Codex:**
1. Start a new thread after installing the plugin.
2. Open `/hooks` and confirm the Codex HUD hooks are trusted.
3. Ask `@codex-hud` to run verification.

**`codex-hud install` reports Codex not found:**
Install the Codex CLI and confirm `~/.codex/` exists, then re-run install.

**The optional watcher cannot connect:**
Start `codex app-server` with the same local transport expected by the watcher.

**Restoring a backup:**
```bash
cp ~/.codex/hooks.json.bak ~/.codex/hooks.json
cp ~/.codex/config.toml.bak ~/.codex/config.toml
```

## Planned Information

- model and reasoning mode
- context and token usage
- project and Git state
- active and completed tools
- subagent activity
- session duration and identity
- Codex and HUD versions

Actual fields depend on what the supported Codex interfaces expose reliably.

## Development

Read these files before implementation:

- `AGENTS.md` contains repository rules and quality requirements.
- `PLAN.md` contains milestones, acceptance criteria, and deferred decisions.

```bash
pnpm install       # install dependencies
pnpm build         # compile TypeScript
pnpm validate:plugin # validate the built marketplace artifact
pnpm test          # run tests
pnpm typecheck     # type check
pnpm lint          # lint
```

## Relationship To Claude HUD

This repository is independent from `claude-hud`. It may use similar visual ideas,
but it will not import Claude Code settings, stdin types, or transcript formats.
Common utilities should only be extracted after duplicated, stable behavior has
been identified.

## Official References

- [Codex configuration](https://developers.openai.com/codex/config-reference/)
- [Codex hooks](https://developers.openai.com/codex/hooks/)
- [Codex App Server](https://developers.openai.com/codex/app-server/)
- [Building Codex plugins](https://developers.openai.com/codex/plugins/build/)

## License

MIT
