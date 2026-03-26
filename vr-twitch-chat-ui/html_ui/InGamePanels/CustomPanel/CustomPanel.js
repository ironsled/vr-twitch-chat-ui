class IngamePanelCustomPanel extends TemplateElement {
    constructor() {
        super(...arguments);
        this.panelActive = false;
        this.started = false;
        this.ingameUi = null;
        this.channel = '';
        this.ws = null;
        this.maxMessages = 100;
        this.configLoaded = false;

        // Font size defaults (desktop)
        this.desktopFonts = { chat: 22, channel: 16, ui: 12, emote: 22 };
        // Font size defaults (VR) — larger for headset readability
        this.vrFonts = { chat: 48, channel: 32, ui: 24, emote: 48 };
        // VR scale multiplier applied to desktop defaults to generate VR defaults
        this.vrScale = 2.2;

        // Active font sizes (set from whichever profile is active)
        this.chatFontSize = 22;
        this.channelFontSize = 16;
        this.uiFontSize = 12;
        this.emoteSize = 22;

        this.minFontSize = 8;
        this.maxFontSize = 120;
        this.fontStep = 2;

        // VR detection
        this.isVR = false;
        this.vrCheckInterval = null;
        this.vrDetectMethod = 'init';
        this.vrWidthThreshold = 800; // effective px — panels wider than this = VR

        // Emote cache: maps emote ID -> data URI (or 'loading'/'failed')
        this.emoteCache = {};
        this.emotePending = {}; // emote IDs currently being fetched

        // Settings panel state
        this.settingsOpen = false;

        // Position pin state
        this.positionPinned = false;

        // Storage prefix for persistent settings
        this.storagePrefix = 'SKYDECK_TWITCH_';

        this.initialize();
    }

    connectedCallback() {
        super.connectedCallback();

        var self = this;
        this.ingameUi = this.querySelector('ingame-ui');
        // Override panel title after MSFS renders the header
        var titleInterval = setInterval(function () {
            var header = document.querySelector('ingame-ui-header');
            if (header) {
                var titleEl = header.querySelector('.title') || header.querySelector('[class*="title"]') || header.shadowRoot && header.shadowRoot.querySelector('.title');
                if (titleEl) {
                    titleEl.textContent = 'Live Chat';
                    clearInterval(titleInterval);
                }
            }
        }, 200);
        this.setupScreen = document.getElementById("SetupScreen");
        this.chatWrap = document.getElementById("ChatWrap");
        this.chatMessages = document.getElementById("ChatMessages");
        this.chatStatus = document.getElementById("ChatStatus");
        this.chatChannelName = document.getElementById("ChatChannelName");
        this.channelInput = document.getElementById("ChannelInput");
        this.connectBtn = document.getElementById("ConnectBtn");
        this.disconnectBtn = document.getElementById("DisconnectBtn");
        this.fontUpBtn = document.getElementById("FontUpBtn");
        this.fontDownBtn = document.getElementById("FontDownBtn");
        this.fontSizeLabel = document.getElementById("FontSizeLabel");
        this.settingsBtn = document.getElementById("SettingsBtn");
        this.settingsPanel = document.getElementById("SettingsPanel");
        // Settings value displays
        this.channelFontValue = document.getElementById("ChannelFontValue");
        this.chatFontValue = document.getElementById("ChatFontValue");
        this.uiFontValue = document.getElementById("UIFontValue");
        this.emoteSizeValue = document.getElementById("EmoteSizeValue");
        this.vrModeLabel = document.getElementById("VRModeLabel");
        this.pinPosBtn = document.getElementById("PinPosBtn");

        // Detect initial VR state, migrate old settings, restore matching font profile
        this.detectVRMode();
        this.migrateOldFontSettings();
        this.restoreFontSettings();

        // Load config file
        this.loadConfig();

        if (this.connectBtn) {
            this.connectBtn.addEventListener("click", function () {
                self.connectToChannel();
            });
        }

        if (this.disconnectBtn) {
            this.disconnectBtn.addEventListener("click", function () {
                self.disconnect();
            });
        }

        // Chat font quick controls (A+/A-)
        if (this.fontUpBtn) {
            this.fontUpBtn.addEventListener("click", function () {
                self.changeFontSize('chat', self.fontStep);
            });
        }

        if (this.fontDownBtn) {
            this.fontDownBtn.addEventListener("click", function () {
                self.changeFontSize('chat', -self.fontStep);
            });
        }

        // Pin position button
        if (this.pinPosBtn) {
            this.pinPosBtn.addEventListener("click", function () {
                self.togglePinPosition();
            });
        }

        // Restore pinned position (one-time on load)
        this.restorePinnedPosition();

        // Settings toggle
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener("click", function () {
                self.toggleSettings();
            });
        }

        // Settings panel +/- buttons
        var settingsBtns = document.querySelectorAll('.settings-btn');
        for (var i = 0; i < settingsBtns.length; i++) {
            settingsBtns[i].addEventListener("click", function () {
                var target = this.getAttribute('data-target');
                var dir = parseInt(this.getAttribute('data-dir'));
                self.changeFontSize(target, dir * self.fontStep);
            });
        }

        if (this.channelInput) {
            this.channelInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    self.connectToChannel();
                }
            });
        }

        if (this.ingameUi) {
            this.ingameUi.addEventListener("panelActive", function () {
                self.panelActive = true;
                self.ensureConnected();
            });
            this.ingameUi.addEventListener("panelInactive", function () {
                self.panelActive = false;
            });
        }

        // Periodic connection watchdog
        setInterval(function () {
            if (self.channel) {
                self.ensureConnected();
            }
        }, 5000);

        // Periodic VR mode check (every 3 seconds)
        this.vrCheckInterval = setInterval(function () {
            self.checkVRModeChange();
        }, 3000);

        // Apply initial font sizes
        this.applyAllFontSizes();
    }

    initialize() {
        if (this.started) return;
        this.started = true;
    }

    // ---- Settings Panel ----

    toggleSettings() {
        this.settingsOpen = !this.settingsOpen;
        if (this.settingsPanel) {
            this.settingsPanel.classList.toggle('active', this.settingsOpen);
        }
        if (this.settingsBtn) {
            this.settingsBtn.classList.toggle('active', this.settingsOpen);
        }
    }

    // ---- Pin Position ----
    //
    // Manual save only — no auto-polling. Click P to snapshot current position.
    // Click again to clear. Restores once on panel load, then hands off to MSFS.

    togglePinPosition() {
        if (this.positionPinned) {
            // Unpin — clear saved position
            this.setStored('PinnedPos', '');
            this.positionPinned = false;
            this.updatePinButton();
            this.setStatus('Position unpinned');
        } else {
            // Pin — save current position
            this.savePinnedPosition();
            this.positionPinned = true;
            this.updatePinButton();
            this.setStatus('Position saved');
        }
        var self = this;
        setTimeout(function () {
            if (self.chatStatus) self.chatStatus.style.display = 'none';
        }, 2000);
    }

    savePinnedPosition() {
        var panel = this.ingameUi;
        if (!panel) return;

        var rect = panel.getBoundingClientRect();
        var style = window.getComputedStyle(panel);
        var pos = {
            left: panel.style.left || style.left,
            top: panel.style.top || style.top,
            width: panel.style.width || style.width,
            height: panel.style.height || style.height
        };
        this.setStored('PinnedPos', JSON.stringify(pos));
    }

    restorePinnedPosition() {
        var posStr = this.getStored('PinnedPos');
        if (!posStr) {
            this.positionPinned = false;
            this.updatePinButton();
            return;
        }

        this.positionPinned = true;
        this.updatePinButton();

        var self = this;
        try {
            var pos = JSON.parse(posStr);
            // Wait for panel to render, apply once, then stop
            var attempts = 0;
            var restoreInterval = setInterval(function () {
                attempts++;
                var panel = self.ingameUi;
                if (panel && panel.getBoundingClientRect().width > 0) {
                    if (pos.left) panel.style.left = pos.left;
                    if (pos.top) panel.style.top = pos.top;
                    if (pos.width) panel.style.width = pos.width;
                    if (pos.height) panel.style.height = pos.height;
                    clearInterval(restoreInterval);
                }
                if (attempts > 30) {
                    clearInterval(restoreInterval);
                }
            }, 100);
        } catch (e) {}
    }

    updatePinButton() {
        if (this.pinPosBtn) {
            this.pinPosBtn.classList.toggle('pinned', this.positionPinned);
            this.pinPosBtn.title = this.positionPinned ? 'Position saved — click to unpin' : 'Save panel position';
        }
    }

    // ---- VR Mode Detection ----
    //
    // Multiple detection strategies:
    // 1. SimVar 'IS VR ENABLED' (may not be available in ingame panels)
    // 2. Resolution-based: in VR, MSFS renders panels at much higher internal
    //    resolution. A panel that's ~400px on desktop becomes ~1000px+ in VR.
    //    We use window.innerWidth as the primary heuristic.
    // 3. devicePixelRatio: may differ between VR and desktop rendering
    //
    // The resolution threshold is configurable via config.json "vr_width_threshold"
    // Default: 800px — panels wider than this are assumed to be in VR.

    detectVRMode() {
        var detected = false;

        // Strategy 1: SimVar (most reliable if available)
        try {
            if (typeof SimVar !== 'undefined' && SimVar.GetSimVarValue) {
                var vrVal = SimVar.GetSimVarValue('IS VR ENABLED', 'Boolean');
                if (vrVal !== undefined && vrVal !== null) {
                    detected = !!vrVal;
                    this.isVR = detected;
                    this.vrDetectMethod = 'simvar';
                    this.updateVRLabel();
                    return;
                }
            }
        } catch (e) {}

        // Strategy 2: Resolution-based heuristic
        // In VR, the panel's internal rendering width is significantly larger
        var panelWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        var panelHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        var dpr = window.devicePixelRatio || 1;

        // Use the larger dimension and factor in devicePixelRatio
        var effectiveWidth = panelWidth * dpr;

        detected = (effectiveWidth > this.vrWidthThreshold);
        this.isVR = detected;
        this.vrDetectMethod = 'resolution (' + panelWidth + 'x' + panelHeight + ' @' + dpr + 'x = ' + effectiveWidth + 'px eff)';
        this.updateVRLabel();
    }

    checkVRModeChange() {
        var wasVR = this.isVR;
        this.detectVRMode();

        if (this.isVR !== wasVR) {
            // Mode changed — save current fonts to the OLD mode's profile, load new mode's profile
            this.saveFontSettingsForMode(wasVR);
            this.loadFontSettingsForMode(this.isVR);
            this.applyAllFontSizes();

            this.setStatus(this.isVR ? 'VR detected — fonts scaled up' : 'Desktop detected — fonts scaled down');
            var self = this;
            setTimeout(function () {
                if (self.chatStatus) self.chatStatus.style.display = 'none';
            }, 3000);
        }
    }

    updateVRLabel() {
        if (this.vrModeLabel) {
            this.vrModeLabel.textContent = this.isVR ? 'VR' : 'DT';
            this.vrModeLabel.title = (this.isVR ? 'VR Mode' : 'Desktop Mode') + ' [' + this.vrDetectMethod + ']';
            this.vrModeLabel.className = this.isVR ? 'vr-label vr-active' : 'vr-label';
        }
    }

    // ---- Persistent Storage Helpers ----

    setStored(key, value) {
        try {
            if (typeof SetStoredData === 'function') {
                SetStoredData(this.storagePrefix + key, value);
                return;
            }
        } catch (e) {}
        try {
            localStorage.setItem(this.storagePrefix + key, value);
        } catch (e) {}
    }

    getStored(key) {
        try {
            if (typeof GetStoredData === 'function') {
                var val = GetStoredData(this.storagePrefix + key);
                if (val !== undefined && val !== null && val !== '') return val;
            }
        } catch (e) {}
        try {
            return localStorage.getItem(this.storagePrefix + key) || '';
        } catch (e) {}
        return '';
    }

    // ---- Font Settings Persistence (mode-aware) ----

    getFontStorageKey(vrMode) {
        return vrMode ? 'FontSettings_VR' : 'FontSettings_Desktop';
    }

    saveFontSettings() {
        // Save to the current mode's profile
        this.saveFontSettingsForMode(this.isVR);
    }

    saveFontSettingsForMode(vrMode) {
        var settings = JSON.stringify({
            chatFontSize: this.chatFontSize,
            channelFontSize: this.channelFontSize,
            uiFontSize: this.uiFontSize,
            emoteSize: this.emoteSize
        });
        this.setStored(this.getFontStorageKey(vrMode), settings);
    }

    restoreFontSettings() {
        this.loadFontSettingsForMode(this.isVR);
    }

    loadFontSettingsForMode(vrMode) {
        var settingsStr = this.getStored(this.getFontStorageKey(vrMode));
        if (settingsStr) {
            try {
                var s = JSON.parse(settingsStr);
                if (s.chatFontSize) this.chatFontSize = this.clampFont(s.chatFontSize);
                if (s.channelFontSize) this.channelFontSize = this.clampFont(s.channelFontSize);
                if (s.uiFontSize) this.uiFontSize = this.clampFont(s.uiFontSize);
                if (s.emoteSize) this.emoteSize = this.clampFont(s.emoteSize);
                return;
            } catch (e) {}
        }

        // No saved profile for this mode — use defaults
        if (vrMode) {
            this.chatFontSize = this.vrFonts.chat;
            this.channelFontSize = this.vrFonts.channel;
            this.uiFontSize = this.vrFonts.ui;
            this.emoteSize = this.vrFonts.emote;
        } else {
            this.chatFontSize = this.desktopFonts.chat;
            this.channelFontSize = this.desktopFonts.channel;
            this.uiFontSize = this.desktopFonts.ui;
            this.emoteSize = this.desktopFonts.emote;
        }
    }

    // Migrate old single-profile settings to desktop profile (one-time)
    migrateOldFontSettings() {
        var oldStr = this.getStored('FontSettings');
        if (oldStr && !this.getStored('FontSettings_Desktop')) {
            this.setStored('FontSettings_Desktop', oldStr);
        }
        // Clear old key
        if (oldStr) this.setStored('FontSettings', '');
    }

    // ---- Font Size ----

    changeFontSize(target, delta) {
        switch (target) {
            case 'chat':
                this.chatFontSize = this.clampFont(this.chatFontSize + delta);
                break;
            case 'channel':
                this.channelFontSize = this.clampFont(this.channelFontSize + delta);
                break;
            case 'ui':
                this.uiFontSize = this.clampFont(this.uiFontSize + delta);
                break;
            case 'emote':
                this.emoteSize = this.clampFont(this.emoteSize + delta);
                break;
        }
        this.applyAllFontSizes();
        this.saveFontSettings();
    }

    clampFont(val) {
        return Math.max(this.minFontSize, Math.min(this.maxFontSize, val));
    }

    applyAllFontSizes() {
        // Chat messages
        if (this.chatMessages) {
            this.chatMessages.style.fontSize = this.chatFontSize + 'px';
        }
        if (this.fontSizeLabel) {
            this.fontSizeLabel.textContent = this.chatFontSize;
        }

        // Channel name
        if (this.chatChannelName) {
            this.chatChannelName.style.fontSize = this.channelFontSize + 'px';
        }

        // UI controls (buttons, labels)
        var ctrlBtns = document.querySelectorAll('.ctrl-btn');
        for (var i = 0; i < ctrlBtns.length; i++) {
            ctrlBtns[i].style.fontSize = this.uiFontSize + 'px';
        }
        if (this.fontSizeLabel) {
            this.fontSizeLabel.style.fontSize = Math.max(9, this.uiFontSize - 1) + 'px';
        }

        // Emote images
        var emotes = document.querySelectorAll('.twitch-emote');
        for (var i = 0; i < emotes.length; i++) {
            emotes[i].style.height = this.emoteSize + 'px';
        }

        // Settings panel — labels, values, buttons all scale with UI font
        var settingsLabels = document.querySelectorAll('.settings-label');
        for (var i = 0; i < settingsLabels.length; i++) {
            settingsLabels[i].style.fontSize = this.uiFontSize + 'px';
        }
        var settingsValues = document.querySelectorAll('.settings-value');
        for (var i = 0; i < settingsValues.length; i++) {
            settingsValues[i].style.fontSize = Math.max(9, this.uiFontSize - 1) + 'px';
        }
        var settingsBtns = document.querySelectorAll('.settings-btn');
        for (var i = 0; i < settingsBtns.length; i++) {
            settingsBtns[i].style.fontSize = this.uiFontSize + 'px';
        }

        // VR mode label
        if (this.vrModeLabel) {
            this.vrModeLabel.style.fontSize = Math.max(9, this.uiFontSize - 1) + 'px';
        }

        // Settings panel value displays
        if (this.channelFontValue) this.channelFontValue.textContent = this.channelFontSize;
        if (this.chatFontValue) this.chatFontValue.textContent = this.chatFontSize;
        if (this.uiFontValue) this.uiFontValue.textContent = this.uiFontSize;
        if (this.emoteSizeValue) this.emoteSizeValue.textContent = this.emoteSize;
    }

    // ---- Config ----

    loadConfig() {
        var self = this;
        fetch('config.json')
            .then(function (response) { return response.json(); })
            .then(function (config) {
                self.configLoaded = true;

                // VR scale multiplier from config
                if (config.vr_scale && typeof config.vr_scale === 'number') {
                    self.vrScale = config.vr_scale;
                }
                // VR detection threshold from config
                if (config.vr_width_threshold && typeof config.vr_width_threshold === 'number') {
                    self.vrWidthThreshold = config.vr_width_threshold;
                }

                // Desktop font defaults from config
                if (config.font_size && typeof config.font_size === 'number') {
                    self.desktopFonts.chat = config.font_size;
                }
                if (config.channel_font_size && typeof config.channel_font_size === 'number') {
                    self.desktopFonts.channel = config.channel_font_size;
                }
                if (config.ui_font_size && typeof config.ui_font_size === 'number') {
                    self.desktopFonts.ui = config.ui_font_size;
                }
                if (config.emote_size && typeof config.emote_size === 'number') {
                    self.desktopFonts.emote = config.emote_size;
                }

                // Generate VR defaults from desktop * scale (unless VR overrides exist in config)
                self.vrFonts.chat = config.vr_font_size || Math.round(self.desktopFonts.chat * self.vrScale);
                self.vrFonts.channel = config.vr_channel_font_size || Math.round(self.desktopFonts.channel * self.vrScale);
                self.vrFonts.ui = config.vr_ui_font_size || Math.round(self.desktopFonts.ui * self.vrScale);
                self.vrFonts.emote = config.vr_emote_size || Math.round(self.desktopFonts.emote * self.vrScale);

                // Re-apply font settings for current mode (config may have changed defaults)
                self.loadFontSettingsForMode(self.isVR);
                self.applyAllFontSizes();
                // Channel from config
                if (config.channel && config.channel !== 'your_channel_name') {
                    self.channel = config.channel.trim().toLowerCase();
                    if (self.channelInput) {
                        self.channelInput.value = self.channel;
                    }
                    self.showChat();
                    self.connectIRC();
                }
            })
            .catch(function (e) {
                self.configLoaded = true;
            });
    }

    connectToChannel() {
        var name = this.channelInput ? this.channelInput.value.trim().toLowerCase() : '';
        if (!name) return;

        this.disconnectIRC();
        this.channel = name;
        this.showChat();
        this.connectIRC();
    }

    disconnect() {
        this.disconnectIRC();
        this.channel = '';
        this.showSetup();
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
    }

    showChat() {
        if (this.setupScreen) this.setupScreen.style.display = 'none';
        if (this.chatWrap) this.chatWrap.classList.add('active');
        if (this.chatChannelName) this.chatChannelName.textContent = '#' + this.channel;
    }

    showSetup() {
        if (this.setupScreen) this.setupScreen.style.display = 'flex';
        if (this.chatWrap) this.chatWrap.classList.remove('active');
    }

    setStatus(text) {
        if (this.chatStatus) {
            this.chatStatus.textContent = text;
            this.chatStatus.style.display = '';
        }
    }

    // ---- Twitch IRC via WebSocket ----

    ensureConnected() {
        if (!this.channel) return;
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
            this.ws = null;
            this.connectIRC();
        }
    }

    connectIRC() {
        if (!this.channel) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

        var self = this;
        this.setStatus('Connecting to #' + this.channel + '...');

        try {
            this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        } catch (e) {
            this.setStatus('WebSocket not available');
            return;
        }

        this.ws.onopen = function () {
            self.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            self.ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
            self.ws.send('JOIN #' + self.channel);
            self.setStatus('Connected to #' + self.channel);

            setTimeout(function () {
                if (self.chatStatus) self.chatStatus.style.display = 'none';
            }, 3000);
        };

        this.ws.onmessage = function (event) {
            var lines = event.data.split('\r\n');
            for (var i = 0; i < lines.length; i++) {
                if (!lines[i]) continue;
                self.handleIRCMessage(lines[i]);
            }
        };

        this.ws.onclose = function () {
            self.setStatus('Reconnecting...');
            self.ws = null;
            if (self.channel) {
                setTimeout(function () {
                    self.connectIRC();
                }, 2000);
            }
        };

        this.ws.onerror = function () {
            self.setStatus('Connection error — retrying...');
        };
    }

    disconnectIRC() {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
        }
    }

    handleIRCMessage(raw) {
        if (raw.startsWith('PING')) {
            if (this.ws) this.ws.send('PONG :tmi.twitch.tv');
            return;
        }

        var privmsgIdx = raw.indexOf('PRIVMSG');
        if (privmsgIdx === -1) return;

        var displayName = 'user';
        var color = '#9146ff';
        var emotesTag = '';

        var tagsEnd = raw.indexOf(' :');
        if (raw.startsWith('@') && tagsEnd > 0) {
            var tagsStr = raw.substring(1, tagsEnd);
            var tags = tagsStr.split(';');
            for (var i = 0; i < tags.length; i++) {
                var kv = tags[i].split('=');
                if (kv[0] === 'display-name' && kv[1]) {
                    displayName = kv[1];
                }
                if (kv[0] === 'color' && kv[1]) {
                    color = kv[1];
                }
                if (kv[0] === 'emotes' && kv[1]) {
                    emotesTag = kv[1];
                }
            }
        }

        if (displayName === 'user') {
            var colonIdx = raw.indexOf(':', 1);
            if (colonIdx > 0) {
                var excIdx = raw.indexOf('!', colonIdx);
                if (excIdx > colonIdx) {
                    displayName = raw.substring(colonIdx + 1, excIdx);
                }
            }
        }

        var msgStart = raw.indexOf(':', privmsgIdx);
        if (msgStart === -1) return;
        var message = raw.substring(msgStart + 1);

        this.addChatMessage(displayName, color, message, emotesTag);
    }

    // ---- Emote Loading ----
    //
    // Strategy: Always show emote name as a styled text label immediately.
    // Attempt to load the emote image via multiple methods (Image object,
    // XHR, fetch). If any method succeeds, swap the text label for the image.
    // This ensures emotes are ALWAYS visible regardless of Coherent restrictions.

    getEmoteUrl(emoteId) {
        return 'https://static-cdn.jtvnws.net/emoticons/v2/' + emoteId + '/default/dark/2.0';
    }

    fetchEmote(emoteId) {
        // Already cached or in-flight
        if (this.emoteCache[emoteId] || this.emotePending[emoteId]) return;

        var self = this;
        this.emotePending[emoteId] = true;
        var url = this.getEmoteUrl(emoteId);

        // Method 1: Image object — works if Coherent allows external image loading
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            if (self.emoteCache[emoteId]) return; // another method already succeeded
            // Draw to canvas to get data URI
            try {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                var dataUri = canvas.toDataURL('image/png');
                self.emoteCache[emoteId] = dataUri;
                delete self.emotePending[emoteId];
                self.upgradeEmotePlaceholders(emoteId, dataUri);
            } catch (e) {
                // Canvas tainted or unavailable, try setting src directly
                self.emoteCache[emoteId] = url;
                delete self.emotePending[emoteId];
                self.upgradeEmotePlaceholders(emoteId, url);
            }
        };
        img.onerror = function () {
            // Method 1 failed, try Method 2
            self.fetchEmoteXHR(emoteId, url);
        };
        img.src = url;
    }

    fetchEmoteXHR(emoteId, url) {
        if (this.emoteCache[emoteId]) return;

        var self = this;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                if (self.emoteCache[emoteId]) return;
                if (xhr.status === 200) {
                    var bytes = new Uint8Array(xhr.response);
                    var binary = '';
                    for (var i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    var dataUri = 'data:image/png;base64,' + btoa(binary);
                    self.emoteCache[emoteId] = dataUri;
                    delete self.emotePending[emoteId];
                    self.upgradeEmotePlaceholders(emoteId, dataUri);
                } else {
                    self.fetchEmoteFetch(emoteId, url);
                }
            };
            xhr.onerror = function () {
                self.fetchEmoteFetch(emoteId, url);
            };
            xhr.send();
        } catch (e) {
            this.fetchEmoteFetch(emoteId, url);
        }
    }

    fetchEmoteFetch(emoteId, url) {
        if (this.emoteCache[emoteId]) return;

        var self = this;
        try {
            fetch(url)
                .then(function (r) { return r.blob(); })
                .then(function (blob) {
                    if (self.emoteCache[emoteId]) return;
                    var reader = new FileReader();
                    reader.onloadend = function () {
                        self.emoteCache[emoteId] = reader.result;
                        delete self.emotePending[emoteId];
                        self.upgradeEmotePlaceholders(emoteId, reader.result);
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(function () {
                    self.emoteCache[emoteId] = 'failed';
                    delete self.emotePending[emoteId];
                });
        } catch (e) {
            self.emoteCache[emoteId] = 'failed';
            delete self.emotePending[emoteId];
        }
    }

    upgradeEmotePlaceholders(emoteId, src) {
        // Replace text label placeholders with actual images
        if (!this.chatMessages) return;
        var labels = this.chatMessages.querySelectorAll('.emote-label[data-emote-id="' + emoteId + '"]');
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            var img = document.createElement('img');
            img.className = 'twitch-emote';
            img.src = src;
            img.alt = label.textContent;
            img.title = label.textContent;
            img.style.height = this.emoteSize + 'px';
            label.parentNode.replaceChild(img, label);
        }
    }

    // ---- Emote Parsing ----

    parseEmotes(emotesTag) {
        if (!emotesTag) return [];

        var emotes = [];
        var emoteGroups = emotesTag.split('/');
        for (var i = 0; i < emoteGroups.length; i++) {
            var parts = emoteGroups[i].split(':');
            if (parts.length < 2) continue;
            var emoteId = parts[0];
            var ranges = parts[1].split(',');
            for (var j = 0; j < ranges.length; j++) {
                var range = ranges[j].split('-');
                if (range.length < 2) continue;
                emotes.push({
                    id: emoteId,
                    start: parseInt(range[0]),
                    end: parseInt(range[1])
                });
            }
        }

        emotes.sort(function (a, b) { return a.start - b.start; });
        return emotes;
    }

    buildMessageContent(textEl, messageText, emotesTag) {
        var emotes = this.parseEmotes(emotesTag);

        if (emotes.length === 0) {
            textEl.textContent = ': ' + messageText;
            return;
        }

        // Kick off fetches for any emotes we haven't cached yet
        for (var i = 0; i < emotes.length; i++) {
            this.fetchEmote(emotes[i].id);
        }

        // Build DOM nodes: text spans + emote labels/images
        var chars = Array.from(messageText);
        textEl.appendChild(document.createTextNode(': '));

        var pos = 0;
        for (var i = 0; i < emotes.length; i++) {
            var e = emotes[i];
            // Text before this emote
            if (e.start > pos) {
                textEl.appendChild(document.createTextNode(chars.slice(pos, e.start).join('')));
            }

            var emoteName = chars.slice(e.start, e.end + 1).join('');

            if (this.emoteCache[e.id] && this.emoteCache[e.id] !== 'failed') {
                // Already cached — show image directly
                var img = document.createElement('img');
                img.className = 'twitch-emote';
                img.src = this.emoteCache[e.id];
                img.alt = emoteName;
                img.title = emoteName;
                img.style.height = this.emoteSize + 'px';
                textEl.appendChild(img);
            } else {
                // Show styled text label — will be upgraded to image if loading succeeds
                var label = document.createElement('span');
                label.className = 'emote-label';
                label.setAttribute('data-emote-id', e.id);
                label.textContent = emoteName;
                textEl.appendChild(label);
            }

            pos = e.end + 1;
        }
        // Remaining text
        if (pos < chars.length) {
            textEl.appendChild(document.createTextNode(chars.slice(pos).join('')));
        }
    }

    // ---- Chat Messages ----

    addChatMessage(name, color, text, emotesTag) {
        if (!this.chatMessages) return;
        if (!color || color === '') color = '#9146ff';

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';

        var nameEl = document.createElement('span');
        nameEl.className = 'chat-name';
        nameEl.style.color = color;
        nameEl.textContent = name;

        var textEl = document.createElement('span');
        textEl.className = 'chat-text';

        // Build message with emotes (DOM-based, no innerHTML)
        this.buildMessageContent(textEl, text, emotesTag);

        msgEl.appendChild(nameEl);
        msgEl.appendChild(textEl);
        this.chatMessages.appendChild(msgEl);

        while (this.chatMessages.children.length > this.maxMessages) {
            this.chatMessages.removeChild(this.chatMessages.firstChild);
        }

        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.disconnectIRC();
    }
}

window.customElements.define("ingamepanel-skydecktwitch", IngamePanelCustomPanel);
checkAutoload();
