'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Lightbulb, BarChart3 } from 'lucide-react';
import { Memory } from '@/lib/types';

interface AnalyticsViewProps {
    memories: Memory[];
}

export default function AnalyticsView({ memories }: AnalyticsViewProps) {
    const [analysis, setAnalysis] = useState<{ pattern: string, suggestion: string, productivityScore: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/analytics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ memories }),
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch analysis');
                }

                const result = await response.json();
                setAnalysis(result);
            } catch (error) {
                console.error('Failed to generate analysis', error);
                const totalTasks = memories.filter(m => m.category === 'task' || m.category === 'reminder').length;
                const completed = memories.filter(m => m.is_completed).length;
                const score = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 50;
                
                setAnalysis({
                    pattern: "You're building a consistent habit.",
                    suggestion: "Keep capturing your thoughts regularly!",
                    productivityScore: score
                });
            } finally {
                setLoading(false);
            }
        };

        if (memories.length > 0) {
            fetchAnalysis();
        } else {
            setLoading(false);
        }
    }, [memories]);

    const totalMemories = memories.length;
    const completedTasks = memories.filter((m) => m.is_completed).length;
    const completionRate = totalMemories > 0 ? Math.round((completedTasks / totalMemories) * 100) : 0;

    const categoryBreakdown = memories.reduce((acc, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6 pb-32">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden rounded-3xl p-8 text-center"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-accent-600 opacity-90" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                <div className="relative z-10">
                    <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-4 shadow-inner border border-white/20">
                        <TrendingUp size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-medium text-primary-100 mb-2">Productivity Score</h2>
                    {loading ? (
                        <div className="text-6xl font-bold text-white/50 animate-pulse">--</div>
                    ) : (
                        <div className="text-7xl font-bold text-white tracking-tighter drop-shadow-lg">
                            {analysis?.productivityScore || 0}
                        </div>
                    )}
                    <p className="text-primary-200 mt-2 font-medium">out of 100</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-3xl p-6 text-center">
                    <p className="text-sm text-slate-400 mb-2 font-medium uppercase tracking-wider">Total Memories</p>
                    <p className="text-4xl font-bold text-white">{totalMemories}</p>
                </div>
                <div className="glass-card rounded-3xl p-6 text-center">
                    <p className="text-sm text-slate-400 mb-2 font-medium uppercase tracking-wider">Completion</p>
                    <p className="text-4xl font-bold text-emerald-400">{completionRate}%</p>
                </div>
            </div>

            <div className="glass-card rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 size={20} className="text-primary-400" />
                    <h3 className="font-bold text-white text-lg">Breakdown</h3>
                </div>
                <div className="space-y-4">
                    {Object.entries(categoryBreakdown).map(([category, count]) => (
                        <div key={category}>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-slate-300 capitalize">{category}</span>
                                <span className="text-slate-400 font-mono">{count}</span>
                            </div>
                            <div className="bg-midnight-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(count / totalMemories) * 100}%` }}
                                    className={`h-full rounded-full ${category === 'task' ? 'bg-primary-500' :
                                            category === 'reminder' ? 'bg-amber-500' :
                                                category === 'idea' ? 'bg-accent-500' : 'bg-slate-500'
                                        }`}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!loading && analysis && (
                <>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-3xl p-6 border-l-4 border-l-primary-500"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-primary-500/20 rounded-lg">
                                <Target size={20} className="text-primary-400" />
                            </div>
                            <h3 className="font-bold text-white text-lg">Pattern Detected</h3>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{analysis.pattern}</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card rounded-3xl p-6 border-l-4 border-l-accent-500"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-accent-500/20 rounded-lg">
                                <Lightbulb size={20} className="text-accent-400" />
                            </div>
                            <h3 className="font-bold text-white text-lg">Suggestion</h3>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{analysis.suggestion}</p>
                    </motion.div>
                </>
            )}

            {totalMemories === 0 && (
                <div className="text-center py-12 text-slate-600">
                    <p>No data yet. Start recording memories to see analytics!</p>
                </div>
            )}
        </div>
    );
}
