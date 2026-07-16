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

            if (connectBtn.disabled) return;
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            try {
                const resp = await fetch('/api/verify/' + code, { signal: controller.signal });
                clearTimeout(timeout);

                if (!resp.ok) {
                    throw new Error('Server returned ' + resp.status);
                }

                const data = await resp.json();

                if (data.valid) {
                    try { localStorage.setItem('wsPort', data.wsPort); } catch (e) {}
                    connectScreen.style.display = 'none';
                    overlay.classList.remove('hidden');
                } else {
                    connectError.textContent = 'Invalid code';
                    connectError.classList.add('show');
                    connectBtn.disabled = false;
                    connectBtn.textContent = 'Connect';
                }
            } catch (e) {
                clearTimeout(timeout);
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

    /**
     * Sanitize a profile name: alphanumeric, spaces, hyphens, underscores, periods only.
     * Prevents XSS, prototype pollution, and localStorage key corruption.
     * @param {string} raw
     * @returns {string|null} sanitized name, or null if empty/invalid
     */
    function sanitizeName(raw) {
        if (typeof raw !== 'string') return null;
        const trimmed = raw.trim().substring(0, 64);
        if (!trimmed) return null;
        const sanitized = trimmed.replace(/[^\w\s.\-]/g, '');
        return sanitized || null;
    }

    /**
     * Show a secure modal dialog for text input
     * @param {string} title - Dialog title
     * @param {string} placeholder - Input placeholder
     * @param {string} initialValue - Initial input value (optional)
     * @returns {Promise<string|null>} - User input or null if cancelled
     */
    function showInputDialog(title, placeholder, initialValue = '') {
        return new Promise((resolve) => {
            // Create modal elements
            const modal = document.createElement('div');
            modal.className = 'input-dialog-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'dialog-title');

            const overlay = document.createElement('div');
            overlay.className = 'input-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'input-dialog';

            const titleEl = document.createElement('h2');
            titleEl.id = 'dialog-title';
            titleEl.textContent = title;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input-dialog-input';
            input.placeholder = placeholder;
            input.value = initialValue;
            input.maxLength = '64'; // Prevent extremely long inputs

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'input-dialog-buttons';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'input-dialog-btn cancel-btn';

            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.className = 'input-dialog-btn ok-btn';

            // Event handlers
            function closeDialog(value) {
                modal.remove();
                resolve(value);
            }

            okBtn.addEventListener('click', () => {
                closeDialog(input.value.trim());
            });

            cancelBtn.addEventListener('click', () => {
                closeDialog(null);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    closeDialog(input.value.trim());
                }
                if (e.key === 'Escape') {
                    closeDialog(null);
                }
            });

            // Assemble dialog
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(okBtn);

            dialog.appendChild(titleEl);
            dialog.appendChild(input);
            dialog.appendChild(buttonContainer);

            modal.appendChild(overlay);
            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // Focus input
            input.focus();
        });
    }

    /**
     * Show a secure modal dialog for confirmation
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} - User choice
     */
    function showConfirmDialog(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'input-dialog-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            const overlay = document.createElement('div');
            overlay.className = 'input-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'input-dialog';

            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.marginBottom = '1.5rem';

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'input-dialog-buttons';

            const noBtn = document.createElement('button');
            noBtn.textContent = 'No';
            noBtn.className = 'input-dialog-btn cancel-btn';

            const yesBtn = document.createElement('button');
            yesBtn.textContent = 'Yes';
            yesBtn.className = 'input-dialog-btn ok-btn';

            function closeDialog(result) {
                modal.remove();
                resolve(result);
            }

            yesBtn.addEventListener('click', () => {
                closeDialog(true);
            });

            noBtn.addEventListener('click', () => {
                closeDialog(false);
            });

            buttonContainer.appendChild(noBtn);
            buttonContainer.appendChild(yesBtn);

            dialog.appendChild(messageEl);
            dialog.appendChild(buttonContainer);

            modal.appendChild(overlay);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
        });
    }

    /**
     * Show a secure modal alert dialog
     * @param {string} message - Alert message
     * @returns {Promise<void>}
     */
    function showAlertDialog(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'input-dialog-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            const overlay = document.createElement('div');
            overlay.className = 'input-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'input-dialog';

            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.marginBottom = '1.5rem';

            const btn = document.createElement('button');
            btn.textContent = 'OK';
            btn.className = 'input-dialog-btn ok-btn';
            btn.addEventListener('click', () => {
                modal.remove();
                resolve();
            });

            dialog.appendChild(messageEl);
            dialog.appendChild(btn);
            modal.appendChild(overlay);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
        });
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
        document.getElementById('save-profile')?.addEventListener('click', async () => {
            const raw = await showInputDialog('Save Profile', 'Enter profile name:');
            if (raw === null) return;
            const safeName = sanitizeName(raw);
            if (!safeName) {
                await showAlertDialog('Invalid name — use letters, numbers, spaces, hyphens, underscores, or periods.');
                return;
            }
            Layout.saveProfile(safeName);
            await showAlertDialog('Saved: ' + safeName);
        });

        document.getElementById('load-profile')?.addEventListener('click', async () => {
            const profiles = Layout.getProfileList();
            if (profiles.length === 0) {
                await showAlertDialog('No saved profiles');
                return;
            }
            const raw = await showInputDialog('Load Profile', 'Select profile:', profiles[0]);
            if (raw === null) return;
            const name = sanitizeName(raw);
            if (!name || !profiles.includes(name)) {
                await showAlertDialog('Profile not found.');
                return;
            }
            Layout.loadProfile(name);
        });

        document.getElementById('reset-profile')?.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog('Reset to default layout?');
            if (confirmed) {
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