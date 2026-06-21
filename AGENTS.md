# AGENTS.md

## Project

`codex-hud` is a standalone HUD for OpenAI Codex. It is intentionally separate
from `claude-hud` because the products expose different configuration, event,
session, and rendering interfaces.

The first implementation should validate Codex integration before extracting or
sharing code with another repository.

## Sources Of Truth

- Use current official Codex documentation for product behavior and schemas.
- Prefer supported Codex surfaces: `config.toml`, lifecycle hooks, plugins, and
  `codex app-server`.
- Do not assume Claude Code stdin or transcript formats apply to Codex.
- Treat generated App Server schemas as versioned inputs; do not hand-maintain
  undocumented protocol types.
- Record material architecture decisions in `PLAN.md` or a future `docs/adr/`.

## Engineering Rules

- Keep provider-specific ingestion separate from normalized HUD state and
  rendering code.
- Add abstractions only after a concrete second implementation needs them.
- Parse structured data with structured parsers. Do not use regular expressions
  as a substitute for JSON, JSONL, or TOML parsing.
- Validate untrusted event, session, hook, and configuration input at boundaries.
- Keep terminal output safe: sanitize control characters and reset ANSI styles.
- Make filesystem writes atomic when modifying user configuration.
- Back up user configuration before changing it.
- Never log tokens, credentials, authorization headers, or full sensitive event
  payloads.
- Keep source and comments in ASCII unless non-ASCII content is required.

## Workflow

1. Read `README.md`, `PLAN.md`, and relevant official Codex documentation.
2. Update the active milestone in `PLAN.md` before substantial implementation.
3. Make the smallest coherent change.
4. Add or update focused tests, including malformed-input and cross-platform
   cases when applicable.
5. Run formatting, type checking, tests, and build commands defined by the
   project.
6. Update documentation and the program version for user-visible releases.
7. Report commands that could not be run and any remaining risks.

## Local And Remote Synchronization

- Source code changes must be kept consistent between the local checkout and its
  configured remote repository.
- Once a remote exists, implementation work is not complete until the intended
  commits are pushed, unless the user explicitly requests local-only work.
- Never overwrite unrelated local or remote changes. Fetch and inspect before
  reconciling divergence.
- If no remote is configured or pushing is unavailable, state that clearly; do
  not claim synchronization succeeded.

## Environment Configuration

- Do not commit `.env`, `.env.local`, credentials, tokens, or machine-specific
  paths.
- Keep development and production configuration separate.
- Local services should use localhost endpoints.
- Production builds must use production-specific configuration and secure
  `https://` or `wss://` endpoints where applicable.
- Never change local development environment variables merely to make a
  production deployment work.

## Initial Quality Bar

- Target Windows, macOS, and Linux unless a milestone explicitly narrows scope.
- Unit-test normalized state and rendering independently from Codex transports.
- Use fixtures for hook and App Server events.
- Keep the Claude HUD repository untouched unless a separate task explicitly
  requests compatibility work.
- Do not publish a package or release until installation, rollback, and basic
  failure behavior are documented and tested.
