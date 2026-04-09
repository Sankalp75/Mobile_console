/**
 * Mobile Console — WebSocket Client
 * The phone end of the tin-can telephone.
 *
 * Sends 3-byte binary messages to the PC:
 *   Byte 0: type  (1=button, 2=stick, 3=gyro)
 *   Byte 1: id    (which button/stick)
 *   Byte 2: value (pressed/released, or axis position)
 *
 * Also receives messages FROM the PC (vibration commands).
 *
 * Uses ArrayBuffer for binary — 3 bytes vs 60+ bytes for JSON.
 * That's a 20x reduction = faster transmission + faster parsing.
 */

const WS = (() => {
    let socket = null;
    let reconnectTimer = null;
    let reconnectDelay = 1000;      // Start at 1 second
    const MAX_RECONNECT_DELAY = 10000;  // Cap at 10 seconds
    const MAX_ATTEMPTS = 30;
    let attempts = 0;
    let intentionalClose = false;
    let wsPort = null;

    // Connection states
    const STATE = {
        CONNECTED: 'connected',
        RECONNECTING: 'reconnecting',
        DISCONNECTED: 'disconnected'
    };

    /**
     * Connect to the WebSocket server on the PC.
     * First fetches config from server to get correct WS port.
     */
    async function connect() {
        if (socket && socket.readyState === WebSocket.OPEN) return;

        if (wsPort === null) {
            const stored = localStorage.getItem('wsPort');
            if (stored) {
                wsPort = parseInt(stored);
                console.log(`[WS] Using stored WS port: ${wsPort}`);
            } else {
                try {
                    const resp = await fetch('/api/config');
                    const config = await resp.json();
                    wsPort = config.wsPort;
                    console.log(`[WS] Fetched WS port: ${wsPort}`);
                } catch (e) {
                    console.warn('[WS] Failed to fetch config, using fallback');
                    wsPort = parseInt(location.port || '3000') + 1;
                }
            }
        }

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = location.hostname || 'localhost';
        const url = `${protocol}//${hostname}:${wsPort}`;

        console.log(`[WS] Connecting to ${url}...`);
        updateStatus(STATE.RECONNECTING);

        try {
            socket = new WebSocket(url);
            socket.binaryType = 'arraybuffer';  // We speak binary, not text

            socket.onopen = () => {
                console.log('[WS] ✅ Connected!');
                updateStatus(STATE.CONNECTED);
                reconnectDelay = 1000;
                attempts = 0;
                intentionalClose = false;
            };

            socket.onmessage = (event) => {
                // Messages FROM the server (vibration commands, etc.)
                if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'vibrate') {
                            Haptics.play(msg.pattern);
                        }
                    } catch (e) {
                        console.warn('[WS] Invalid server message:', e);
                    }
                }
            };

            socket.onclose = () => {
                console.log('[WS] Connection closed.');
                updateStatus(STATE.DISCONNECTED);
                if (!intentionalClose) {
                    scheduleReconnect();
                }
            };

            socket.onerror = (err) => {
                console.error('[WS] Error:', err);
                // onclose will fire after this — reconnect handled there
            };

        } catch (e) {
            console.error('[WS] Failed to create WebSocket:', e);
            scheduleReconnect();
        }
    }

    /**
     * Send a binary message to the PC.
     * This is the hot path — called on every button press/release.
     * Must be as fast as possible.
     *
     * @param {number} type  - Message type (1=button, 2=stick, 3=gyro)
     * @param {number} id    - Which button/stick (0-13)
     * @param {number} value - What happened (0/1 for buttons, 0-255 for axes)
     */
    function send(type, id, value) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        // Create a 3-byte ArrayBuffer — the bare minimum
        const buffer = new ArrayBuffer(3);
        const view = new Uint8Array(buffer);
        view[0] = type;
        view[1] = id;
        view[2] = value;

        socket.send(buffer);
    }

    /**
     * Send a 4-byte message (for joystick with X + Y).
     *
     * @param {number} type  - Message type (2=stick)
     * @param {number} id    - Which stick (0=left, 1=right)
     * @param {number} x     - X axis (0-255, 128=center)
     * @param {number} y     - Y axis (0-255, 128=center)
     */
    function sendStick(type, id, x, y) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        const buffer = new ArrayBuffer(4);
        const view = new Uint8Array(buffer);
        view[0] = type;
        view[1] = id;
        view[2] = x;
        view[3] = y;

        socket.send(buffer);
    }

    /**
     * Schedule a reconnection attempt with exponential backoff.
     * Waits longer each time: 1s → 2s → 4s → 8s → 10s (cap).
     */
    function scheduleReconnect() {
        if (attempts >= MAX_ATTEMPTS) {
            console.log('[WS] Max reconnect attempts reached. Giving up.');
            updateStatus(STATE.DISCONNECTED);
            return;
        }

        attempts++;
        console.log(`[WS] Reconnecting in ${reconnectDelay / 1000}s... (attempt ${attempts}/${MAX_ATTEMPTS})`);
        updateStatus(STATE.RECONNECTING);

        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            connect();
        }, reconnectDelay);

        // Exponential backoff: double the delay, cap at max
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }

    /**
     * Update the visual connection status indicator.
     */
    function updateStatus(state) {
        const el = document.getElementById('connection-status');
        if (!el) return;

        el.className = 'status-dot ' + state;
        el.title = state.charAt(0).toUpperCase() + state.slice(1);
    }

    /**
     * Gracefully disconnect.
     */
    function disconnect() {
        intentionalClose = true;
        clearTimeout(reconnectTimer);
        if (socket) socket.close();
    }

    /**
     * Check if currently connected.
     */
    function isConnected() {
        return socket && socket.readyState === WebSocket.OPEN;
    }

    return { connect, send, sendStick, disconnect, isConnected };
})();
