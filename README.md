# Antigravity Plugin & Skill Manager

Extension manager to audit, synchronize, and update Antigravity plugins, community skills, and custom MCP tools.

## Features

- **Dual-Phase Synchronization**:
  - Audits and upgrades official marketplace plugins (`antigravity-plugins-official`).
  - Synchronizes third-party skills, local repositories, and custom MCP configurations.
- **Sidecar Dashboard**: Auxiliary panel displaying installed plugins, enabled states, skill counts, and update status.
- **Quick Triggers**:
  - Slash command: `/update-plugins`
  - Starter prompt pills in Antigravity desktop canvas.
  - Standalone script: `update.sh`

## Installation

### Global

Clone into the Antigravity global plugins directory:

```bash
git clone https://github.com/Wandering233/antigravity-plugin-manager.git ~/.gemini/config/plugins/plugin-manager
```

Restart Antigravity to discover the plugin.

### Workspace Sandbox (Testing)

To test inside a specific repository without modifying global configurations:

```bash
mkdir -p .agents/plugins
git clone https://github.com/Wandering233/antigravity-plugin-manager.git .agents/plugins/plugin-manager
```

### Manifest Validation

Validate plugin structure using the Antigravity CLI:

```bash
agy plugin validate ~/.gemini/config/plugins/plugin-manager
```

## Usage

- Run `/update-plugins` in the chat prompt.
- Open the `Plugin & Skill Manager` view from the auxiliary panel.
- Or execute `./update.sh` from the plugin directory.

## Directory Structure

```text
plugin-manager/
├── plugin.json
├── assets/
│   └── logo.png
├── sidecars/
│   └── manager/
│       ├── index.html
│       ├── server.mjs
│       └── sidecar.json
├── skills/
│   └── update-plugins/
│       └── SKILL.md
├── update.sh
├── .gitignore
├── LICENSE
└── README.md
```

## License

MIT
