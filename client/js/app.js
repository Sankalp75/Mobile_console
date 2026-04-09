/**
 * Mobile Console — App Initialization
 * Fully dynamic, Layout-driven controller
 */

const App = (() => {
    const MSG_BUTTON = 0x01;

    // Action to button ID mapping
    const ACTION_TO_ID = {
        A: 0, B: 1, X: 2, Y: 3,
        LB: 4, RB: 5, BACK: 6, START: 7,
        L_THUMB: 8, R_THUMB: 9,
        DPAD_UP: 10, DPAD_DOWN: 11, DPAD_LEFT: 12, DPAD_RIGHT: 13,
        LT: 14, RT: 15, GUIDE: 16
    };

    function init() {
        console.log('[App] Mobile Console loading...');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        const connectScreen = document.getElementById('connect-screen');
        const connectBtn = document.getElementById('connect-btn');
        const connectCode = document.getElementById('connect-code');
        const connectError = document.getElementById('connect-error');
        const overlay = document.getElementById('start-overlay');
        const startBtn = document.getElementById('start-btn');
        const controller = document.getElementById('controller');

        // Connect screen
        connectBtn.addEventListener('click', async () => {
            const code = connectCode.value.trim();
            if (code.length !== 6) {
                connectError.textContent = 'Please enter a 6-digit code';
                connectError.classList.add('show');
                return;
            }

            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';

            try {
                const resp = await fetch('/api/verify/' + code);
                const data = await resp.json();

                if (data.valid) {
                    localStorage.setItem('wsPort', data.wsPort);
                    connectScreen.style.display = 'none';
                    overlay.classList.remove('hidden');
                } else {
                    connectError.textContent = 'Invalid code';
                    connectError.classList.add('show');
                    connectBtn.disabled = false;
                    connectBtn.textContent = 'Connect';
                }
            } catch (e) {
                connectError.textContent = 'Connection failed';
                connectError.classList.add('show');
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect';
            }
        });

        connectCode.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
            connectError.classList.remove('show');
        });

        connectCode.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') connectBtn.click();
        });

        // Theme selection
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.body.className = 'theme-' + btn.dataset.theme;
            });
        });

        // Start button
        startBtn.addEventListener('click', async () => {
            await startController();
            overlay.classList.add('hidden');
            controller.classList.remove('hidden');
        });

        console.log('[App] Setup complete');
    }

    async function startController() {
        // Fullscreen
        try {
            await document.documentElement.requestFullscreen();
        } catch (e) {}

        // Landscape
        try {
            await screen.orientation.lock('landscape');
        } catch (e) {}

        // Wake lock
        let wakeLock = null;
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (e) {}

        // WebSocket
        WS.connect();

        // Initialize Layout engine with action handler
        Layout.init();
        Layout.onSetAction((type, action, x, y) => {
            handleAction(type, action, x, y);
        });

        // Load saved layout
        Layout.loadLayout();

        // Initialize sensors
        await Sensors.init();

        // Setup settings panel
        setupSettingsPanel();

        console.log('[App] 🎮 Controller ready!');
    }

    function handleAction(type, action, x, y) {
        if (!WS.isConnected()) return;

        if (type === 'press') {
            const btnId = ACTION_TO_ID[action];
            if (btnId !== undefined) {
                WS.send(MSG_BUTTON, btnId, 1);
            }
        } else if (type === 'release') {
            const btnId = ACTION_TO_ID[action];
            if (btnId !== undefined) {
                WS.send(MSG_BUTTON, btnId, 0);
            }
        } else if (type === 'stick') {
            const stickId = action === 'L_STICK' ? 0 : 1;
            WS.sendStick(0x02, stickId, x || 128, y || 128);
        }
    }

    function setupSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        const closeBtn = document.getElementById('settings-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                panel.classList.add('hidden');
            });
        }

        // Gyro toggle
        const gyroToggle = document.getElementById('setting-gyro');
        if (gyroToggle) {
            gyroToggle.addEventListener('change', (e) => {
                Layout.updateSetting('gyroEnabled', e.target.checked);
            });
        }

        // Gyro sensitivity
        const gyroSens = document.getElementById('setting-gyro-sens');
        if (gyroSens) {
            gyroSens.addEventListener('change', (e) => {
                Layout.updateSetting('gyroSensitivity', parseFloat(e.target.value));
            });
        }

        // Haptic toggle
        const hapticToggle = document.getElementById('setting-haptic');
        if (hapticToggle) {
            hapticToggle.addEventListener('change', (e) => {
                Layout.updateSetting('hapticFeedback', e.target.checked);
            });
        }

        // Profile buttons
        document.getElementById('save-profile')?.addEventListener('click', () => {
            const name = prompt('Profile name:');
            if (name) {
                Layout.saveProfile(name);
                alert('Saved: ' + name);
            }
        });

        document.getElementById('load-profile')?.addEventListener('click', () => {
            const profiles = Layout.getProfileList();
            if (profiles.length === 0) {
                alert('No saved profiles');
                return;
            }
            const name = prompt('Profile to load:\n' + profiles.join('\n'));
            if (name && profiles.includes(name)) {
                Layout.loadProfile(name);
            }
        });

        document.getElementById('reset-profile')?.addEventListener('click', () => {
            if (confirm('Reset to default layout?')) {
                Layout.resetLayout();
            }
        });

        // Add button handlers
        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.add;
                Layout.addButton({
                    type: type,
                    x: 50, y: 50,
                    w: type === 'joystick' ? 100 : 50,
                    h: type === 'joystick' ? 100 : 50,
                    label: type === 'button' ? '?' : 'S',
                    action: 'A'
                });
            });
        });
    }

    return { init };
})();

App.init();