/**
 * Mobile Console — Touch Handler
 * Detects finger touches on buttons and sends them to the PC.
 *
 * Key concepts:
 *   - touchstart = finger lands → button PRESSED
 *   - touchend   = finger lifts → button RELEASED
 *   - We track each finger by its identifier (for multi-touch)
 *   - We use touchstart instead of click (click has 300ms delay!)
 *   - We preventDefault() everything to stop scrolling/zooming
 *
 * Protocol:
 *   MSG_BUTTON = 0x01
 *   send(0x01, button_id, 1) → pressed
 *   send(0x01, button_id, 0) → released
 */

const Touch = (() => {
    const MSG_BUTTON = 0x01;

    // Track which buttons are currently held by which finger
    // Map: touchIdentifier → button element
    const activeFingers = new Map();

    /**
     * Initialize touch handling on all buttons.
     * Call this once after the DOM is ready.
     */
    function init() {
        // Find ALL elements with a data-button attribute
        const buttons = document.querySelectorAll('[data-button]');

        buttons.forEach(btn => {
            // Touch start — finger lands on a button
            btn.addEventListener('touchstart', handleTouchStart, { passive: false });

            // Touch end — finger lifts off
            btn.addEventListener('touchend', handleTouchEnd, { passive: false });
            btn.addEventListener('touchcancel', handleTouchEnd, { passive: false });

            // Prevent context menu (long press)
            btn.addEventListener('contextmenu', e => e.preventDefault());
        });

        // Global touchmove prevention — stops scrolling while touching buttons
        document.addEventListener('touchmove', e => {
            // Only prevent if touching a button
            if (e.target.closest('[data-button]')) {
                e.preventDefault();
            }
        }, { passive: false });

        console.log(`[Touch] Initialized on ${buttons.length} buttons.`);
    }

    /**
     * Handle a finger touching down on a button.
     */
    function handleTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.currentTarget;
        const buttonId = parseInt(btn.dataset.button, 10);

        // Process each new touch point (supports multi-touch)
        for (const touch of e.changedTouches) {
            // Track this finger → this button
            activeFingers.set(touch.identifier, btn);

            // Visual feedback: add "active" class
            btn.classList.add('active');

            // Haptic feedback: tiny buzz
            Haptics.tap();

            // Send press to PC: [0x01, buttonId, 1]
            WS.send(MSG_BUTTON, buttonId, 1);
        }
    }

    /**
     * Handle a finger lifting off a button.
     */
    function handleTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.currentTarget;
        const buttonId = parseInt(btn.dataset.button, 10);

        for (const touch of e.changedTouches) {
            // Clean up tracking
            activeFingers.delete(touch.identifier);

            // Only remove active class if NO other finger is on this button
            const stillHeld = [...activeFingers.values()].some(b => b === btn);
            if (!stillHeld) {
                btn.classList.remove('active');
            }

            // Send release to PC: [0x01, buttonId, 0]
            WS.send(MSG_BUTTON, buttonId, 0);
        }
    }

    return { init };
})();
