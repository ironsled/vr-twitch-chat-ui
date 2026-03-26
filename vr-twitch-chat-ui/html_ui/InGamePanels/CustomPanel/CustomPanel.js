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

        // Font size defaults
        this.chatFontSize = 28;
        this.channelFontSize = 16;
        this.uiFontSize = 12;
        this.emoteSize = 28;

        this.minFontSize = 8;
        this.maxFontSize = 72;
        this.fontStep = 2;

        // Emote cache: maps emote ID -> URL
        this.emoteCache = {};

        // Settings panel state
        this.settingsOpen = false;

        // Position memory
        this.storagePrefix = 'SKYDECK_TWITCH_';
        this.lastSavedPos = '';
        this.positionRestored = false;

        // Default panel position/size (used by reset)
        this.defaultLeft = 50;
        this.defaultTop = 50;
        this.defaultWidth = 400;
        this.defaultHeight = 600;

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
        this.resetPosBtn = document.getElementById("ResetPosBtn");

        // Settings value displays
        this.channelFontValue = document.getElementById("ChannelFontValue");
        this.chatFontValue = document.getElementById("ChatFontValue");
        this.uiFontValue = document.getElementById("UIFontValue");
        this.emoteSizeValue = document.getElementById("EmoteSizeValue");

        // Restore saved font settings from persistent storage (overrides config defaults)
        this.restoreFontSettings();

        // Restore saved panel position
        this.restorePanelPosition();

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

        // Reset position button
        if (this.resetPosBtn) {
            this.resetPosBtn.addEventListener("click", function () {
                self.resetPanelPosition();
            });
        }

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

        // Periodic position save (every 2 seconds)
        setInterval(function () {
            self.savePanelPosition();
        }, 2000);

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

    // ---- Panel Position Memory ----

    getPanelElement() {
        // The ingame-ui element or its parent is what gets positioned by MSFS
        if (this.ingameUi) return this.ingameUi;
        return null;
    }

    savePanelPosition() {
        var panel = this.getPanelElement();
        if (!panel) return;

        var rect = panel.getBoundingClientRect();
        // Also capture computed style for left/top/width/height which MSFS sets
        var style = window.getComputedStyle(panel);
        var pos = {
            left: panel.style.left || style.left,
            top: panel.style.top || style.top,
            width: panel.style.width || style.width,
            height: panel.style.height || style.height,
            rectLeft: Math.round(rect.left),
            rectTop: Math.round(rect.top),
            rectWidth: Math.round(rect.width),
            rectHeight: Math.round(rect.height)
        };

        var posStr = JSON.stringify(pos);
        // Only save if position actually changed
        if (posStr !== this.lastSavedPos) {
            this.lastSavedPos = posStr;
            this.setStored('PanelPos', posStr);
        }
    }

    restorePanelPosition() {
        var self = this;
        var posStr = this.getStored('PanelPos');
        if (!posStr) return;

        try {
            var pos = JSON.parse(posStr);
            // Wait for the panel to be rendered, then apply
            var attempts = 0;
            var restoreInterval = setInterval(function () {
                attempts++;
                var panel = self.getPanelElement();
                if (panel && panel.getBoundingClientRect().width > 0) {
                    if (pos.left) panel.style.left = pos.left;
                    if (pos.top) panel.style.top = pos.top;
                    if (pos.width) panel.style.width = pos.width;
                    if (pos.height) panel.style.height = pos.height;
                    self.positionRestored = true;
                    clearInterval(restoreInterval);
                }
                if (attempts > 30) {
                    clearInterval(restoreInterval);
                }
            }, 100);
        } catch (e) {
            // Invalid stored data, ignore
        }
    }

    resetPanelPosition() {
        var panel = this.getPanelElement();
        if (!panel) return;

        panel.style.left = this.defaultLeft + 'px';
        panel.style.top = this.defaultTop + 'px';
        panel.style.width = this.defaultWidth + 'px';
        panel.style.height = this.defaultHeight + 'px';

        // Clear saved position so it uses defaults next time too
        this.setStored('PanelPos', '');
        this.lastSavedPos = '';

        this.setStatus('Position reset');
        var self = this;
        setTimeout(function () {
            if (self.chatStatus) self.chatStatus.style.display = 'none';
        }, 2000);
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

    // ---- Font Settings Persistence ----

    saveFontSettings() {
        var settings = JSON.stringify({
            chatFontSize: this.chatFontSize,
            channelFontSize: this.channelFontSize,
            uiFontSize: this.uiFontSize,
            emoteSize: this.emoteSize
        });
        this.setStored('FontSettings', settings);
    }

    restoreFontSettings() {
        var settingsStr = this.getStored('FontSettings');
        if (!settingsStr) return;
        try {
            var s = JSON.parse(settingsStr);
            if (s.chatFontSize) this.chatFontSize = this.clampFont(s.chatFontSize);
            if (s.channelFontSize) this.channelFontSize = this.clampFont(s.channelFontSize);
            if (s.uiFontSize) this.uiFontSize = this.clampFont(s.uiFontSize);
            if (s.emoteSize) this.emoteSize = this.clampFont(s.emoteSize);
        } catch (e) {}
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
                // Font sizes from config
                if (config.font_size && typeof config.font_size === 'number') {
                    self.chatFontSize = self.clampFont(config.font_size);
                }
                if (config.channel_font_size && typeof config.channel_font_size === 'number') {
                    self.channelFontSize = self.clampFont(config.channel_font_size);
                }
                if (config.ui_font_size && typeof config.ui_font_size === 'number') {
                    self.uiFontSize = self.clampFont(config.ui_font_size);
                }
                if (config.emote_size && typeof config.emote_size === 'number') {
                    self.emoteSize = self.clampFont(config.emote_size);
                }
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

    // ---- Emote Parsing ----

    parseEmotes(emotesTag, messageText) {
        // emotesTag format: "emoteId:start-end,start-end/emoteId:start-end"
        // Returns array of {id, start, end} sorted by start position descending
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

        // Sort descending by start so we can replace from end to start
        emotes.sort(function (a, b) { return b.start - a.start; });
        return emotes;
    }

    buildMessageHTML(messageText, emotesTag) {
        var emotes = this.parseEmotes(emotesTag, messageText);

        if (emotes.length === 0) {
            return this.escapeHTML(messageText);
        }

        // Build array of text segments and emote images
        // Work from end to start to preserve indices
        var chars = Array.from(messageText);
        var result = [];
        var lastIdx = chars.length;

        // Sort ascending for forward iteration
        emotes.sort(function (a, b) { return a.start - b.start; });

        var pos = 0;
        for (var i = 0; i < emotes.length; i++) {
            var e = emotes[i];
            // Text before this emote
            if (e.start > pos) {
                result.push(this.escapeHTML(chars.slice(pos, e.start).join('')));
            }
            // Emote image - use 2.0 scale for VR readability
            var emoteUrl = 'https://static-cdn.jtvnbs.net/emoticons/v2/' + e.id + '/default/dark/2.0';
            var emoteName = this.escapeHTML(chars.slice(e.start, e.end + 1).join(''));
            result.push('<img class="twitch-emote" src="' + emoteUrl + '" alt="' + emoteName + '" title="' + emoteName + '" style="height:' + this.emoteSize + 'px" />');
            pos = e.end + 1;
        }
        // Remaining text after last emote
        if (pos < chars.length) {
            result.push(this.escapeHTML(chars.slice(pos).join('')));
        }

        return result.join('');
    }

    escapeHTML(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

        // Build message with emotes
        var messageHTML = this.buildMessageHTML(text, emotesTag);
        textEl.innerHTML = ': ' + messageHTML;

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
