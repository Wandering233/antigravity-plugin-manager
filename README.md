# Plugin & Skill Manager for Antigravity

[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin-blue.svg)](https://github.com/Wandering233/antigravity-plugin-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A dual-phase manager to inspect, update, and synchronize official Antigravity marketplace plugins, third-party skills, and custom MCP tools.

---

## ✨ Features

- 🔄 **Dual-Phase Synchronization (双阶段智能更新)**:
  - **Phase 1 (Official First)**: Automatically audits and upgrades plugins installed from official sources (`antigravity-plugins-official`).
  - **Phase 2 (Custom & Third-Party)**: Synchronizes third-party skills (e.g., Emil Kowalski design/animation library), local tools (e.g., REA reverse-engineering suite), and Git repositories.
- 📊 **Visual Dashboard (Sidecar Web UI)**:
  - Auxiliary panel displaying installed plugins, enablement status, skill counts, and update readiness.
- ⚡ **Integrated Quick Actions**:
  - Surfaces interactive starter prompt pills directly on the Antigravity desktop canvas card.
  - Dedicated `/update-plugins` slash command.
  - Terminal hook: `update.sh`.

---

## 🚀 Installation & Debugging (快速安装与调试)

### 1. 全局安装 (Global Install)

将仓库克隆至 Antigravity 全局插件目录：

```bash
git clone https://github.com/Wandering233/antigravity-plugin-manager.git ~/.gemini/config/plugins/plugin-manager
```

重启 Antigravity 后即可在侧边栏、插件中心或通过 `/update-plugins` 调用。

### 2. 工作区隔离调试 (Workspace Sandbox Install)

若仅想在特定测试项目中调试本插件：

```bash
mkdir -p .agents/plugins
git clone https://github.com/Wandering233/antigravity-plugin-manager.git .agents/plugins/plugin-manager
```

### 3. 插件规范校验 (CLI Validation)

在终端运行官方 CLI 工具检查插件完整性：

```bash
agy plugin validate ~/.gemini/config/plugins/plugin-manager
```

---

## 🛠️ Usage

- **Via Slash Command**: `/update-plugins`
- **Via Overview / Starter Canvas**: Click any of the 3 suggested prompt pills on the Plugin Manager card.
- **Via Sidecar UI**: Open the `Plugin & Skill Manager` auxiliary panel in Antigravity.

---

## 📁 Directory Structure

```text
plugin-manager/
├── plugin.json         # Plugin manifest
├── assets/
│   └── logo.png        # Plugin logo
├── sidecars/
│   └── manager/
│       ├── sidecar.json # Sidecar declaration
│       ├── server.mjs   # Management server
│       └── index.html   # Visual dashboard
├── skills/
│   └── update-plugins/
│       └── SKILL.md     # Automated upgrade agent skill
├── update.sh           # Standalone updater script
├── .gitignore
└── README.md
```

---

## 📄 License

[MIT License](LICENSE) © 2026 Wandering233
