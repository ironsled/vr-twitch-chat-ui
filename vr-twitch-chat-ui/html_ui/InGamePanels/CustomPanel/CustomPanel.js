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

        // Emote cache: maps emote ID -> data URI (or 'loading'/'failed')
        this.emoteCache = {};
        this.emotePending = {}; // emote IDs currently being fetched

        // Settings panel state
        this.settingsOpen = false;

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

        // Clear any stale position data from previous version that interfered with MSFS dragging
        this.setStored('PanelPos', '');

        // Restore saved font settings from persistent storage (overrides config defaults)
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
