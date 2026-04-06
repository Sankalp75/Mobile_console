/**
 * Mobile Console — Virtual Joystick
 * Draws and handles smooth analog joysticks using Canvas API.
 *
 * How it works:
 *   1. Canvas draws two circles: a base (movable area) and a thumb (your finger)
 *   2. touchmove calculates angle + distance from center
 *   3. Distance is clamped to max radius, dead zone applied
 *   4. Maps to 0-255 range (128=center) and sends binary to PC
 *   5. On release, thumb animates back to center (springy snap-back)
 *   6. Redraws at 60fps via requestAnimationFrame
 *
 * Math:
 *   distance = √(dx² + dy²)
 *   angle    = atan2(dy, dx)
 *   x_axis   = cos(angle) * mapped_distance → 0-255
 *   y_axis   = sin(angle) * mapped_distance → 0-255
 */

const Joystick = (() => {
    const MSG_STICK = 0x02;

    // ─── Configuration ──────────────────────────────────────────
    const DEFAULTS = {
        baseRadius: 65,         // Outer circle radius (px)
        thumbRadius: 28,        // Inner thumb radius (px)
        deadZone: 0.08,         // 8% dead zone — ignore tiny movements
        snapBackSpeed: 0.25,    // How fast the thumb returns to center (0-1)
        baseColor: 'rgba(255, 255, 255, 0.06)',
        baseBorder: 'rgba(255, 255, 255, 0.12)',
        thumbColor: 'rgba(255, 255, 255, 0.15)',
        thumbBorder: 'rgba(255, 255, 255, 0.25)',
        thumbActiveColor: 'rgba(99, 102, 241, 0.25)',
        thumbActiveBorder: 'rgba(99, 102, 241, 0.5)',
    };

    // Store all active joystick instances
    const sticks = [];

    /**
     * Create a joystick on a canvas element.
     *
     * @param {string} canvasId - ID of the canvas element
     * @param {number} stickId  - 0 = left stick, 1 = right stick
     * @param {object} options  - Override defaults
     */
    function create(canvasId, stickId, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[Joystick] Canvas #${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');
        const config = { ...DEFAULTS, ...options };

        // High-DPI rendering for sharp visuals
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const stick = {
            canvas,
            ctx,
            config,
            stickId,
            dpr,
            rect,
            centerX,
            centerY,
            // Current thumb position (visual — may be animating)
            thumbX: centerX,
            thumbY: centerY,
            // Target position (where the thumb should be)
            targetX: centerX,
            targetY: centerY,
            // Is a finger currently on this stick?
            active: false,
            // Which touch identifier is controlling this stick
            touchId: null,
            // Current axis values (0-255, 128=center)
            axisX: 128,
            axisY: 128,
            // Animation frame ID
            animFrame: null,
        };

        // ─── Touch Events ───────────────────────────────────────
        canvas.addEventListener('touchstart', (e) => handleTouchStart(e, stick), { passive: false });
        canvas.addEventListener('touchmove', (e) => handleTouchMove(e, stick), { passive: false });
        canvas.addEventListener('touchend', (e) => handleTouchEnd(e, stick), { passive: false });
        canvas.addEventListener('touchcancel', (e) => handleTouchEnd(e, stick), { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        sticks.push(stick);

        // Start render loop
        renderLoop(stick);

        console.log(`[Joystick] Created stick ${stickId} on #${canvasId}`);
        return stick;
    }

    // ─── TOUCH HANDLERS ─────────────────────────────────────────

    function handleTouchStart(e, stick) {
        e.preventDefault();
        if (stick.active) return; // Already being touched

        const touch = e.changedTouches[0];
        stick.active = true;
        stick.touchId = touch.identifier;

        updateThumbPosition(touch, stick);
        Haptics.tap();
    }

    function handleTouchMove(e, stick) {
        e.preventDefault();
        if (!stick.active) return;

        // Find our specific finger
        for (const touch of e.changedTouches) {
            if (touch.identifier === stick.touchId) {
                updateThumbPosition(touch, stick);
                break;
            }
        }
    }

    function handleTouchEnd(e, stick) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === stick.touchId) {
                stick.active = false;
                stick.touchId = null;
                stick.targetX = stick.centerX;
                stick.targetY = stick.centerY;

                // Send centered position to PC
                stick.axisX = 128;
                stick.axisY = 128;
                WS.sendStick(MSG_STICK, stick.stickId, 128, 128);
                break;
            }
        }
    }

    // ─── POSITION CALCULATION ───────────────────────────────────

    function updateThumbPosition(touch, stick) {
        const rect = stick.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        // Distance from center
        const dx = touchX - stick.centerX;
        const dy = touchY - stick.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = stick.config.baseRadius;

        // Clamp to circle boundary
        let clampedX, clampedY;
        if (distance > maxDistance) {
            const angle = Math.atan2(dy, dx);
            clampedX = stick.centerX + Math.cos(angle) * maxDistance;
            clampedY = stick.centerY + Math.sin(angle) * maxDistance;
        } else {
            clampedX = touchX;
            clampedY = touchY;
        }

        stick.targetX = clampedX;
        stick.targetY = clampedY;

        // ─── Calculate axis values ──────────────────────────────
        const normalizedDist = Math.min(distance / maxDistance, 1.0);

        if (normalizedDist < stick.config.deadZone) {
            // Inside dead zone — report centered
            stick.axisX = 128;
            stick.axisY = 128;
        } else {
            // Apply dead zone compensation:
            // Remap (deadZone..1.0) → (0..1.0) so movement starts from zero after dead zone
            const compensated = (normalizedDist - stick.config.deadZone) / (1.0 - stick.config.deadZone);
            const angle = Math.atan2(dy, dx);

            // Map to 0-255 (128 = center)
            stick.axisX = Math.round(128 + Math.cos(angle) * compensated * 127);
            stick.axisY = Math.round(128 + Math.sin(angle) * compensated * 127);

            // Clamp to valid range
            stick.axisX = Math.max(0, Math.min(255, stick.axisX));
            stick.axisY = Math.max(0, Math.min(255, stick.axisY));
        }

        // Send to PC
        WS.sendStick(MSG_STICK, stick.stickId, stick.axisX, stick.axisY);
    }

    // ─── RENDERING ──────────────────────────────────────────────

    function renderLoop(stick) {
        update(stick);
        draw(stick);
        stick.animFrame = requestAnimationFrame(() => renderLoop(stick));
    }

    function update(stick) {
        // Smooth interpolation of thumb position
        // When active: thumb follows finger instantly
        // When released: thumb eases back to center
        if (stick.active) {
            stick.thumbX = stick.targetX;
            stick.thumbY = stick.targetY;
        } else {
            // Lerp (linear interpolation) toward center
            stick.thumbX += (stick.targetX - stick.thumbX) * stick.config.snapBackSpeed;
            stick.thumbY += (stick.targetY - stick.thumbY) * stick.config.snapBackSpeed;
        }
    }

    function draw(stick) {
        const { ctx, centerX, centerY, config, thumbX, thumbY, active } = stick;
        const { width, height } = stick.rect;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // ─── Draw base circle (the movement area) ───────────────
        ctx.beginPath();
        ctx.arc(centerX, centerY, config.baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = config.baseColor;
        ctx.fill();
        ctx.strokeStyle = config.baseBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ─── Draw crosshair guides ──────────────────────────────
        ctx.beginPath();
        ctx.moveTo(centerX - config.baseRadius * 0.6, centerY);
        ctx.lineTo(centerX + config.baseRadius * 0.6, centerY);
        ctx.moveTo(centerX, centerY - config.baseRadius * 0.6);
        ctx.lineTo(centerX, centerY + config.baseRadius * 0.6);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ─── Draw thumb circle ──────────────────────────────────
        ctx.beginPath();
        ctx.arc(thumbX, thumbY, config.thumbRadius, 0, Math.PI * 2);
        ctx.fillStyle = active ? config.thumbActiveColor : config.thumbColor;
        ctx.fill();
        ctx.strokeStyle = active ? config.thumbActiveBorder : config.thumbBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // ─── Glow when active ───────────────────────────────────
        if (active) {
            ctx.beginPath();
            ctx.arc(thumbX, thumbY, config.thumbRadius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
            ctx.lineWidth = 8;
            ctx.stroke();
        }
    }

    // ─── PUBLIC API ─────────────────────────────────────────────

    /**
     * Set the dead zone for a specific stick.
     * @param {number} stickId - 0 or 1
     * @param {number} value   - 0.0 to 0.5
     */
    function setDeadZone(stickId, value) {
        const stick = sticks.find(s => s.stickId === stickId);
        if (stick) stick.config.deadZone = Math.max(0, Math.min(0.5, value));
    }

    /**
     * Destroy all joystick instances and stop rendering.
     */
    function destroyAll() {
        sticks.forEach(s => {
            if (s.animFrame) cancelAnimationFrame(s.animFrame);
        });
        sticks.length = 0;
    }

    return { create, setDeadZone, destroyAll };
})();
