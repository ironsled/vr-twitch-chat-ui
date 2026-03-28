# VR Twitch Chat UI for MSFS 2024

A lightweight in-game panel for Microsoft Flight Simulator 2024 that displays your Twitch chat overlay directly in the cockpit. Auto-detects VR mode and scales all fonts automatically for headset readability.

![MSFS 2024](https://img.shields.io/badge/MSFS-2024-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Live Twitch chat overlay inside MSFS 2024
- **Auto VR/Desktop font switching** — detects VR by panel resolution and scales all fonts automatically (2.2x default). No manual resizing when switching.
- **Separate font profiles** — VR and desktop sizes saved independently. Tweak in VR, only VR is affected. Tweak on desktop, only desktop is affected.
- **Font color customization** — cycle through 16 preset colors for chat text and emote labels. Toggle Twitch username colors on/off. Settings persist across sessions.
- **Transparent background (T)** — toggle panel background transparency so the sim scenery shows through while chat remains readable. Setting persists across sessions.
- **VR/DT mode indicator** — header shows current mode (blue = VR active)
- **Twitch emote support** — emotes shown as styled labels with image loading when available
- **Adjustable font sizes** — independent controls for chat text, channel name, UI elements, and emote size
- **Settings panel (S)** — font size controls and color presets, all scale properly in VR
- **Responsive layout** — header and controls wrap cleanly at any panel size
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
    "chat_color": "#efeff1",
    "emote_label_color": "#bf94ff",
    "use_twitch_colors": true
}
```

| Option | Description |
|--------|-------------|
| `font_size` | Desktop chat text size (px) |
| `channel_font_size` | Desktop channel name size (px) |
| `ui_font_size` | Desktop UI controls size (px) |
| `emote_size` | Desktop emote size (px) |
| `vr_scale` | Multiplier applied to desktop sizes for VR defaults (default 2.2) |
| `chat_color` | Default chat text color (hex) |
| `emote_label_color` | Default emote label text color (hex) |
| `use_twitch_colors` | Use per-user Twitch name colors (true/false) |

Optional VR overrides: `vr_font_size`, `vr_channel_font_size`, `vr_ui_font_size`, `vr_emote_size` — set exact VR values instead of using the multiplier.

Font sizes and colors can also be adjusted live via the settings panel and will persist automatically.

## Usage

1. Click the **CHAT** icon in the MSFS toolbar
2. Enter your Twitch channel name (or pre-configure in `config.json`)
3. Click **CONNECT**
4. Use **A-** / **A+** to quickly adjust chat font size
5. Press **S** to open the settings panel for font sizes and colors
6. Press **T** to toggle transparent background — see the sim through the panel
7. Click **X** to disconnect

## Header Controls

| Element | Function |
|---------|----------|
| **VR/DT** | Current mode indicator (auto-detected) |
| **T** | Toggle transparent background (green = active) |
| **S** | Toggle settings panel (sizes, colors) |
| **A-** / **A+** | Adjust chat font size |
| **X** | Disconnect from chat |

## Settings Panel

### Sizes
- Channel Name, Chat Text, UI Controls, Emote Size — each with +/- buttons

### Colors
- **Channel Name** — cycle through 16 color presets with < > buttons
- **Chat Text** — cycle through 16 color presets with < > buttons
- **Emote Labels** — cycle through 16 color presets with < > buttons
- **Twitch Name Colors** — ON/OFF toggle for per-user Twitch colors

## Panel Position

MSFS does not support position persistence for third-party ingame panels. Use [MSFS Pop Out Panel Manager 2024](https://flightsim.to/addon/85158/msfs-pop-out-panel-manager-2024) to save and restore panel positions across sessions.

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
