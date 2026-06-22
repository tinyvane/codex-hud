---
name: codex-hud
description: Inspect, verify, explain, or operate the installed Codex HUD plugin and its local session status.
---

# Codex HUD

Use the runtime bundled with this plugin. Do not assume a global `codex-hud`
command exists.

## Locate the runtime

Find the plugin root by walking up from this `SKILL.md` until
`.codex-plugin/plugin.json` is present. The CLI entry point is
`<plugin-root>/dist/cli.js`. Verify both files exist before invoking it.

Run commands with the current Node.js executable:

```text
node <plugin-root>/dist/cli.js <command>
```

Quote the runtime path on every platform.

## Tasks

- Current status: run `status` and return the rendered line.
- Installation health: run `verify` and summarize any failed check.
- Visible TUI setup: run `setup`, report whether configuration changed, and
  tell the user to restart Codex when it did.
- Terminal integration: explain how to call the bundled `status` command from
  the user's shell prompt or tmux status bar using the resolved absolute path.
- Live App Server telemetry: run `watch` only when the user explicitly asks for
  a long-running watcher. Explain that it needs a reachable Codex App Server
  transport and keep the process attached until the user stops it.

The plugin already bundles lifecycle hooks. Do not run `install` or edit the
user's `~/.codex/hooks.json` for a marketplace installation. On a new install,
tell the user to review the hook definitions with `/hooks`, trust them, and use
a new thread so Codex loads the plugin components. The `setup` command edits
only the supported native `tui.status_line` setting and creates
`~/.codex/config.toml.bak` before a change.

Never print the full normalized state file unless the user explicitly asks for
it. Do not read transcripts, credentials, or raw hook payloads.
