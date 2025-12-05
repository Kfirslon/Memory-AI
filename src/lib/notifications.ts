'use client';

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Show a browser notification for a reminder
 */
export function showReminderNotification(
    title: string,
    body: string,
    memoryId: string
): void {
    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
    }

    const notification = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `reminder-${memoryId}`,
        requireInteraction: true, // Keep notification visible until user closes it
        silent: false,
    });

    // Play sound
    playNotificationSound();

    // Handle click - could navigate to the memory
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

/**
 * Play notification sound
 */
function playNotificationSound(): void {
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.warn('Could not play notification sound:', error);
    }
}

/**
 * Check if notification permission is granted
 */
export function isNotificationEnabled(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
}
