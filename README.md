# VR Twitch Chat UI for MSFS 2024

A lightweight in-game panel for Microsoft Flight Simulator 2024 that displays your Twitch chat overlay directly in the cockpit. Auto-detects VR mode and scales all fonts automatically for headset readability.

![MSFS 2024](https://img.shields.io/badge/MSFS-2024-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Live Twitch chat overlay inside MSFS 2024
- **Auto VR/Desktop font switching** — detects VR by panel resolution and scales all fonts automatically (2.2x default). No manual resizing when switching.
- **Separate font profiles** — VR and desktop sizes saved independently. Tweak in VR, only VR is affected. Tweak on desktop, only desktop is affected.
- **Transparent background (T)** — toggle panel background transparency so the sim scenery shows through while chat remains readable. Setting persists across sessions.
- **Pin position (P)** — save panel position with one click. Restores on next load, then hands off to MSFS for normal dragging. Click again to unpin.
- **VR/DT mode indicator** — header shows current mode (blue = VR active)
- **Twitch emote support** — emotes shown as styled labels with image loading when available
- **Adjustable font sizes** — independent controls for chat text, channel name, UI elements, and emote size
- **Settings panel (S)** — font size controls for all UI elements, all scale properly in VR
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
    "vr_scale": 2.2,
    "vr_font_size": 50,
    "vr_channel_font_size": 50,
    "vr_ui_font_size": 50,
    "vr_emote_size": 50
}
```

| Option | Description |
|--------|-------------|
| `font_size` | Desktop chat text size (px) |
| `channel_font_size` | Desktop channel name size (px) |
| `ui_font_size` | Desktop UI controls size (px) |
| `emote_size` | Desktop emote size (px) |
| `vr_scale` | Multiplier applied to desktop sizes for VR defaults (default 2.2) |

Optional VR overrides: `vr_font_size`, `vr_channel_font_size`, `vr_ui_font_size`, `vr_emote_size` — set exact VR values instead of using the multiplier.

Font sizes can also be adjusted live via the settings panel and will persist automatically per mode.

## Usage

1. Click the **CHAT** icon in the MSFS toolbar
2. Enter your Twitch channel name (or pre-configure in `config.json`)
3. Click **CONNECT**
4. Use **A-** / **A+** to quickly adjust chat font size
5. Press **S** to open the settings panel for fine-grained control over all font sizes
6. Press **T** to toggle transparent background — see the sim through the panel
7. Press **P** to pin panel position — restores on next load. Press again to unpin.
7. Click **X** to disconnect

## Header Controls

| Element | Function |
|---------|----------|
| **VR/DT** | Current mode indicator (auto-detected) |
| **T** | Toggle transparent background (green = active) |
| **P** | Pin/unpin panel position (green = saved) |
| **S** | Toggle font size settings panel |
| **A-** / **A+** | Adjust chat font size |
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
