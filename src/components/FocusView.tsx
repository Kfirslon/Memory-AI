'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Memory } from '@/lib/types';
import { generateBriefing } from '@/lib/groq/client';

interface FocusViewProps {
    memories: Memory[];
    onToggleFavorite: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function FocusView({ memories, onToggleFavorite, onToggleComplete, onDelete }: FocusViewProps) {
    const [briefing, setBriefing] = useState<{ priorityIds: string[], analysis: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBriefing = async () => {
            setLoading(true);
            try {
                const result = await generateBriefing(memories);
                setBriefing(result);
            } catch (error) {
                console.error('Failed to generate briefing', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBriefing();
    }, [memories]);

    const pendingTasks = memories.filter(
        (m) => !m.is_completed && (m.category === 'task' || m.category === 'reminder')
    );

    const priorityMemories = pendingTasks.filter((m) => briefing?.priorityIds.includes(m.id));

    return (
        <div className="space-y-8 pb-32">
            {/* AI Briefing */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl p-1"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 animate-gradient-x opacity-70" />
                <div className="relative bg-midnight-900 rounded-[22px] p-6 h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-gradient-to-br from-primary-400 to-accent-400 p-2 rounded-lg text-white shadow-lg">
                            <Sparkles size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-white">AI Briefing</h2>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-2">
                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    ) : (
                        <p className="text-slate-300 leading-relaxed text-lg font-light">{briefing?.analysis || 'No pending tasks! Enjoy your day.'}</p>
                    )}
                </div>
            </motion.div>

            {/* Priority Tasks */}
            {priorityMemories.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-amber-400 fill-amber-400" />
                        Top Priorities
                    </h3>
                    <div className="space-y-3">
                        {priorityMemories.map((memory, index) => (
                            <motion.div
                                key={memory.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="glass-card rounded-2xl p-5 border-l-4 border-l-amber-400 flex items-center justify-between group hover:bg-white/5 transition-colors"
                            >
                                <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="w-6 h-6 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-xs font-bold border border-amber-500/30">
                                            {index + 1}
                                        </span>
                                        <h4 className="font-semibold text-white text-lg">{memory.title}</h4>
                                    </div>
                                    <p className="text-sm text-slate-400 ml-9">{memory.summary}</p>
                                </div>
                                <button
                                    onClick={() => onToggleComplete(memory.id)}
                                    className="p-3 hover:bg-emerald-500/20 rounded-xl transition-colors flex-shrink-0 group-hover:scale-110"
                                    title="Complete"
                                >
                                    <CheckCircle2 size={24} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Pending Tasks */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-primary-400" />
                    All Tasks & Reminders
                </h3>
                {pendingTasks.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 glass-card rounded-3xl border-dashed border-2 border-slate-800">
                        <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500/50" />
                        <p className="font-medium text-slate-400">All caught up! 🎉</p>
                        <p className="text-sm text-slate-600">No pending tasks or reminders.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {pendingTasks.map((memory) => (
                            <motion.div
                                key={memory.id}
                                layout
                                className="glass-card rounded-2xl p-4 flex items-center justify-between hover:bg-white/5 transition-all group"
                            >
                                <div className="flex-grow">
                                    <h4 className="font-semibold text-slate-200 mb-1">{memory.title}</h4>
                                    <p className="text-sm text-slate-500">{memory.summary}</p>
                                </div>
                                <button
                                    onClick={() => onToggleComplete(memory.id)}
                                    className="p-2 hover:bg-emerald-500/20 rounded-xl transition-colors"
                                >
                                    <CheckCircle2 size={20} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
