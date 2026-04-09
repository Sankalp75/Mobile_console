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

    const activeFingers = new Map();

    function init() {
        const buttons = document.querySelectorAll('[data-button]');

        buttons.forEach(btn => {
            btn.addEventListener('touchstart', handleTouchStart, { passive: false });
            btn.addEventListener('touchend', handleTouchEnd, { passive: false });
            btn.addEventListener('touchcancel', handleTouchEnd, { passive: false });
            btn.addEventListener('contextmenu', e => e.preventDefault());
        });

        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        console.log(`[Touch] Initialized on ${buttons.length} buttons.`);
    }

    function handleTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.currentTarget;
        const buttonId = parseInt(btn.dataset.button, 10);

        for (const touch of e.changedTouches) {
            activeFingers.set(touch.identifier, { buttonId, element: btn });
            btn.classList.add('active');
            Haptics.tap();
            WS.send(MSG_BUTTON, buttonId, 1);
        }
    }

    function handleTouchMove(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const tracked = activeFingers.get(touch.identifier);
            if (!tracked) continue;

            const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const btnBelow = elemBelow ? elemBelow.closest('[data-button]') : null;

            if (btnBelow && btnBelow !== tracked.element) {
                const newButtonId = parseInt(btnBelow.dataset.button, 10);
                WS.send(MSG_BUTTON, tracked.buttonId, 0);
                tracked.element.classList.remove('active');

                WS.send(MSG_BUTTON, newButtonId, 1);
                btnBelow.classList.add('active');
                Haptics.tap();

                activeFingers.set(touch.identifier, { buttonId: newButtonId, element: btnBelow });
            }
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();

        for (const touch of e.changedTouches) {
            const tracked = activeFingers.get(touch.identifier);
            if (!tracked) continue;

            activeFingers.delete(touch.identifier);
            WS.send(MSG_BUTTON, tracked.buttonId, 0);
            tracked.element.classList.remove('active');
        }
    }

    return { init };
})();
