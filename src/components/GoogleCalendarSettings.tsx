'use client';

import { useState, useEffect } from 'react';
import { Calendar, Check, X, Loader2, ExternalLink } from 'lucide-react';

interface GoogleCalendarSettingsProps {
    userId: string;
}

export default function GoogleCalendarSettings({ userId }: GoogleCalendarSettingsProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        checkConnectionStatus();
    }, [userId]);

    const checkConnectionStatus = async () => {
        try {
            const response = await fetch(`/api/calendar/status?userId=${userId}`);
            const data = await response.json();
            setIsConnected(data.connected);
            setSyncEnabled(data.syncEnabled ?? true);
        } catch (error) {
            console.error('Error checking calendar status:', error);
        } finally {
            setLoading(false);
        }
    };

    const connectGoogle = () => {
        window.location.href = `/api/auth/google/connect?userId=${userId}`;
    };

    const disconnectGoogle = async () => {
        if (!confirm('Disconnect Google Calendar? You won\'t receive calendar notifications for reminders.')) {
            return;
        }

        setUpdating(true);
        try {
            await fetch(`/api/calendar/status?userId=${userId}`, {
                method: 'DELETE',
            });
            setIsConnected(false);
            setSyncEnabled(false);
        } catch (error) {
            console.error('Error disconnecting:', error);
        } finally {
            setUpdating(false);
        }
    };

    const toggleSync = async () => {
        setUpdating(true);
        try {
            const newValue = !syncEnabled;
            await fetch('/api/calendar/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, syncEnabled: newValue }),
            });
            setSyncEnabled(newValue);
        } catch (error) {
            console.error('Error toggling sync:', error);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin text-primary-400" size={24} />
                    <span className="text-slate-400">Checking Google Calendar...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                        <Calendar className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Google Calendar</h3>
                        <p className="text-sm text-slate-400">
                            {isConnected ? 'Connected' : 'Sync reminders to your calendar'}
                        </p>
                    </div>
                </div>

                {isConnected ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <Check size={14} />
                            Connected
                        </span>
                        <button
                            onClick={disconnectGoogle}
                            disabled={updating}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={connectGoogle}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-500 hover:to-green-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                    >
                        <ExternalLink size={16} />
                        Connect
                    </button>
                )}
            </div>

            {isConnected && (
                <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white">Auto-sync reminders</p>
                            <p className="text-xs text-slate-400">
                                Automatically add reminders to your Google Calendar
                            </p>
                        </div>
                        <button
                            onClick={toggleSync}
                            disabled={updating}
                            className={`relative w-14 h-8 rounded-full transition-colors ${syncEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${syncEnabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
