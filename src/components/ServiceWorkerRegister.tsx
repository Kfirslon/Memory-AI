'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// VAPID public key - generated for this app
const VAPID_PUBLIC_KEY = 'BL1GL2UWNrV_N66hhJfM8ZO_pLwVCTLfGnrCNkfLC2FO0S-qZKch2nmjbv5QjbCalcKEZkS1BoxrZ4JOWDWLxHg';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as Uint8Array<ArrayBuffer>;
}

export default function ServiceWorkerRegister() {
    const [userId, setUserId] = useState<string | null>(null);
    const isRegistering = useRef(false);
    const hasRegistered = useRef(false);
    const supabase = createClient();

    // Listen for auth changes
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                console.log('[Push] User logged in:', user.id);
                setUserId(user.id);
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user && session.user.id !== userId) {
                setUserId(session.user.id);
            } else if (!session?.user) {
                setUserId(null);
                hasRegistered.current = false;
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth, userId]);

    // Register service worker when user is logged in
    useEffect(() => {
        if (!userId) return;
        if (hasRegistered.current || isRegistering.current) return;

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            registerServiceWorker(userId);
        } else {
            console.log('[Push] Service worker or PushManager not supported');
        }
    }, [userId]);

    const registerServiceWorker = async (currentUserId: string) => {
        if (isRegistering.current || hasRegistered.current) return;
        isRegistering.current = true;

        try {
            console.log('[Push] Starting registration for user:', currentUserId);

            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service worker registered');

            // Wait for the service worker to be ready
            await navigator.serviceWorker.ready;
            console.log('[Push] Service worker is ready');

            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                console.log('[Push] Already have push subscription');
            } else {
                // Check current permission
                console.log('[Push] Current notification permission:', Notification.permission);

                if (Notification.permission === 'denied') {
                    console.log('[Push] ❌ Notifications are blocked. Please enable in browser settings.');
                    return;
                }

                // Request permission if needed
                if (Notification.permission === 'default') {
                    console.log('[Push] Requesting notification permission...');
                    const permission = await Notification.requestPermission();
                    console.log('[Push] Permission result:', permission);

                    if (permission !== 'granted') {
                        console.log('[Push] Permission not granted');
                        return;
                    }
                }

                // Subscribe to push
                console.log('[Push] Creating push subscription...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
                console.log('[Push] Push subscription created!');
            }

            // Save to database
            await saveSubscription(subscription, currentUserId);
            hasRegistered.current = true;

        } catch (error) {
            console.error('[Push] Registration error:', error);
        } finally {
            isRegistering.current = false;
        }
    };

    const saveSubscription = async (subscription: PushSubscription, currentUserId: string) => {
        try {
            const subscriptionJson = subscription.toJSON();
            console.log('[Push] Saving subscription...');

            const { data, error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: currentUserId,
                    endpoint: subscription.endpoint,
                    p256dh: subscriptionJson.keys?.p256dh || '',
                    auth: subscriptionJson.keys?.auth || ''
                }, {
                    onConflict: 'user_id,endpoint'
                })
                .select();

            if (error) {
                console.error('[Push] ❌ Database save failed:', error);
            } else {
                console.log('[Push] ✅ Saved to database!', data);
            }
        } catch (error) {
            console.error('[Push] Save error:', error);
        }
    };

    return null;
}
