---
name: update-plugins
description: Check and update official Antigravity marketplace plugins and third-party skills in two phases. Triggered by /update-plugins.
---

# Update Plugins

This skill executes the dual-phase update pipeline for Google Antigravity:
1. **Phase 1 (Official)**: Inspects and updates official marketplace plugins (`antigravity-plugins-official`).
2. **Phase 2 (Custom)**: Scans, updates, and synchronizes third-party skills, REA reverse engineering tools, and Git-backed repositories.

## Workflow

1. Execute the dual-phase updater:
   ```bash
   antigravity-plugins-update
   ```
2. Parse the command output and present a clear, two-section Markdown report:
   - **Official Ecosystem Components**: List of official plugins and their version status.
   - **Custom & Third-Party Extensions**: List of self-hosted skills, MCP servers, and synchronization status.
