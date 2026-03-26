# VR Twitch Chat UI for MSFS 2024

A lightweight in-game panel for Microsoft Flight Simulator 2024 that displays your Twitch chat overlay directly in the cockpit. Auto-detects VR mode and scales fonts automatically for headset readability.

![MSFS 2024](https://img.shields.io/badge/MSFS-2024-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Live Twitch chat overlay inside MSFS 2024
- **Auto VR/Desktop font switching** — detects VR mode via SimVar and scales all fonts automatically (1.8x default). No manual resizing when switching between VR and desktop.
- **Separate font profiles** — VR and desktop font sizes saved independently. Tweak in VR, it only affects VR. Tweak on desktop, it only affects desktop.
- **VR/DT mode indicator** — header shows current mode (blue = VR active)
- **Twitch emote support** — emotes shown as styled labels with image loading when available
- **Adjustable font sizes** — independent controls for chat text, channel name, UI elements, and emote size
- **Settings panel** — press **S** to open font size controls for all UI elements
- **Persistent settings** — font preferences saved per-mode across sessions via MSFS data storage
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
    "font_size": 22,
    "channel_font_size": 16,
    "ui_font_size": 12,
    "emote_size": 22,
    "vr_scale": 1.8
}
```

| Option | Description |
|--------|-------------|
| `font_size` | Desktop chat text size (px) |
| `channel_font_size` | Desktop channel name size (px) |
| `ui_font_size` | Desktop UI controls size (px) |
| `emote_size` | Desktop emote size (px) |
| `vr_scale` | Multiplier applied to desktop sizes for VR defaults (default 1.8) |

Optional VR overrides: `vr_font_size`, `vr_channel_font_size`, `vr_ui_font_size`, `vr_emote_size` — set these to use exact VR values instead of the multiplier.

Font sizes can also be adjusted live via the settings panel and will persist automatically per mode.

## Usage

1. Click the **CHAT** icon in the MSFS toolbar
2. Enter your Twitch channel name (or pre-configure in `config.json`)
3. Click **CONNECT**
4. Use **A-** / **A+** to quickly adjust chat font size
5. Press **S** to open the settings panel for fine-grained control over all font sizes and emote size
6. Click **X** to disconnect

## Header Controls

| Element | Function |
|---------|----------|
| **VR/DT** | Current mode indicator (auto-detected) |
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
