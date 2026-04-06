/**
 * Mobile Console — Layout Editor (Phase 3)
 * The customization engine — drag, resize, restyle, remap every button.
 *
 * How it works:
 *   PLAY MODE (normal):
 *     Touch a button → sends input to PC
 *
 *   EDIT MODE (activated by long-pressing settings icon):
 *     Touch a button → SELECT it for editing
 *     Drag a selected button → MOVE it
 *     Pinch on a button → RESIZE it
 *     Tap toolbar buttons → change properties
 *     Grid dots appear as alignment guides
 *
 *   DATA MODEL:
 *     Every button is an object with: id, type, mapping, x, y, size, shape,
 *     color, opacity, label, vibrate, vibratePattern
 *     Positions are stored as PERCENTAGES (works on any screen size)
 *
 *   UNDO:
 *     Every change is pushed to a stack. Undo pops the last change.
 */

const Layout = (() => {
    let editMode = false;
    let selectedElement = null;
    let dragState = null;
    let undoStack = [];
    const MAX_UNDO = 50;

    // ─── Edit Mode Toolbar HTML ─────────────────────────────────
    const TOOLBAR_HTML = `
        <div id="edit-toolbar" class="edit-toolbar hidden">
            <button id="edit-done" class="toolbar-btn done-btn" aria-label="Done">✓ Done</button>
            <button id="edit-undo" class="toolbar-btn" aria-label="Undo">↶ Undo</button>
            <div class="toolbar-sep"></div>
            <button id="edit-size-up" class="toolbar-btn" aria-label="Increase Size">＋</button>
            <button id="edit-size-down" class="toolbar-btn" aria-label="Decrease Size">－</button>
            <div class="toolbar-sep"></div>
            <button id="edit-opacity-up" class="toolbar-btn" aria-label="Increase Opacity">◉</button>
            <button id="edit-opacity-down" class="toolbar-btn" aria-label="Decrease Opacity">◎</button>
            <div class="toolbar-sep"></div>
            <button id="edit-shape" class="toolbar-btn" aria-label="Toggle Shape">⬡</button>
            <button id="edit-remap" class="toolbar-btn" aria-label="Remap">⌨</button>
        </div>
        <div id="edit-grid" class="edit-grid hidden"></div>
        <div id="edit-info" class="edit-info hidden">
            <span id="edit-info-text"></span>
        </div>
    `;

    // ─── Response Curves ────────────────────────────────────────

    const CURVES = {
        linear: (input) => input,
        exponential: (input) => Math.pow(input, 2.5),
        aggressive: (input) => 1 - Math.pow(1 - input, 2.5)
    };

    let currentCurve = 'linear';

    /**
     * Apply the current response curve to a raw input value.
     * @param {number} raw - Raw input 0.0 to 1.0
     * @returns {number} Curved output 0.0 to 1.0
     */
    function applyCurve(raw) {
        const fn = CURVES[currentCurve] || CURVES.linear;
        return fn(Math.max(0, Math.min(1, raw)));
    }

    // ─── Initialization ─────────────────────────────────────────

    /**
     * Set up the edit mode system.
     * Injects toolbar HTML and binds long-press activation.
     */
    function init() {
        // Inject toolbar into the DOM
        const container = document.createElement('div');
        container.innerHTML = TOOLBAR_HTML;
        document.body.appendChild(container);

        // Inject CSS for edit mode
        injectEditCSS();

        // Bind toolbar actions
        bindToolbar();

        console.log('[Layout] ✅ Edit mode system ready');
    }

    // ─── EDIT MODE TOGGLE ───────────────────────────────────────

    /**
     * Enter edit mode — buttons become draggable instead of sending input.
     */
    function enterEditMode() {
        editMode = true;
        selectedElement = null;
        undoStack = [];

        document.body.classList.add('edit-mode');
        document.getElementById('edit-toolbar')?.classList.remove('hidden');
        document.getElementById('edit-grid')?.classList.remove('hidden');

        // Override touch behavior on all buttons
        const buttons = document.querySelectorAll('[data-button], .joystick-canvas, .trigger-zone');
        buttons.forEach(btn => {
            btn.classList.add('editable');
            btn.addEventListener('touchstart', handleEditTouchStart, { passive: false });
            btn.addEventListener('touchmove', handleEditTouchMove, { passive: false });
            btn.addEventListener('touchend', handleEditTouchEnd, { passive: false });
        });

        showInfo('Edit Mode — Drag buttons to reposition');
        Haptics.snap();
        console.log('[Layout] Entered edit mode');
    }

    /**
     * Exit edit mode — save layout and return to play mode.
     */
    function exitEditMode() {
        editMode = false;
        selectedElement = null;

        document.body.classList.remove('edit-mode');
        document.getElementById('edit-toolbar')?.classList.add('hidden');
        document.getElementById('edit-grid')?.classList.add('hidden');
        document.getElementById('edit-info')?.classList.add('hidden');

        // Remove edit listeners
        const buttons = document.querySelectorAll('.editable');
        buttons.forEach(btn => {
            btn.classList.remove('editable', 'selected');
            btn.removeEventListener('touchstart', handleEditTouchStart);
            btn.removeEventListener('touchmove', handleEditTouchMove);
            btn.removeEventListener('touchend', handleEditTouchEnd);
        });

        // Save current layout to localStorage
        saveLayout();

        Haptics.tap();
        console.log('[Layout] Exited edit mode — layout saved');
    }

    /**
     * Check if currently in edit mode.
     */
    function isEditMode() {
        return editMode;
    }

    // ─── EDIT TOUCH HANDLERS ────────────────────────────────────

    function handleEditTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();

        const el = e.currentTarget;
        const touch = e.changedTouches[0];

        // Select this element
        if (selectedElement) selectedElement.classList.remove('selected');
        selectedElement = el;
        el.classList.add('selected');

        // Start drag tracking
        const rect = el.getBoundingClientRect();
        dragState = {
            element: el,
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            origLeft: rect.left,
            origTop: rect.top,
            moved: false
        };

        updateInfoForElement(el);
    }

    function handleEditTouchMove(e) {
        e.preventDefault();
        if (!dragState) return;

        for (const touch of e.changedTouches) {
            if (touch.identifier === dragState.touchId) {
                const dx = touch.clientX - dragState.startX;
                const dy = touch.clientY - dragState.startY;

                // Only start dragging after 5px movement (prevents accidental drags)
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    dragState.moved = true;
                }

                if (dragState.moved) {
                    const el = dragState.element;
                    const newLeft = dragState.origLeft + dx;
                    const newTop = dragState.origTop + dy;

                    // Convert to percentage of viewport
                    const xPercent = (newLeft / window.innerWidth) * 100;
                    const yPercent = (newTop / window.innerHeight) * 100;

                    // Clamp to screen bounds
                    const clampedX = Math.max(0, Math.min(95, xPercent));
                    const clampedY = Math.max(0, Math.min(90, yPercent));

                    // Apply position
                    el.style.position = 'fixed';
                    el.style.left = clampedX + '%';
                    el.style.top = clampedY + '%';
                    el.style.transform = 'none';

                    updateInfoForElement(el);
                }
                break;
            }
        }
    }

    function handleEditTouchEnd(e) {
        e.preventDefault();

        if (dragState && dragState.moved) {
            // Save undo state
            pushUndo({
                type: 'move',
                element: dragState.element,
                prevLeft: dragState.origLeft,
                prevTop: dragState.origTop
            });
        }

        dragState = null;
    }

    // ─── TOOLBAR ACTIONS ────────────────────────────────────────

    function bindToolbar() {
        document.getElementById('edit-done')?.addEventListener('click', exitEditMode);

        document.getElementById('edit-undo')?.addEventListener('click', () => {
            popUndo();
            Haptics.tap();
        });

        document.getElementById('edit-size-up')?.addEventListener('click', () => {
            if (!selectedElement) return;
            resizeElement(selectedElement, 1.15);
            Haptics.tap();
        });

        document.getElementById('edit-size-down')?.addEventListener('click', () => {
            if (!selectedElement) return;
            resizeElement(selectedElement, 0.85);
            Haptics.tap();
        });

        document.getElementById('edit-opacity-up')?.addEventListener('click', () => {
            if (!selectedElement) return;
            adjustOpacity(selectedElement, 0.1);
            Haptics.tap();
        });

        document.getElementById('edit-opacity-down')?.addEventListener('click', () => {
            if (!selectedElement) return;
            adjustOpacity(selectedElement, -0.1);
            Haptics.tap();
        });

        document.getElementById('edit-shape')?.addEventListener('click', () => {
            if (!selectedElement) return;
            toggleShape(selectedElement);
            Haptics.tap();
        });

        document.getElementById('edit-remap')?.addEventListener('click', () => {
            if (!selectedElement) return;
            showRemapDialog(selectedElement);
        });
    }

    // ─── ELEMENT MANIPULATION ───────────────────────────────────

    function resizeElement(el, factor) {
        const currentWidth = el.offsetWidth;
        const newSize = Math.max(30, Math.min(120, currentWidth * factor));
        el.style.width = newSize + 'px';
        el.style.height = newSize + 'px';
        showInfo(`Size: ${Math.round(newSize)}px`);
    }

    function adjustOpacity(el, delta) {
        const current = parseFloat(getComputedStyle(el).opacity) || 1;
        const newOpacity = Math.max(0.2, Math.min(1, current + delta));
        el.style.opacity = newOpacity;
        showInfo(`Opacity: ${Math.round(newOpacity * 100)}%`);
    }

    function toggleShape(el) {
        const shapes = ['50%', '12px', '4px'];  // circle, rounded, square
        const shapeNames = ['Circle', 'Rounded', 'Square'];
        const current = getComputedStyle(el).borderRadius;
        let idx = shapes.indexOf(current);
        idx = (idx + 1) % shapes.length;
        el.style.borderRadius = shapes[idx];
        showInfo(`Shape: ${shapeNames[idx]}`);
    }

    function showRemapDialog(el) {
        const currentMapping = el.dataset.button || 'none';
        const mappingNames = {
            '0': 'A', '1': 'B', '2': 'X', '3': 'Y',
            '4': 'LB', '5': 'RB', '6': 'Back', '7': 'Start',
            '8': 'L Stick', '9': 'R Stick',
            '10': 'D-Up', '11': 'D-Down', '12': 'D-Left', '13': 'D-Right'
        };
        showInfo(`Current: ${mappingNames[currentMapping] || currentMapping}. Tap another button ID in console to remap.`);
    }

    // ─── UNDO SYSTEM ────────────────────────────────────────────

    function pushUndo(action) {
        undoStack.push(action);
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function popUndo() {
        const action = undoStack.pop();
        if (!action) {
            showInfo('Nothing to undo');
            return;
        }

        if (action.type === 'move') {
            action.element.style.left = action.prevLeft + 'px';
            action.element.style.top = action.prevTop + 'px';
            showInfo('Undone');
        }
    }

    // ─── INFO BAR ───────────────────────────────────────────────

    function showInfo(text) {
        const info = document.getElementById('edit-info');
        const infoText = document.getElementById('edit-info-text');
        if (info && infoText) {
            infoText.textContent = text;
            info.classList.remove('hidden');
        }
    }

    function updateInfoForElement(el) {
        const rect = el.getBoundingClientRect();
        const xPct = Math.round((rect.left / window.innerWidth) * 100);
        const yPct = Math.round((rect.top / window.innerHeight) * 100);
        const name = el.dataset.button !== undefined
            ? `Button ${el.textContent.trim() || '#' + el.dataset.button}`
            : el.id || 'Element';
        showInfo(`${name} — Position: ${xPct}%, ${yPct}%`);
    }

    // ─── LAYOUT SAVE/LOAD ───────────────────────────────────────

    /**
     * Save the current layout to localStorage.
     */
    function saveLayout() {
        const buttons = document.querySelectorAll('[data-button]');
        const layout = [];

        buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            layout.push({
                id: btn.id || `btn_${btn.dataset.button}`,
                mapping: parseInt(btn.dataset.button),
                x: Math.round((rect.left / window.innerWidth) * 1000) / 10,
                y: Math.round((rect.top / window.innerHeight) * 1000) / 10,
                width: btn.offsetWidth,
                height: btn.offsetHeight,
                opacity: parseFloat(getComputedStyle(btn).opacity),
                borderRadius: getComputedStyle(btn).borderRadius,
                label: btn.textContent.trim()
            });
        });

        localStorage.setItem('mc_layout', JSON.stringify(layout));
        localStorage.setItem('mc_layout_time', new Date().toISOString());
        console.log(`[Layout] Saved ${layout.length} buttons to localStorage`);
    }

    /**
     * Load a layout from localStorage and apply it.
     */
    function loadLayout() {
        const raw = localStorage.getItem('mc_layout');
        if (!raw) return false;

        try {
            const layout = JSON.parse(raw);
            layout.forEach(item => {
                const btn = document.querySelector(`[data-button="${item.mapping}"]`);
                if (btn && item.x !== undefined) {
                    btn.style.position = 'fixed';
                    btn.style.left = item.x + '%';
                    btn.style.top = item.y + '%';
                    btn.style.transform = 'none';
                    if (item.width) btn.style.width = item.width + 'px';
                    if (item.height) btn.style.height = item.height + 'px';
                    if (item.opacity) btn.style.opacity = item.opacity;
                    if (item.borderRadius) btn.style.borderRadius = item.borderRadius;
                }
            });
            console.log(`[Layout] Loaded ${layout.length} buttons from localStorage`);
            return true;
        } catch (e) {
            console.warn('[Layout] Failed to load saved layout:', e);
            return false;
        }
    }

    /**
     * Export the current layout as a JSON object (for profile saving).
     */
    function exportLayout() {
        const buttons = document.querySelectorAll('[data-button]');
        const data = [];

        buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            data.push({
                id: btn.id || `btn_${btn.dataset.button}`,
                type: 'tap',  // default; Phase 4 will add more types
                mapping: parseInt(btn.dataset.button),
                label: btn.textContent.trim(),
                x: Math.round((rect.left / window.innerWidth) * 1000) / 10,
                y: Math.round((rect.top / window.innerHeight) * 1000) / 10,
                size: btn.offsetWidth,
                shape: getComputedStyle(btn).borderRadius === '50%' ? 'circle' : 'rounded',
                opacity: parseFloat(getComputedStyle(btn).opacity) || 1,
                vibrate: true,
                vibratePattern: 'tap'
            });
        });

        return {
            name: 'Custom Layout',
            game: 'Universal',
            version: 1,
            created: new Date().toISOString(),
            author: 'User',
            buttons: data,
            sticks: [],
            gyro: {
                enabled: false,
                sensitivity: 1.0,
                smoothing: 4
            },
            curve: currentCurve,
            theme: 'default'
        };
    }

    /**
     * Import a profile JSON object and apply it.
     */
    function importLayout(profile) {
        if (!profile || !profile.buttons) return false;

        profile.buttons.forEach(item => {
            const btn = document.querySelector(`[data-button="${item.mapping}"]`);
            if (btn && item.x !== undefined) {
                btn.style.position = 'fixed';
                btn.style.left = item.x + '%';
                btn.style.top = item.y + '%';
                btn.style.transform = 'none';
                if (item.size) {
                    btn.style.width = item.size + 'px';
                    btn.style.height = item.size + 'px';
                }
                if (item.opacity) btn.style.opacity = item.opacity;
                if (item.shape === 'circle') btn.style.borderRadius = '50%';
                else if (item.shape === 'rounded') btn.style.borderRadius = '12px';
                else if (item.shape === 'square') btn.style.borderRadius = '4px';
            }
        });

        if (profile.curve) currentCurve = profile.curve;

        saveLayout();
        console.log(`[Layout] Imported profile: ${profile.name}`);
        return true;
    }

    // ─── CSS INJECTION ──────────────────────────────────────────

    function injectEditCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* ─── Edit Mode Overlay ──────────────────────── */
            .edit-mode .controller {
                background: rgba(255, 255, 255, 0.02);
            }

            .edit-grid {
                position: fixed;
                inset: 0;
                z-index: 100;
                pointer-events: none;
                background-image:
                    radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
                background-size: 20px 20px;
            }

            .edit-grid.hidden { display: none; }

            /* ─── Editable Buttons ───────────────────────── */
            .editable {
                cursor: grab !important;
                outline: 1px dashed rgba(99, 102, 241, 0.3) !important;
                outline-offset: 4px;
                z-index: 200;
            }

            .editable.selected {
                outline: 2px solid var(--accent) !important;
                outline-offset: 4px;
                box-shadow: 0 0 20px var(--accent-glow) !important;
            }

            .editable:active {
                cursor: grabbing !important;
            }

            /* ─── Toolbar ────────────────────────────────── */
            .edit-toolbar {
                position: fixed;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                border-radius: 16px;
                background: rgba(18, 18, 26, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }

            .edit-toolbar.hidden { display: none; }

            .toolbar-btn {
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                color: var(--text-secondary);
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                transition: all 80ms ease;
                white-space: nowrap;
            }

            .toolbar-btn:active {
                transform: scale(0.92);
                background: rgba(99, 102, 241, 0.15);
            }

            .done-btn {
                color: var(--color-a) !important;
                border-color: rgba(34, 197, 94, 0.3) !important;
            }

            .toolbar-sep {
                width: 1px;
                height: 24px;
                background: rgba(255, 255, 255, 0.08);
            }

            /* ─── Info Bar ────────────────────────────────── */
            .edit-info {
                position: fixed;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                padding: 6px 16px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.5px;
                color: var(--text-secondary);
                background: rgba(18, 18, 26, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(10px);
                white-space: nowrap;
            }

            .edit-info.hidden { display: none; }
        `;
        document.head.appendChild(style);
    }

    // ─── RESPONSE CURVE CONFIG ──────────────────────────────────

    /**
     * Set the response curve for joystick input.
     * @param {'linear'|'exponential'|'aggressive'} curve
     */
    function setResponseCurve(curve) {
        if (CURVES[curve]) {
            currentCurve = curve;
            console.log(`[Layout] Response curve: ${curve}`);
        }
    }

    function getResponseCurve() {
        return currentCurve;
    }

    return {
        init,
        enterEditMode,
        exitEditMode,
        isEditMode,
        saveLayout,
        loadLayout,
        exportLayout,
        importLayout,
        applyCurve,
        setResponseCurve,
        getResponseCurve
    };
})();
