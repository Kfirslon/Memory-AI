'use client';

import { Sparkles } from 'lucide-react';

export default function TestCheckout() {
    const testCheckout = async () => {
        try {
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'test-user-123' }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            alert(`Failed: ${error}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center">
                <h1 className="text-4xl font-bold text-white mb-4">
                    Stripe Test Page
                </h1>
                <p className="text-gray-300 mb-8">
                    Click the button below to test Stripe checkout
                </p>
                <button
                    onClick={testCheckout}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all hover:scale-105"
                >
                    <Sparkles size={24} />
                    Test Stripe Checkout
                </button>
                <p className="text-gray-400 mt-6 text-sm">
                    This will redirect to Stripe's test checkout page
                </p>
            </div>
        </div>
    );
}
