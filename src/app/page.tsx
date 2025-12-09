'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BrainCircuit, Mic, Sparkles, User as UserIcon, LogOut, Edit3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { processAudio, processManualEntry } from '@/lib/groq/client';
import { uploadAudioToCloudinary } from '@/lib/cloudinary';
import { Memory, MemoryCategory } from '@/lib/types';
import AuthScreen from '@/components/AuthScreen';
import RecordButton from '@/components/RecordButton';
import MemoryCard from '@/components/MemoryCard';
import FocusView from '@/components/FocusView';
import AnalyticsView from '@/components/AnalyticsView';
import ManualMemoryForm from '@/components/ManualMemoryForm';
import GoogleCalendarSettings from '@/components/GoogleCalendarSettings';

type Tab = 'capture' | 'timeline' | 'focus' | 'analytics' | 'profile';
type InputMode = 'voice' | 'manual';

const DAILY_PROMPTS = [
    "What's the most important thing you learned today?",
    "What's a random idea you had recently?",
    "What are you grateful for right now?",
    "What's one thing you need to get done tomorrow?",
    "Describe a moment that made you smile today.",
];

export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<MemoryCategory | 'all'>('all');
    const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [dailyPrompt, setDailyPrompt] = useState('');
    const [inputMode, setInputMode] = useState<InputMode>('voice');
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            if (tabParam && ['capture', 'timeline', 'focus', 'analytics', 'profile'].includes(tabParam)) {
                return tabParam as Tab;
            }
        }
        return 'capture';
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingStartTimeRef = useRef<number>(0);
    const supabase = createClient();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        setDailyPrompt(DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)]);

        return () => authSubscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            loadMemories();
            loadSubscription();
        }
    }, [user]);

    const toast = (message: string, type: 'success' | 'error' = 'success') => {
        setShowToast({ message, type });
        setTimeout(() => setShowToast(null), 3000);
    };

    const loadSubscription = async () => {
        try {
            const { data, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Failed to load subscription:', error);
            } else {
                setSubscription(data);
            }
        } catch (error) {
            console.error('Failed to load subscription:', error);
        }
    };

    const loadMemories = async () => {
        try {
            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMemories(data || []);
        } catch (error) {
            console.error('Failed to load memories:', error);
            toast('Failed to load memories', 'error');
        }
    };

    const startRecording = async () => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast('Microphone not available on this browser', 'error');
                return;
            }

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (permError) {
                console.error('Permission error:', permError);
                toast('Please allow microphone access', 'error');
                return;
            }

            if (!window.MediaRecorder) {
                toast('Recording not supported', 'error');
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = '';
                    }
                }
            }

            const options = mimeType ? {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            } : { audioBitsPerSecond: 128000 };

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            recordingStartTimeRef.current = Date.now();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, {
                    type: mimeType || 'audio/webm'
                });
                const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000;
                await handleProcessing(audioBlob, recordingDuration);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Microphone error:', error);
            toast('Microphone access denied', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
        }
    };

    const handleProcessing = async (audioBlob: Blob, recordingDuration: number) => {
        try {
            if (audioBlob.size < 1000) {
                toast('Recording too short', 'error');
                setIsProcessing(false);
                return;
            }

            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');
            const result = await processAudio(formData);

            const { url: audioUrl } = await uploadAudioToCloudinary(audioBlob, user.id);

            let audioDuration = recordingDuration;
            try {
                audioDuration = await new Promise<number>((resolve, reject) => {
                    const audio = new Audio();
                    const objectUrl = URL.createObjectURL(audioBlob);

                    audio.onloadedmetadata = () => {
                        resolve(audio.duration);
                        URL.revokeObjectURL(objectUrl);
                    };

                    audio.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error('Failed to load audio metadata'));
                    };

                    audio.src = objectUrl;
                });
            } catch (metadataError) {
                console.warn('Could not extract audio duration, using recording time');
            }

            const { data, error } = await supabase
                .from('memories')
                .insert({
                    user_id: user.id,
                    title: result.title,
                    content: result.transcription,
                    summary: result.summary,
                    category: result.category,
                    audio_url: audioUrl,
                    duration: Math.round(audioDuration * 10) / 10,
                    reminder_time: result.reminderTime || null,
                    is_favorite: false,
                    is_completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            setMemories((prev) => [data, ...prev]);

            // Sync to Google Calendar if voice recording set a reminder
            if (result.reminderTime) {
                console.log('[Voice] AI extracted reminder time:', result.reminderTime);
                try {
                    await fetch('/api/calendar/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            memoryId: data.id,
                            title: result.title,
                            content: result.summary,
                            reminderTime: result.reminderTime,
                        }),
                    });
                    console.log('[Calendar] Synced voice reminder to Google Calendar');
                    toast('Memory saved with reminder!');
                } catch (calError) {
                    console.log('[Calendar] Voice reminder not synced (calendar not connected)');
                    toast('Memory saved successfully!');
                }
            } else {
                toast('Memory saved successfully!');
            }

            setActiveTab('timeline');
        } catch (error: any) {
            console.error('Processing error:', error);
            toast(error.message || 'Failed to process memory', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleManualMemory = async (data: {
        title: string;
        content: string;
        category: MemoryCategory;
        imageUrl: string | null;
        reminderTime: string | null;
    }) => {
        setIsProcessing(true);
        try {
            const result = await processManualEntry(data.content);

            // Convert datetime-local format to ISO timestamp
            let reminderTimeISO: string | null = null;
            if (data.reminderTime) {
                // datetime-local gives format like "2024-12-09T12:55"
                // Convert to ISO string with timezone
                const reminderDate = new Date(data.reminderTime);
                reminderTimeISO = reminderDate.toISOString();
                console.log('[Memory] Reminder time set:', data.reminderTime, '→', reminderTimeISO);
            }

            const { data: memory, error } = await supabase
                .from('memories')
                .insert({
                    user_id: user.id,
                    title: data.title,
                    content: data.content,
                    summary: result.summary,
                    category: data.category,
                    audio_url: null,
                    duration: null,
                    image_url: data.imageUrl,
                    reminder_time: reminderTimeISO,
                    is_favorite: false,
                    is_completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            setMemories((prev) => [memory, ...prev]);

            // Sync to Google Calendar if reminder is set
            if (reminderTimeISO) {
                try {
                    await fetch('/api/calendar/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            memoryId: memory.id,
                            title: data.title,
                            content: data.content,
                            reminderTime: reminderTimeISO,
                        }),
                    });
                    console.log('[Calendar] Synced reminder to Google Calendar');
                } catch (calError) {
                    console.log('[Calendar] Not synced (calendar not connected or sync disabled)');
                }
            }

            toast('Memory saved successfully!');
            setActiveTab('timeline');
            setInputMode('voice');
        } catch (error: any) {
            console.error('Save error:', error);
            toast(error.message || 'Failed to save memory', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredMemories = memories
        .filter(m => filterCategory === 'all' || m.category === filterCategory)
        .filter(m =>
            searchQuery === '' ||
            m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.summary.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const handleToggleFavorite = async (id: string) => {
        const memory = memories.find(m => m.id === id);
        if (!memory) return;

        const { error } = await supabase
            .from('memories')
            .update({ is_favorite: !memory.is_favorite })
            .eq('id', id);

        if (!error) {
            setMemories(prev => prev.map(m =>
                m.id === id ? { ...m, is_favorite: !m.is_favorite } : m
            ));
        }
    };

    const handleToggleComplete = async (id: string) => {
        const memory = memories.find(m => m.id === id);
        if (!memory) return;

        const { error } = await supabase
            .from('memories')
            .update({ is_completed: !memory.is_completed })
            .eq('id', id);

        if (!error) {
            setMemories(prev => prev.map(m =>
                m.id === id ? { ...m, is_completed: !m.is_completed } : m
            ));
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('id', id);

        if (!error) {
            setMemories(prev => prev.filter(m => m.id !== id));
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMemories([]);
    };

    const handleUpgrade = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-session`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                }
            );

            const { url, error } = await response.json();

            if (error) throw new Error(error);
            if (url) window.location.href = url;
        } catch (error: any) {
            console.error('Upgrade error:', error);
            toast('Failed to start upgrade process', 'error');
        }
    };

    if (!user) {
        return <AuthScreen onSuccess={() => { }} />;
    }

    const isPremium = subscription?.status === 'active';

    return (
        <div className="min-h-screen flex flex-col bg-cosmic-950">
            <header className="sticky top-0 z-50 glass-card border-b border-white/5 shadow-glow">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BrainCircuit className="text-primary-400" size={32} />
                            <h1 className="text-2xl font-bold text-white">Memory Tap</h1>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-cosmic-800/50 hover:bg-cosmic-800 rounded-xl transition-all text-slate-300 hover:text-white border border-white/5"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>

                    <nav className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
                        {(['capture', 'timeline', 'focus', 'analytics', 'profile'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${activeTab === tab
                                    ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                                    : 'bg-cosmic-800/30 text-slate-400 hover:bg-cosmic-800/50 hover:text-white'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            <div className="flex-grow overflow-hidden">
                <main className="max-w-7xl mx-auto px-6 pb-8 h-full overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {activeTab === 'capture' && (
                            <motion.div
                                key="capture"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-2xl mx-auto py-12 space-y-8"
                            >
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setInputMode('voice')}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${inputMode === 'voice'
                                            ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                                            : 'bg-cosmic-800/30 text-slate-400 hover:bg-cosmic-800/50'
                                            }`}
                                    >
                                        <Mic size={20} />
                                        Voice
                                    </button>
                                    <button
                                        onClick={() => setInputMode('manual')}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${inputMode === 'manual'
                                            ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                                            : 'bg-cosmic-800/30 text-slate-400 hover:bg-cosmic-800/50'
                                            }`}
                                    >
                                        <Edit3 size={20} />
                                        Type
                                    </button>
                                </div>

                                <AnimatePresence mode="wait">
                                    {inputMode === 'voice' ? (
                                        <motion.div
                                            key="voice"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center space-y-6"
                                        >
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cosmic-800/50 rounded-full border border-white/5">
                                                <Sparkles className="text-primary-400" size={16} />
                                                <span className="text-sm font-medium text-slate-300">Daily Inspiration</span>
                                            </div>

                                            <h2 className="text-2xl font-bold text-white px-4">
                                                "{dailyPrompt}"
                                            </h2>

                                            <p className="text-slate-400 text-lg">
                                                {isProcessing ? 'Processing your memory...' : 'READY TO LISTEN'}
                                            </p>

                                            <div className="flex justify-center pt-8">
                                                <RecordButton
                                                    isRecording={isRecording}
                                                    isProcessing={isProcessing}
                                                    onStart={startRecording}
                                                    onStop={stopRecording}
                                                />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <ManualMemoryForm
                                            key="manual"
                                            onSubmit={handleManualMemory}
                                            onCancel={() => setInputMode('voice')}
                                        />
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {activeTab === 'timeline' && (
                            <motion.div
                                key="timeline"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="pt-4"
                            >
                                <div className="space-y-4 sticky top-18 z-10 bg-cosmic-950/95 backdrop-blur-xl pb-2">
                                    <div className="relative w-full group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-400 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search your timeline..."
                                            className="w-full pl-12 pr-4 py-3 bg-cosmic-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-white placeholder:text-slate-500 transition-all"
                                        />
                                    </div>

                                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                        {['all', 'task', 'reminder', 'idea', 'note'].map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setFilterCategory(cat as MemoryCategory | 'all')}
                                                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filterCategory === cat
                                                    ? 'bg-gradient-to-r from-primary-600 to-cosmic-600 text-white shadow-glow'
                                                    : 'bg-cosmic-800/30 text-slate-400 hover:bg-cosmic-800/50 hover:text-white border border-white/5'
                                                    }`}
                                            >
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 pb-8">
                                    {filteredMemories.length === 0 ? (
                                        <div className="text-center py-16 text-slate-400">
                                            <p className="text-lg">No memories found</p>
                                            <p className="text-sm mt-2">Start capturing your thoughts!</p>
                                        </div>
                                    ) : (
                                        <AnimatePresence>
                                            {filteredMemories.map((memory) => (
                                                <MemoryCard
                                                    key={memory.id}
                                                    memory={memory}
                                                    onToggleFavorite={handleToggleFavorite}
                                                    onToggleComplete={handleToggleComplete}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'focus' && (
                            <FocusView
                                memories={memories}
                                onToggleFavorite={handleToggleFavorite}
                                onToggleComplete={handleToggleComplete}
                                onDelete={handleDelete}
                            />
                        )}

                        {activeTab === 'analytics' && (
                            <AnalyticsView memories={memories} />
                        )}

                        {activeTab === 'profile' && (
                            <motion.div
                                key="profile"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-2xl mx-auto py-6 space-y-6"
                            >
                                <div className="glass-card rounded-3xl p-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-cosmic-500 flex items-center justify-center">
                                            <UserIcon size={40} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">{user?.email}</h2>
                                            <p className="text-slate-400">
                                                {isPremium ? '✨ Premium Member' : 'Basic Member'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                        <div className="bg-cosmic-800/30 rounded-2xl p-6 border border-white/5">
                                            <div className="text-3xl font-bold text-white mb-1">{memories.length}</div>
                                            <div className="text-sm text-slate-400">Total Memories</div>
                                        </div>
                                        <div className="bg-cosmic-800/30 rounded-2xl p-6 border border-white/5">
                                            <div className="text-3xl font-bold text-white mb-1">
                                                {memories.filter(m => m.is_favorite).length}
                                            </div>
                                            <div className="text-sm text-slate-400">Favorites</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Google Calendar Settings */}
                                <GoogleCalendarSettings userId={user.id} />

                                <button
                                    onClick={handleUpgrade}
                                    className="w-full glass-card border-primary-500/20 text-primary-400 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-primary-500/10 transition-colors"
                                >
                                    <Sparkles size={20} />
                                    {isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}
                                </button>

                                <button
                                    onClick={handleLogout}
                                    className="w-full glass-card border-red-500/20 text-red-400 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut size={20} />
                                    Sign Out
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl ${showToast.type === 'success'
                            ? 'bg-emerald-500/90'
                            : 'bg-red-500/90'
                            } text-white font-semibold`}
                    >
                        {showToast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}