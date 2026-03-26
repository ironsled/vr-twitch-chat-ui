# VR Twitch Chat UI for MSFS 2024

A lightweight in-game panel for Microsoft Flight Simulator 2024 that displays your Twitch chat overlay directly in the cockpit. Designed for VR readability with full emote support and persistent UI settings.

![MSFS 2024](https://img.shields.io/badge/MSFS-2024-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Live Twitch chat overlay inside MSFS 2024
- **Twitch emote rendering** — native emotes displayed as images directly in chat
- **Adjustable font sizes** — independent controls for chat text, channel name, UI elements, and emote size
- **Settings panel** — press **S** to open a font size control panel for all UI elements
- **Position memory** — panel remembers its last position and size between sessions
- **Reset position** — press **R** to snap the panel back to default placement if lost
- **Persistent settings** — all font size preferences saved across sessions via MSFS data storage
- VR-optimized defaults (28px chat, large emotes) with quick A-/A+ controls
- Compact header to maximize chat viewing area
- Connects via Twitch IRC (no authentication required for read-only chat)
- Toolbar icon for quick access

## Installation

1. Download or clone this repository
2. Copy the `vr-twitch-chat-ui` folder into your MSFS 2024 Community packages folder:
   ```
   %LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community\
   ```
3. Launch MSFS 2024 — the panel will appear in your toolbar

## Configuration

Edit `vr-twitch-chat-ui/html_ui/InGamePanels/CustomPanel/config.json`:

```json
{
    "channel": "your_channel_name",
    "font_size": 28,
    "channel_font_size": 16,
    "ui_font_size": 12,
    "emote_size": 28
}
```

Or use the in-panel setup screen to enter your channel name. Font sizes can also be adjusted live via the settings panel and will persist automatically.

## Usage

1. Click the **CHAT** icon in the MSFS toolbar
2. Enter your Twitch channel name (or pre-configure in `config.json`)
3. Click **CONNECT**
4. Use **A-** / **A+** to quickly adjust chat font size
5. Press **S** to open the settings panel for fine-grained control over all font sizes and emote size
6. Press **R** to reset panel position to default if the panel gets lost off-screen
7. Click **X** to disconnect

## Header Controls

| Button | Function |
|--------|----------|
| **R** | Reset panel position to default |
| **S** | Toggle font size settings panel |
| **A-** | Decrease chat font size |
| **A+** | Increase chat font size |
| **X** | Disconnect from chat |

## Package Structure

```
vr-twitch-chat-ui/
├── manifest.json
├── layout.json
├── InGamePanels/CustomPanel/
│   ├── panel.cfg
│   └── maximus-ingamepanels-custom.spb
└── html_ui/
    ├── icons/toolbar/
    │   └── ICON_TOOLBAR_MAXIMUS_CUSTOM_PANEL.svg
    └── InGamePanels/CustomPanel/
        ├── CustomPanel.html
        ├── CustomPanel.js
        ├── CustomPanel.css
        ├── config.json
        └── icon.svg
```

## Credits

- Built on the [bymaximus MSFS toolbar window template](https://github.com/bymaximus/msfs2020-toolbar-window-template)
- Twitch chat via IRC WebSocket
- Twitch emotes via Twitch CDN

## License

MIT License — see [LICENSE](LICENSE)
