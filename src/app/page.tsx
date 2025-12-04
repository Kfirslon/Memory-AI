'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BrainCircuit, Mic, Sparkles, User as UserIcon, LogOut, TrendingUp, History, Library } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { processAudio } from '@/lib/groq/client';
import { uploadAudioToCloudinary } from '@/lib/cloudinary';
import { Memory, MemoryCategory } from '@/lib/types';
import AuthScreen from '@/components/AuthScreen';
import RecordButton from '@/components/RecordButton';
import MemoryCard from '@/components/MemoryCard';
import FocusView from '@/components/FocusView';
import AnalyticsView from '@/components/AnalyticsView';

type Tab = 'capture' | 'timeline' | 'focus' | 'analytics' | 'profile';

const DAILY_PROMPTS = [
    "What's the most important thing you learned today?",
    "What's a random idea you had recently?",
    "What are you grateful for right now?",
    "What's one thing you need to get done tomorrow?",
    "Describe a moment that made you smile today.",
];

export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<MemoryCategory | 'all'>('all');
    const [activeTab, setActiveTab] = useState<Tab>('capture');
    const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [dailyPrompt, setDailyPrompt] = useState('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingStartTimeRef = useRef<number>(0);
    const supabase = createClient();

    useEffect(() => {
        // Check auth status
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        setDailyPrompt(DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)]);

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            loadMemories();
        }
    }, [user]);

    const toast = (message: string, type: 'success' | 'error' = 'success') => {
        setShowToast({ message, type });
        setTimeout(() => setShowToast(null), 3000);
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
            // iOS Safari specific: Request permission more explicitly
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };

            // First check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast('Microphone not available on this browser', 'error');
                return;
            }

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (permError) {
                console.error('Permission error:', permError);
                toast('Please allow microphone access in Settings → Safari → Microphone', 'error');
                return;
            }

            // Check MediaRecorder support
            if (!window.MediaRecorder) {
                toast('Recording not supported. Please use Chrome instead.', 'error');
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            // Determine best audio format for iOS
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    // iOS fallback
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = ''; // Let browser decide
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

            // Process with Groq AI
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');
            const result = await processAudio(formData);

            // Upload audio to Cloudinary (auto-converts to MP4 for iOS)
            const { url: audioUrl } = await uploadAudioToCloudinary(audioBlob, user.id);

            // Calculate accurate duration from audio file metadata
            let audioDuration = recordingDuration; // Fallback to recording duration
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
                console.warn('Could not extract audio duration from metadata, using recording time:', metadataError);
            }

            // Save to database with duration
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
                    is_favorite: false,
                    is_completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            setMemories((prev) => [data, ...prev]);
            toast('Memory saved successfully!');
            setActiveTab('timeline');
        } catch (error: any) {
            console.error('Processing error:', error);
            toast(error.message || 'Failed to process memory', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleFavorite = async (id: string) => {
        const memory = memories.find((m) => m.id === id);
        if (!memory) return;

        try {
            const { error } = await supabase
                .from('memories')
                .update({ is_favorite: !memory.is_favorite })
                .eq('id', id);

            if (error) throw error;
            setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, is_favorite: !m.is_favorite } : m)));
        } catch (error) {
            toast('Failed to update favorite', 'error');
        }
    };

    const handleToggleComplete = async (id: string) => {
        const memory = memories.find((m) => m.id === id);
        if (!memory) return;

        try {
            const { error } = await supabase
                .from('memories')
                .update({ is_completed: !memory.is_completed })
                .eq('id', id);

            if (error) throw error;
            setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, is_completed: !m.is_completed } : m)));
        } catch (error) {
            toast('Failed to update completion', 'error');
        }
    };

    const handleUpdateMemory = async (id: string, updates: { title: string; content: string }) => {
        try {
            const { error } = await supabase
                .from('memories')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            setMemories((prev) =>
                prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
            );
            toast('Memory updated successfully');
        } catch (error) {
            console.error('Update error:', error);
            toast('Failed to update memory', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this memory?')) return;

        try {
            const { error } = await supabase.from('memories').delete().eq('id', id);
            if (error) throw error;
            setMemories((prev) => prev.filter((m) => m.id !== id));
            toast('Memory deleted');
        } catch (error) {
            toast('Failed to delete memory', 'error');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMemories([]);
    };

    const filteredMemories = memories
        .filter((m) => filterCategory === 'all' || m.category === filterCategory)
        .filter(
            (m) =>
                m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.content.toLowerCase().includes(searchQuery.toLowerCase())
        );

    if (!user) {
        return <AuthScreen onSuccess={() => { }} />;
    }

    return (
        <div className="min-h-screen bg-cosmic-950 text-white font-sans pb-24 selection:bg-primary-500/30 overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-cosmic-800/20 blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary-900/20 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Content Container */}
            <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6 min-h-screen flex flex-col">
                {/* Header */}
                <header className="mb-6 flex justify-between items-center sticky top-0 bg-cosmic-950/80 backdrop-blur-xl z-20 py-4 -mx-4 px-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-primary-500 to-cosmic-500 p-2.5 rounded-xl text-white shadow-glow">
                            <BrainCircuit size={24} />
                        </div>
                        <span className="font-bold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">Memory Tap</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Add extra header actions here if needed */}
                    </div>
                </header>

                <main className="flex-grow flex flex-col">
                    <AnimatePresence mode="wait">
                        {/* CAPTURE TAB (HOME) */}
                        {activeTab === 'capture' && (
                            <motion.div
                                key="capture"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="flex-grow flex flex-col items-center justify-center space-y-12 py-10"
                            >
                                {/* Daily Prompt */}
                                <div className="text-center space-y-4 max-w-md mx-auto">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary-300 mb-2">
                                        <Sparkles size={12} /> Daily Inspiration
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 leading-tight">
                                        "{dailyPrompt}"
                                    </h2>
                                </div>

                                {/* Visualizer (Simulated) */}
                                <div className="h-24 flex items-center justify-center gap-1.5">
                                    {isRecording ? (
                                        Array.from({ length: 12 }).map((_, i) => (
                                            <motion.div
                                                key={i}
                                                className="w-2 bg-gradient-to-t from-primary-500 to-cosmic-400 rounded-full"
                                                animate={{
                                                    height: [20, Math.random() * 60 + 20, 20],
                                                }}
                                                transition={{
                                                    duration: 0.5,
                                                    repeat: Infinity,
                                                    delay: i * 0.05,
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-slate-500 text-sm font-medium tracking-widest uppercase">Ready to Listen</div>
                                    )}
                                </div>

                                {/* Big Record Button */}
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary-500/20 blur-[60px] rounded-full" />
                                    <div className="scale-150">
                                        <RecordButton
                                            isRecording={isRecording}
                                            isProcessing={isProcessing}
                                            onStart={startRecording}
                                            onStop={stopRecording}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* TIMELINE TAB (MEMORIES) */}
                        {activeTab === 'timeline' && (
                            <motion.div
                                key="timeline"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {/* Search & Filter */}
                                <div className="space-y-4 sticky top-20 z-10 bg-cosmic-950/95 backdrop-blur-xl py-2 -mx-2 px-2">
                                    <div className="relative w-full group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-400 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Search your timeline..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-cosmic-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-white placeholder:text-slate-500 transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-linear-fade">
                                        {(['all', 'task', 'reminder', 'idea', 'note'] as const).map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setFilterCategory(cat)}
                                                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${filterCategory === cat
                                                    ? 'bg-primary-600 border-primary-500 text-white shadow-glow'
                                                    : 'bg-cosmic-800/50 border-white/5 text-slate-400 hover:bg-cosmic-800 hover:text-white'
                                                    }`}
                                            >
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Memories List */}
                                <div className="space-y-4 pb-32">
                                    <AnimatePresence mode="popLayout">
                                        {filteredMemories.map((memory) => (
                                            <MemoryCard
                                                key={memory.id}
                                                memory={memory}
                                                onToggleFavorite={handleToggleFavorite}
                                                onToggleComplete={handleToggleComplete}
                                                onDelete={handleDelete}
                                                onUpdate={handleUpdateMemory}
                                            />
                                        ))}
                                    </AnimatePresence>
                                    {filteredMemories.length === 0 && (
                                        <div className="text-center py-20 text-slate-500">
                                            <Library className="mx-auto mb-4 text-slate-700" size={48} />
                                            <p className="text-lg">No memories found</p>
                                            <p className="text-sm opacity-60">Go to Capture to start remembering</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'focus' && (
                            <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <FocusView memories={memories} onCompleteTask={handleToggleComplete} />
                            </motion.div>
                        )}

                        {activeTab === 'analytics' && (
                            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <AnalyticsView memories={memories} />
                            </motion.div>
                        )}

                        {activeTab === 'profile' && (
                            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div className="glass-card rounded-3xl p-8 text-center mb-6 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 to-transparent pointer-events-none" />
                                    <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-cosmic-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-glow p-1">
                                        <div className="w-full h-full bg-cosmic-900 rounded-full flex items-center justify-center">
                                            <UserIcon size={40} className="text-white" />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{user.email}</h2>
                                    <p className="text-primary-400 font-medium">Premium Member</p>
                                </div>

                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await fetch('/api/create-checkout', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: user.id }),
                                            });
                                            const data = await res.json();
                                            if (data.url) {
                                                window.location.href = data.url;
                                            } else {
                                                toast(data.error || 'Failed to create checkout', 'error');
                                            }
                                        } catch (error) {
                                            toast('Failed to start checkout', 'error');
                                        }
                                    }}
                                    className="w-full glass-card bg-gradient-to-r from-primary-600 to-cosmic-600 text-white font-bold py-4 rounded-2xl mb-4 flex items-center justify-center gap-2 hover:shadow-glow transition-all hover:scale-[1.02]"
                                >
                                    <Sparkles size={20} /> Upgrade to Premium
                                </button>

                                <button
                                    onClick={handleLogout}
                                    className="w-full glass-card border-red-500/20 text-red-400 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut size={20} /> Sign Out
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                <div className="glass backdrop-blur-xl p-1.5 rounded-full shadow-2xl flex items-center justify-between gap-1 border border-white/10">
                    <TabButton active={activeTab === 'capture'} onClick={() => setActiveTab('capture')} icon={<Mic />} label="Capture" />
                    <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={<History />} label="Timeline" />
                    <TabButton active={activeTab === 'focus'} onClick={() => setActiveTab('focus')} icon={<Sparkles />} label="Focus" />
                    <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<TrendingUp />} label="Stats" />
                    <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Profile" />
                </div>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl text-sm font-semibold z-[60] flex items-center gap-2 border ${showToast.type === 'error'
                            ? 'bg-red-500/90 border-red-400 text-white'
                            : 'bg-emerald-500/90 border-emerald-400 text-white'
                            } backdrop-blur-md`}
                    >
                        {showToast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button
        onClick={onClick}
        className={`relative flex-1 py-3 rounded-full flex items-center justify-center transition-all duration-300 ${active ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
    >
        {active && (
            <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-primary-600 to-cosmic-600 rounded-full shadow-glow"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
        )}
        <span className="relative z-10 flex flex-col items-center gap-1">
            {React.cloneElement(icon as React.ReactElement, { size: 20 })}
            {active && (
                <motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-[10px] font-bold leading-none">
                    {label}
                </motion.span>
            )}
        </span>
    </button>
);