/**
 * Mobile Console — Dynamic Layout Engine
 * Fully customizable: add, position, style, and map any button to any action
 */

const Layout = (() => {
    // All possible actions - dynamic, user-mappable
    const ACTIONS = {
        // Buttons
        A: { id: 'A', name: 'A Button', category: 'Face' },
        B: { id: 'B', name: 'B Button', category: 'Face' },
        X: { id: 'X', name: 'X Button', category: 'Face' },
        Y: { id: 'Y', name: 'Y Button', category: 'Face' },
        LB: { id: 'LB', name: 'Left Bumper', category: 'Shoulder' },
        RB: { id: 'RB', name: 'Right Bumper', category: 'Shoulder' },
        LT: { id: 'LT', name: 'Left Trigger', category: 'Trigger' },
        RT: { id: 'RT', name: 'Right Trigger', category: 'Trigger' },
        L_THUMB: { id: 'L_THUMB', name: 'L Stick Click', category: 'Stick' },
        R_THUMB: { id: 'R_THUMB', name: 'R Stick Click', category: 'Stick' },
        START: { id: 'START', name: 'Start', category: 'Meta' },
        BACK: { id: 'BACK', name: 'Back', category: 'Meta' },
        GUIDE: { id: 'GUIDE', name: 'Guide', category: 'Meta' },
        // D-Pad
        DPAD_UP: { id: 'DPAD_UP', name: 'D-Pad Up', category: 'DPad' },
        DPAD_DOWN: { id: 'DPAD_DOWN', name: 'D-Pad Down', category: 'DPad' },
        DPAD_LEFT: { id: 'DPAD_LEFT', name: 'D-Pad Left', category: 'DPad' },
        DPAD_RIGHT: { id: 'DPAD_RIGHT', name: 'D-Pad Right', category: 'DPad' },
        // Sensors
        GYRO_TOGGLE: { id: 'GYRO_TOGGLE', name: 'Gyro Toggle', category: 'Sensor' },
        // Hardware
        VOL_UP: { id: 'VOL_UP', name: 'Volume Up', category: 'Hardware' },
        VOL_DOWN: { id: 'VOL_DOWN', name: 'Volume Down', category: 'Hardware' },
    };

    const DEFAULT_LAYOUT = {
        version: 2,
        buttons: [],
        styles: {},
        settings: {
            gyroEnabled: true,
            gyroSensitivity: 1.0,
            gyroSmoothing: 4,
            hapticFeedback: true,
            deadZone: 0.08,
            responseCurve: 'linear'
        }
    };

    let currentLayout = null;
    let editMode = false;
    let onLayoutChange = null;
    let onAction = null;

    function init() {
        loadLayout();
    }

    function loadLayout() {
        try {
            const saved = localStorage.getItem('mc_layout');
            if (saved) {
                const parsed = JSON.parse(saved);
                currentLayout = { ...DEFAULT_LAYOUT, ...parsed, buttons: parsed.buttons || [] };
            } else {
                currentLayout = createDefaultLayout();
            }
        } catch (e) {
            currentLayout = createDefaultLayout();
        }
        applyLayout();
    }

    function createDefaultLayout() {
        return {
            version: 2,
            buttons: [
                { id: 'btn-a', type: 'button', action: 'A', x: 88, y: 55, w: 55, h: 55, label: 'A', style: 'circle', bg: '#22c55e' },
                { id: 'btn-b', type: 'button', action: 'B', x: 95, y: 45, w: 55, h: 55, label: 'B', style: 'circle', bg: '#ef4444' },
                { id: 'btn-x', type: 'button', action: 'X', x: 81, y: 62, w: 55, h: 55, label: 'X', style: 'circle', bg: '#3b82f6' },
                { id: 'btn-y', type: 'button', action: 'Y', x: 88, y: 52, w: 55, h: 55, label: 'Y', style: 'circle', bg: '#eab308' },
                { id: 'stick-l', type: 'joystick', action: 'L_STICK', x: 12, y: 50, w: 110, h: 110, deadZone: 0.08 },
                { id: 'stick-r', type: 'joystick', action: 'R_STICK', x: 75, y: 50, w: 110, h: 110, deadZone: 0.08 },
                { id: 'btn-lb', type: 'button', action: 'LB', x: 3, y: 22, w: 45, h: 28, label: 'LB', style: 'rect' },
                { id: 'btn-rb', type: 'button', action: 'RB', x: 97, y: 22, w: 45, h: 28, label: 'RB', style: 'rect' },
                { id: 'btn-back', type: 'button', action: 'BACK', x: 45, y: 20, w: 35, h: 25, label: '◁', style: 'rect' },
                { id: 'btn-start', type: 'button', action: 'START', x: 55, y: 20, w: 35, h: 25, label: '▷', style: 'rect' },
            ],
            styles: {
                buttonBg: 'rgba(255,255,255,0.1)',
                buttonBorder: 'rgba(255,255,255,0.15)',
                buttonActive: 'rgba(99,102,241,0.5)',
                buttonText: '#fff',
                joystickBg: 'rgba(255,255,255,0.05)',
                joystickBorder: 'rgba(255,255,255,0.1)',
                joystickActive: 'rgba(99,102,241,0.3)',
                background: 'rgba(0,0,0,0.8)'
            },
            settings: {
                gyroEnabled: true,
                gyroSensitivity: 1.0,
                gyroSmoothing: 4,
                hapticFeedback: true,
                deadZone: 0.08,
                responseCurve: 'linear'
            }
        };
    }

    function saveLayout() {
        localStorage.setItem('mc_layout', JSON.stringify(currentLayout));
        if (onLayoutChange) onLayoutChange(currentLayout);
    }

    function getLayout() {
        return currentLayout;
    }

    function setLayout(layout) {
        currentLayout = layout;
        saveLayout();
        applyLayout();
    }

    function resetLayout() {
        currentLayout = createDefaultLayout();
        saveLayout();
        applyLayout();
    }

    function applyLayout() {
        const container = document.getElementById('controller');
        if (!container) return;

        container.innerHTML = '';
        container.style.background = currentLayout.styles.background || 'transparent';

        currentLayout.buttons.forEach(btn => {
            const el = createButtonElement(btn);
            container.appendChild(el);
        });
    }

    function createButtonElement(btn) {
        if (btn.type === 'joystick') {
            return createJoystickElement(btn);
        }
        return createButtonEl(btn);
    }

    function createButtonEl(btn) {
        const el = document.createElement('button');
        el.id = btn.id;
        el.className = 'custom-btn';
        el.dataset.action = btn.action;
        el.dataset.id = btn.id;
        el.textContent = btn.label || '';

        el.style.position = 'absolute';
        el.style.left = btn.x + '%';
        el.style.top = btn.y + '%';
        el.style.width = btn.w + 'px';
        el.style.height = btn.h + 'px';
        el.style.borderRadius = btn.style === 'circle' ? '50%' : '8px';
        el.style.background = btn.bg || currentLayout.styles.buttonBg;
        el.style.border = `1px solid ${currentLayout.styles.buttonBorder}`;
        el.style.color = currentLayout.styles.buttonText || '#fff';
        el.style.fontSize = Math.min(btn.w, btn.h) * 0.4 + 'px';
        el.style.fontWeight = 'bold';

        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            el.classList.add('active');
            if (currentLayout.settings.hapticFeedback) Haptics.tap();
            if (onAction) onAction('press', btn.action);
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            el.classList.remove('active');
            if (onAction) onAction('release', btn.action);
        }, { passive: false });

        el.addEventListener('touchcancel', (e) => {
            el.classList.remove('active');
            if (onAction) onAction('release', btn.action);
        });

        return el;
    }

    function createJoystickElement(btn) {
        const canvas = document.createElement('canvas');
        canvas.id = btn.id;
        canvas.className = 'joystick-canvas';
        canvas.dataset.action = btn.action;
        canvas.dataset.id = btn.id;
        canvas.dataset.type = 'joystick';

        canvas.style.position = 'absolute';
        canvas.style.left = btn.x + '%';
        canvas.style.top = btn.y + '%';
        canvas.style.width = btn.w + 'px';
        canvas.style.height = btn.h + 'px';

        canvas.width = btn.w * 2;
        canvas.height = btn.h * 2;

        setupJoystick(canvas, btn);
        return canvas;
    }

    function setupJoystick(canvas, config) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = canvas.width / 2 - 20;
        let thumbX = centerX;
        let thumbY = centerY;
        let active = false;
        let touchId = null;

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
            ctx.fillStyle = currentLayout.styles.joystickBg;
            ctx.fill();
            ctx.strokeStyle = currentLayout.styles.joystickBorder;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(thumbX, thumbY, 30, 0, Math.PI * 2);
            ctx.fillStyle = active ? currentLayout.styles.joystickActive : 'rgba(255,255,255,0.15)';
            ctx.fill();
            ctx.strokeStyle = active ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 2;
            ctx.stroke();

            requestAnimationFrame(draw);
        }
        draw();

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            active = true;
            touchId = e.changedTouches[0].identifier;
            if (currentLayout.settings.hapticFeedback) Haptics.tap();
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!active) return;

            for (const touch of e.changedTouches) {
                if (touch.identifier === touchId) {
                    const rect = canvas.getBoundingClientRect();
                    let x = touch.clientX - rect.left;
                    let y = touch.clientY - rect.top;

                    const dx = x - centerX;
                    const dy = y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > maxRadius) {
                        const angle = Math.atan2(dy, dx);
                        x = centerX + Math.cos(angle) * maxRadius;
                        y = centerY + Math.sin(angle) * maxRadius;
                    }

                    thumbX = x;
                    thumbY = y;

                    const normX = (x - centerX) / maxRadius;
                    const normY = (y - centerY) / maxRadius;

                    const deadZone = config.deadZone || currentLayout.settings.deadZone || 0.08;
                    let finalX = normX;
                    let finalY = normY;

                    if (Math.abs(normX) < deadZone && Math.abs(normY) < deadZone) {
                        finalX = 0;
                        finalY = 0;
                    }

                    const x255 = Math.round((finalX + 1) * 127.5);
                    const y255 = Math.round((finalY + 1) * 127.5);

                    if (onAction) onAction('stick', config.action, x255, y255);
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === touchId) {
                    active = false;
                    touchId = null;
                    thumbX = centerX;
                    thumbY = centerY;
                    if (onAction) onAction('stick', config.action, 128, 128);
                }
            }
        }, { passive: false });
    }

    function getActions() {
        return ACTIONS;
    }

    function getActionsByCategory() {
        const cats = {};
        Object.values(ACTIONS).forEach(a => {
            if (!cats[a.category]) cats[a.category] = [];
            cats[a.category].push(a);
        });
        return cats;
    }

    function onSetAction(callback) {
        onAction = callback;
    }

    function onLayoutChangeCallback(callback) {
        onLayoutChange = callback;
    }

    function addButton(config) {
        const id = 'btn-' + Date.now();
        const btn = {
            id,
            type: config.type || 'button',
            action: config.action || 'A',
            x: config.x || 50,
            y: config.y || 50,
            w: config.w || 50,
            h: config.h || 50,
            label: config.label || '?',
            style: config.style || 'circle',
            bg: config.bg || null
        };
        currentLayout.buttons.push(btn);
        saveLayout();
        applyLayout();
        return id;
    }

    function removeButton(id) {
        currentLayout.buttons = currentLayout.buttons.filter(b => b.id !== id);
        saveLayout();
        applyLayout();
    }

    function updateButton(id, props) {
        const btn = currentLayout.buttons.find(b => b.id === id);
        if (btn) {
            Object.assign(btn, props);
            saveLayout();
            applyLayout();
        }
    }

    function updateStyle(key, value) {
        currentLayout.styles[key] = value;
        saveLayout();
        applyLayout();
    }

    function updateSetting(key, value) {
        currentLayout.settings[key] = value;
        saveLayout();
    }

    function getSettings() {
        return currentLayout.settings;
    }

    function getStyles() {
        return currentLayout.styles;
    }

    function exportProfile() {
        return JSON.stringify(currentLayout, null, 2);
    }

    function importProfile(json) {
        try {
            const layout = JSON.parse(json);
            if (layout.buttons && layout.styles) {
                currentLayout = layout;
                saveLayout();
                applyLayout();
                return true;
            }
        } catch (e) {}
        return false;
    }

    function saveProfile(name) {
        const profiles = JSON.parse(localStorage.getItem('mc_profiles') || '{}');
        profiles[name] = currentLayout;
        localStorage.setItem('mc_profiles', JSON.stringify(profiles));
    }

    function loadProfile(name) {
        const profiles = JSON.parse(localStorage.getItem('mc_profiles') || '{}');
        if (profiles[name]) {
            currentLayout = profiles[name];
            saveLayout();
            applyLayout();
            return true;
        }
        return false;
    }

    function getProfileList() {
        return Object.keys(JSON.parse(localStorage.getItem('mc_profiles') || '{}'));
    }

    function deleteProfile(name) {
        const profiles = JSON.parse(localStorage.getItem('mc_profiles') || '{}');
        delete profiles[name];
        localStorage.setItem('mc_profiles', JSON.stringify(profiles));
    }

    function enterEditMode() {
        editMode = true;
        document.body.classList.add('edit-mode');
    }

    function exitEditMode() {
        editMode = false;
        document.body.classList.remove('edit-mode');
    }

    function isEditMode() {
        return editMode;
    }

    return {
        init, loadLayout, saveLayout, getLayout, setLayout, resetLayout,
        addButton, removeButton, updateButton, updateStyle, updateSetting,
        getActions, getActionsByCategory, getSettings, getStyles,
        onSetAction, onLayoutChangeCallback,
        exportProfile, importProfile, saveProfile, loadProfile, getProfileList, deleteProfile,
        enterEditMode, exitEditMode, isEditMode
    };
})();