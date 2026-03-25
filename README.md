# VR Twitch Chat UI for MSFS 2024

A lightweight in-game panel for Microsoft Flight Simulator 2024 that displays your Twitch chat overlay directly in the cockpit. Designed for VR readability.

![MSFS 2024](https://img.shields.io/badge/MSFS-2024-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Live Twitch chat overlay inside MSFS 2024
- VR-optimized font sizes with adjustable A-/A+ controls
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
    "font_size": 18
}
```

Or use the in-panel setup screen to enter your channel name.

## Usage

1. Click the **CHAT** icon in the MSFS toolbar
2. Enter your Twitch channel name (or pre-configure in `config.json`)
3. Click **CONNECT**
4. Use **A-** / **A+** to adjust chat font size for VR readability
5. Click **X** to disconnect

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

## License

MIT License — see [LICENSE](LICENSE)
