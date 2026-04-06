/**
 * Mobile Console — Sensors Module
 * Reads gyroscope, accelerometer, and battery data from the phone.
 *
 * Gyroscope aiming (the star feature):
 *   - DeviceOrientation API gives us alpha/beta/gamma angles
 *   - We store a "reference" position when gyro is activated
 *   - Delta from reference = how far you've tilted
 *   - Delta is smoothed (rolling average of last N readings) to reduce jitter
 *   - Mapped to right stick values and sent to PC
 *   - "Hold to activate" pattern: gyro only active while a toggle is held
 *
 * Accelerometer:
 *   - DeviceMotion API gives acceleration values
 *   - We detect shakes by checking if acceleration exceeds a threshold
 *   - Shake can be mapped to reload, dodge, etc.
 *
 * Battery:
 *   - Battery API reports charge level and charging status
 *   - We show warnings at low battery
 */

const Sensors = (() => {
    const MSG_GYRO = 0x03;

    // ─── Gyroscope State ────────────────────────────────────────
    let gyroEnabled = false;
    let gyroActive = false;         // Is the user currently holding the gyro toggle?
    let gyroSupported = false;

    // Reference orientation — set when gyro is activated
    let refBeta = 0;                // Forward/back tilt reference
    let refGamma = 0;              // Left/right tilt reference

    // Smoothing buffer — rolling average to reduce jitter
    const SMOOTHING_SAMPLES = 4;
    const betaBuffer = [];
    const gammaBuffer = [];

    // Sensitivity multiplier (user-configurable, default 1.0)
    let gyroSensitivity = 1.0;

    // Maximum tilt angle (degrees) that maps to full stick deflection
    const MAX_TILT = 25;

    // ─── Accelerometer State ────────────────────────────────────
    let accelSupported = false;
    const SHAKE_THRESHOLD = 20;    // m/s² — above this counts as a shake
    let lastShakeTime = 0;
    const SHAKE_COOLDOWN = 500;    // ms between shake detections
    let onShakeCallback = null;

    // ─── Battery State ──────────────────────────────────────────
    let batterySupported = false;
    let batteryLevel = 1.0;
    let batteryCharging = true;
    let onBatteryLowCallback = null;

    // ─── Initialization ─────────────────────────────────────────

    /**
     * Initialize all available sensors.
     * Call once during app startup.
     */
    async function init() {
        // ─── Gyroscope ──────────────────────────────────────────
        if ('DeviceOrientationEvent' in window) {
            // Some browsers (iOS 13+) require permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const perm = await DeviceOrientationEvent.requestPermission();
                    gyroSupported = (perm === 'granted');
                } catch (e) {
                    gyroSupported = false;
                }
            } else {
                gyroSupported = true;
            }

            if (gyroSupported) {
                window.addEventListener('deviceorientation', handleOrientation);
                console.log('[Sensors] ✅ Gyroscope available');
            }
        }

        // ─── Accelerometer ──────────────────────────────────────
        if ('DeviceMotionEvent' in window) {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const perm = await DeviceMotionEvent.requestPermission();
                    accelSupported = (perm === 'granted');
                } catch (e) {
                    accelSupported = false;
                }
            } else {
                accelSupported = true;
            }

            if (accelSupported) {
                window.addEventListener('devicemotion', handleMotion);
                console.log('[Sensors] ✅ Accelerometer available');
            }
        }

        // ─── Battery ────────────────────────────────────────────
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                batterySupported = true;
                batteryLevel = battery.level;
                batteryCharging = battery.charging;

                battery.addEventListener('levelchange', () => {
                    batteryLevel = battery.level;
                    checkBatteryWarning();
                });
                battery.addEventListener('chargingchange', () => {
                    batteryCharging = battery.charging;
                });

                console.log(`[Sensors] ✅ Battery: ${Math.round(batteryLevel * 100)}%${batteryCharging ? ' (charging)' : ''}`);
            } catch (e) {
                batterySupported = false;
            }
        }

        return {
            gyro: gyroSupported,
            accel: accelSupported,
            battery: batterySupported
        };
    }

    // ─── GYROSCOPE ──────────────────────────────────────────────

    function handleOrientation(event) {
        if (!gyroActive) return;

        const beta = event.beta;     // -180 to 180 (front/back tilt)
        const gamma = event.gamma;   // -90 to 90 (left/right tilt)

        if (beta === null || gamma === null) return;

        // Calculate delta from reference position
        let deltaBeta = beta - refBeta;
        let deltaGamma = gamma - refGamma;

        // Add to smoothing buffer
        betaBuffer.push(deltaBeta);
        gammaBuffer.push(deltaGamma);
        if (betaBuffer.length > SMOOTHING_SAMPLES) betaBuffer.shift();
        if (gammaBuffer.length > SMOOTHING_SAMPLES) gammaBuffer.shift();

        // Calculate smoothed average
        const smoothBeta = betaBuffer.reduce((a, b) => a + b, 0) / betaBuffer.length;
        const smoothGamma = gammaBuffer.reduce((a, b) => a + b, 0) / gammaBuffer.length;

        // Apply sensitivity
        const adjustedBeta = smoothBeta * gyroSensitivity;
        const adjustedGamma = smoothGamma * gyroSensitivity;

        // Map tilt angles to 0-255 axis values (128 = center)
        // Clamp to MAX_TILT degrees = full deflection
        const xAxis = Math.round(128 + (adjustedGamma / MAX_TILT) * 127);
        const yAxis = Math.round(128 + (adjustedBeta / MAX_TILT) * 127);

        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(255, xAxis));
        const clampedY = Math.max(0, Math.min(255, yAxis));

        // Send as right stick input
        WS.sendStick(MSG_GYRO, 1, clampedX, clampedY);
    }

    /**
     * Activate gyroscope aiming.
     * Call when the gyro toggle button is pressed.
     * Sets the current phone orientation as the "zero" reference.
     */
    function activateGyro() {
        if (!gyroSupported) return;
        gyroActive = true;

        // Clear smoothing buffers
        betaBuffer.length = 0;
        gammaBuffer.length = 0;

        // Capture current orientation as reference ("zero point")
        // This happens via the next deviceorientation event
        const captureRef = (event) => {
            refBeta = event.beta || 0;
            refGamma = event.gamma || 0;
            window.removeEventListener('deviceorientation', captureRef);
        };
        window.addEventListener('deviceorientation', captureRef);

        console.log('[Sensors] Gyro activated — current position = zero');
    }

    /**
     * Deactivate gyroscope aiming.
     * Call when the gyro toggle button is released.
     */
    function deactivateGyro() {
        gyroActive = false;

        // Send centered position
        WS.sendStick(MSG_GYRO, 1, 128, 128);

        console.log('[Sensors] Gyro deactivated');
    }

    // ─── ACCELEROMETER (SHAKE DETECTION) ────────────────────────

    function handleMotion(event) {
        const accel = event.accelerationIncludingGravity;
        if (!accel) return;

        const magnitude = Math.sqrt(
            accel.x * accel.x +
            accel.y * accel.y +
            accel.z * accel.z
        );

        const now = Date.now();
        if (magnitude > SHAKE_THRESHOLD && (now - lastShakeTime) > SHAKE_COOLDOWN) {
            lastShakeTime = now;
            console.log('[Sensors] Shake detected!');
            if (onShakeCallback) onShakeCallback();
        }
    }

    /**
     * Register a callback for shake events.
     * @param {Function} callback - Called when phone is shaken
     */
    function onShake(callback) {
        onShakeCallback = callback;
    }

    // ─── BATTERY ────────────────────────────────────────────────

    function checkBatteryWarning() {
        if (!batteryCharging && batteryLevel <= 0.15) {
            console.log(`[Sensors] ⚠️ Low battery: ${Math.round(batteryLevel * 100)}%`);
            if (onBatteryLowCallback) onBatteryLowCallback(batteryLevel);
        }
    }

    /**
     * Register a callback for low battery warnings.
     * @param {Function} callback - Called with battery level (0-1) when below 15%
     */
    function onBatteryLow(callback) {
        onBatteryLowCallback = callback;
    }

    /**
     * Get current battery info.
     */
    function getBattery() {
        return {
            supported: batterySupported,
            level: batteryLevel,
            charging: batteryCharging,
            percent: Math.round(batteryLevel * 100)
        };
    }

    // ─── CONFIGURATION ──────────────────────────────────────────

    /**
     * Set gyroscope sensitivity.
     * @param {number} value - Multiplier (0.5 = low, 1.0 = normal, 2.0 = high)
     */
    function setGyroSensitivity(value) {
        gyroSensitivity = Math.max(0.1, Math.min(3.0, value));
    }

    /**
     * Get capabilities — what sensors are available.
     */
    function getCapabilities() {
        return {
            gyro: gyroSupported,
            accel: accelSupported,
            battery: batterySupported,
            vibration: Haptics.isSupported,
            maxTouchPoints: navigator.maxTouchPoints || 5
        };
    }

    return {
        init,
        activateGyro,
        deactivateGyro,
        setGyroSensitivity,
        onShake,
        onBatteryLow,
        getBattery,
        getCapabilities,
        get gyroActive() { return gyroActive; }
    };
})();
