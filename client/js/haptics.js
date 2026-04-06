/**
 * Mobile Console — Haptics Module
 * Makes the phone buzz. Simple but satisfying.
 *
 * The Vibration API is straightforward:
 *   navigator.vibrate(ms)         → buzz for that many milliseconds
 *   navigator.vibrate([pattern])  → buzz-pause-buzz pattern
 *
 * Why 12ms for a tap? Too short (<5ms) the motor can't spin up.
 * Too long (>30ms) it feels sluggish. 12ms = crisp button click.
 */

const Haptics = (() => {
    // Check if vibration is supported on this phone
    const isSupported = 'vibrate' in navigator;

    if (!isSupported) {
        console.warn('Haptics: Vibration API not supported on this device.');
    }

    /**
     * Crisp button press — 12ms.
     * Feels like clicking a real button.
     */
    function tap() {
        if (isSupported) navigator.vibrate(12);
    }

    /**
     * Sharp snap — 25ms.
     * Good for gunshots, sharp impacts.
     */
    function snap() {
        if (isSupported) navigator.vibrate(25);
    }

    /**
     * Heavy thud — 150ms.
     * Landing from a jump, heavy hit.
     */
    function thud() {
        if (isSupported) navigator.vibrate(150);
    }

    /**
     * Deep rumble — 200ms.
     * Explosion nearby.
     */
    function rumble() {
        if (isSupported) navigator.vibrate(200);
    }

    /**
     * Rapid burst pattern — machine gun.
     */
    function burst() {
        if (isSupported) navigator.vibrate([30, 20, 30, 20, 30]);
    }

    /**
     * Heartbeat — low health warning.
     */
    function heartbeat() {
        if (isSupported) navigator.vibrate([100, 200, 100]);
    }

    /**
     * Stop any ongoing vibration.
     */
    function stop() {
        if (isSupported) navigator.vibrate(0);
    }

    /**
     * Execute a vibration pattern by name.
     * Used when the server sends a vibration command.
     */
    function play(patternName) {
        const patterns = { tap, snap, thud, rumble, burst, heartbeat };
        const fn = patterns[patternName];
        if (fn) fn();
    }

    return { tap, snap, thud, rumble, burst, heartbeat, stop, play, isSupported };
})();
