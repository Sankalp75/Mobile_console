const Themes = (() => {
    const themes = {
        default: {
            name: 'Xbox',
            accent: '#6366f1',
            colors: {
                a: '#22c55e',
                b: '#ef4444',
                x: '#3b82f6',
                y: '#eab308',
            },
        },
        neon: {
            name: 'Neon',
            accent: '#f0f',
            colors: {
                a: '#0ff',
                b: '#f0f',
                x: '#0f0',
                y: '#ff0',
            },
        },
        retro: {
            name: 'Retro',
            accent: '#6b21a8',
            colors: {
                a: '#6b21a8',
                b: '#a855f7',
                x: '#a855f7',
                y: '#6b21a8',
            },
        },
        stealth: {
            name: 'Stealth',
            accent: '#ffffff',
            colors: {
                a: '#888888',
                b: '#888888',
                x: '#888888',
                y: '#888888',
            },
        },
    };

    function apply(themeName) {
        const theme = themes[themeName] || themes.default;
        document.body.className = 'theme-' + themeName;
    }

    function getAll() {
        return themes;
    }

    return { apply, getAll };
})();
