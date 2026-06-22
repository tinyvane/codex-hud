# Changelog

All notable changes to this project are documented in this file.

## 0.1.3 - 2026-06-22

- Use Codex's `${PLUGIN_ROOT}` substitution for hook commands on every platform,
  fixing Windows App Server sessions that execute hooks through PowerShell.
- Add `codex-hud setup` to configure the supported native Codex TUI status line
  while preserving existing fields and backing up `config.toml`.
- Make Codex configuration writes atomic and report display setup separately
  during verification.

## 0.1.2 - 2026-06-22

- Remove the unsupported top-level `description` property from the bundled
  hooks configuration.
- Reject unsupported top-level hook configuration fields during tests and
  release validation.

## 0.1.1 - 2026-06-22

- Rename the repository marketplace from the generic `personal` identifier to
  `codex-hud` so it cannot collide with a user's personal marketplace.
- Update install, uninstall, validation, and migration guidance for the new
  `codex-hud@codex-hud` identity.
- Increase the state-lock wait budget so concurrently scheduled hooks remain
  reliable when the host is under heavy load.

## 0.1.0 - 2026-06-22

- Add a repository marketplace and installable Codex plugin manifest.
- Bundle lifecycle hooks, an operator skill, and a dependency-free CLI runtime.
- Add cross-platform hook commands and plugin validation.
- Serialize concurrent hook state updates and use unique atomic temporary files.
- Add Windows, macOS, and Linux CI coverage.
