/**
 * Mobile Console — App Initialization (Phase 3)
 * The conductor — starts everything in the right order.
 *
 * Phase 2: Joysticks, gyroscope, volume buttons, triggers, sensors
 * Phase 3: Layout editor, profiles, response curves, long-press to edit
 */

const App = (() => {
    const MSG_BUTTON = 0x01;

    /**
     * Boot sequence — called when the page loads.
     */
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
                    connectError.classList.remove('show');
                    connectScreen.style.display = 'none';
                    overlay.classList.remove('hidden');
                } else {
                    connectError.textContent = 'Invalid code. Please try again.';
                    connectError.classList.add('show');
                    connectBtn.disabled = false;
                    connectBtn.textContent = 'Connect';
                }
            } catch (e) {
                connectError.textContent = 'Connection failed. Check your network.';
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

        startBtn.addEventListener('click', async () => {
            // ─── Fullscreen ─────────────────────────────────────
            try {
                await document.documentElement.requestFullscreen();
                console.log('[App] ✅ Fullscreen activated');
            } catch (e) {
                console.warn('[App] Fullscreen not available:', e.message);
            }

            // ─── Landscape Lock ─────────────────────────────────
            try {
                await screen.orientation.lock('landscape');
                console.log('[App] ✅ Landscape locked');
            } catch (e) {
                console.warn('[App] Orientation lock not available:', e.message);
            }

            // ─── Wake Lock (keep screen on) ─────────────────────
            let wakeLock = null;
            let wakeLockWantActive = true;
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[App] ✅ Wake lock active — screen will stay on');

                    document.addEventListener('visibilitychange', async () => {
                        if (document.visibilityState === 'visible' && wakeLockWantActive) {
                            try {
                                wakeLock = await navigator.wakeLock.request('screen');
                            } catch (e) { /* ignore */ }
                        }
                    });
                }
            } catch (e) {
                console.warn('[App] Wake lock not available:', e.message);
            }

            // ─── Connect WebSocket ──────────────────────────────
            WS.connect();

            // ─── Initialize Touch ───────────────────────────────
            Touch.init();

            // ─── Initialize Joysticks ───────────────────────────
            Joystick.create('stick-left', 0);   // Left stick  → stickId 0
            Joystick.create('stick-right', 1);  // Right stick → stickId 1
            console.log('[App] ✅ Joysticks initialized');

            // ─── Initialize Sensors ─────────────────────────────
            const caps = await Sensors.init();
            console.log('[App] Sensor capabilities:', caps);

            // Shake → send a button press (can be remapped later)
            Sensors.onShake(() => {
                console.log('[App] Shake! Sending L_THUMB click');
                WS.send(MSG_BUTTON, 8, 1);  // L_THUMB press
                setTimeout(() => WS.send(MSG_BUTTON, 8, 0), 100);  // Release after 100ms
            });

            // Battery low warning
            Sensors.onBatteryLow((level) => {
                console.log(`[App] ⚠️ Battery low: ${Math.round(level * 100)}%`);
                // Could show a visual warning toast here
            });

            // ─── Setup Gyro Toggle ──────────────────────────────
            setupGyroToggle();

            // ─── Setup Analog Triggers ──────────────────────────
            setupTriggers();

            // ─── Setup Volume Buttons ───────────────────────────
            setupVolumeButtons();

            // ─── Initialize Layout Editor (Phase 3) ─────────────
            Layout.init();
            Layout.loadLayout();  // Restore saved button positions
            console.log('[App] ✅ Layout editor ready (long-press ⚙ to edit)');

            // ─── Setup Edit Mode Activation ──────────────────────
            setupEditModeGesture();

            // ─── Show Controller ────────────────────────────────
            overlay.classList.add('hidden');
            controller.classList.remove('hidden');

            console.log('[App] 🎮 Controller is live!');
        });

        // Global event prevention
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                console.log('[App] Exited fullscreen — controller still works');
            }
        });

        document.addEventListener('dblclick', e => e.preventDefault());

        document.body.addEventListener('touchmove', e => {
            if (e.touches.length === 1) {
                if (!e.target.closest('.scrollable')) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        console.log('[App] Setup complete — waiting for user to tap Start.');
    }

    // ─── GYRO TOGGLE ────────────────────────────────────────────

    function setupGyroToggle() {
        const gyroBtn = document.getElementById('gyro-toggle');
        if (!gyroBtn) return;

        // Hold to activate gyro, release to deactivate
        gyroBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gyroBtn.classList.add('gyro-active');
            Sensors.activateGyro();
            Haptics.tap();
        }, { passive: false });

        gyroBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            gyroBtn.classList.remove('gyro-active');
            Sensors.deactivateGyro();
        }, { passive: false });

        gyroBtn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            gyroBtn.classList.remove('gyro-active');
            Sensors.deactivateGyro();
        }, { passive: false });

        console.log('[App] ✅ Gyro toggle ready (hold to aim)');
    }

    // ─── ANALOG TRIGGERS (LT / RT) ─────────────────────────────

    function setupTriggers() {
        const ltZone = document.getElementById('trigger-lt');
        const rtZone = document.getElementById('trigger-rt');

        if (ltZone) setupSingleTrigger(ltZone, 'lt');
        if (rtZone) setupSingleTrigger(rtZone, 'rt');

        console.log('[App] ✅ Analog triggers ready');
    }

    function setupSingleTrigger(zone, side) {
        const buttonId = side === 'lt' ? 4 : 5;  // LB/RB

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            zone.classList.add('active');
            Haptics.tap();
            WS.send(MSG_BUTTON, buttonId, 1);
        }, { passive: false });

        zone.addEventListener('touchend', (e) => {
            e.preventDefault();
            zone.classList.remove('active');
            WS.send(MSG_BUTTON, buttonId, 0);
        }, { passive: false });

        zone.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            zone.classList.remove('active');
            WS.send(MSG_BUTTON, buttonId, 0);
        }, { passive: false });
    }

    // ─── VOLUME BUTTONS → SHOULDER BUTTONS ──────────────────────

    function setupVolumeButtons() {
        // Volume Up → RB (button ID 5)
        // Volume Down → LB (button ID 4)
        // Only works in fullscreen mode
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
                e.preventDefault();
                WS.send(MSG_BUTTON, 5, 1);  // RB pressed

                // Visual feedback on the RB button
                const rb = document.querySelector('.bumper-btn.rb');
                if (rb) rb.classList.add('active');

                Haptics.tap();
            }
            else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
                e.preventDefault();
                WS.send(MSG_BUTTON, 4, 1);  // LB pressed

                const lb = document.querySelector('.bumper-btn.lb');
                if (lb) lb.classList.add('active');

                Haptics.tap();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
                e.preventDefault();
                WS.send(MSG_BUTTON, 5, 0);  // RB released

                const rb = document.querySelector('.bumper-btn.rb');
                if (rb) rb.classList.remove('active');
            }
            else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
                e.preventDefault();
                WS.send(MSG_BUTTON, 4, 0);  // LB released

                const lb = document.querySelector('.bumper-btn.lb');
                if (lb) lb.classList.remove('active');
            }
        });

        console.log('[App] ✅ Volume buttons mapped (Vol+ → RB, Vol- → LB)');
    }

    // ─── EDIT MODE LONG-PRESS GESTURE ────────────────────────────

    function setupEditModeGesture() {
        let longPressTimer = null;
        const LONG_PRESS_MS = 1500;  // Hold for 1.5 seconds to enter edit mode

        // Long-press on the connection status dot to enter edit mode
        const trigger = document.getElementById('connection-status');
        if (!trigger) return;

        trigger.addEventListener('touchstart', (e) => {
            e.preventDefault();
            longPressTimer = setTimeout(() => {
                if (!Layout.isEditMode()) {
                    Layout.enterEditMode();
                }
            }, LONG_PRESS_MS);
        }, { passive: false });

        trigger.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        trigger.addEventListener('touchcancel', () => {
            clearTimeout(longPressTimer);
        });

        // Also support keyboard shortcut (for desktop testing)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'e' && e.ctrlKey) {
                e.preventDefault();
                if (Layout.isEditMode()) {
                    Layout.exitEditMode();
                } else {
                    Layout.enterEditMode();
                }
            }
        });

        console.log('[App] ✅ Edit mode: long-press status dot or Ctrl+E');
    }

    return { init };
})();

// 🚀 Launch!
App.init();
