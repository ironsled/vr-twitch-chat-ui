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
        this.fontSize = 28;       // Default VR-friendly size
        this.minFontSize = 14;
        this.maxFontSize = 48;
        this.fontStep = 4;
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

        if (this.fontUpBtn) {
            this.fontUpBtn.addEventListener("click", function () {
                self.changeFontSize(self.fontStep);
            });
        }

        if (this.fontDownBtn) {
            this.fontDownBtn.addEventListener("click", function () {
                self.changeFontSize(-self.fontStep);
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

        // Apply initial font size
        this.applyFontSize();
    }

    initialize() {
        if (this.started) return;
        this.started = true;
    }

    // ---- Font Size ----

    changeFontSize(delta) {
        this.fontSize = Math.max(this.minFontSize, Math.min(this.maxFontSize, this.fontSize + delta));
        this.applyFontSize();
    }

    applyFontSize() {
        if (this.chatMessages) {
            this.chatMessages.style.fontSize = this.fontSize + 'px';
        }
        if (this.fontSizeLabel) {
            this.fontSizeLabel.textContent = this.fontSize;
        }
    }

    // ---- Config ----

    loadConfig() {
        var self = this;
        fetch('config.json')
            .then(function (response) { return response.json(); })
            .then(function (config) {
                self.configLoaded = true;
                // Font size from config
                if (config.font_size && typeof config.font_size === 'number') {
                    self.fontSize = Math.max(self.minFontSize, Math.min(self.maxFontSize, config.font_size));
                    self.applyFontSize();
                }
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

        this.addChatMessage(displayName, color, message);
    }

    addChatMessage(name, color, text) {
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
        textEl.textContent = ': ' + text;

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
