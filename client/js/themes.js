/**
 * Mobile Console — Theme Engine
 * Apply amazing color palettes instantly by swapping CSS root variables via classes.
 */

const Themes = (() => {
    // List of available themes
    const THEMES = ['default', 'neon', 'retro', 'stealth'];
    let currentTheme = 'default';

    /**
     * Initialize theme engine, load saved theme if any.
     */
    function init() {
        const saved = localStorage.getItem('mc_theme');
        if (saved && THEMES.includes(saved)) {
            setTheme(saved);
        } else {
            setTheme('default');
        }

        // Setup theme selector on start screen
        const buttons = document.querySelectorAll('.theme-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                setTheme(theme);
                
                // Update UI active state
                buttons.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                Haptics.tap();
            });
        });

        // Highlight the initial active button
        const activeBtn = document.querySelector(`.theme-btn[data-theme="${currentTheme}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        console.log('[Themes] ✅ Engine initialized');
    }

    /**
     * Switch to a new theme.
     * @param {string} themeName 
     */
    function setTheme(themeName) {
        if (!THEMES.includes(themeName)) return;

        // Remove old theme class
        document.body.classList.remove(`theme-${currentTheme}`);
        
        // Add new theme class (except for default)
        if (themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }

        currentTheme = themeName;
        localStorage.setItem('mc_theme', themeName);
        console.log(`[Themes] Switched to ${themeName}`);
    }

    function getTheme() {
        return currentTheme;
    }

    return { init, setTheme, getTheme };
})();

// Wait for DOM to init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Themes.init);
} else {
    Themes.init();
}
