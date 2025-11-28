import React from 'react';
import { motion } from 'framer-motion';
import { Memory } from '@/lib/types';
import { Calendar, Tag, ChevronDown, ChevronUp, Star, Trash2, CheckCircle2, Circle, Clock } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface MemoryCardProps {
    memory: Memory;
    onToggleFavorite: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function MemoryCard({
    memory,
    onToggleFavorite,
    onToggleComplete,
    onDelete,
}: MemoryCardProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const categoryColors = {
        task: 'bg-blue-100 text-blue-700 border-blue-200',
        reminder: 'bg-amber-100 text-amber-700 border-amber-200',
        idea: 'bg-purple-100 text-purple-700 border-purple-200',
        note: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds: number | null | undefined) => {
        if (!seconds) return null;
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card rounded-3xl p-6 hover:shadow-xl transition-all duration-300"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                onToggleComplete(memory.id);
                            }}
                            className="flex-shrink-0 transition-transform hover:scale-110"
                        >
                            {memory.is_completed ? (
                                <CheckCircle2 className="text-emerald-500" size={24} />
                            ) : (
                                <Circle className="text-slate-400 hover:text-slate-600" size={24} />
                            )}
                        </button>
                        <h3 className={`font-bold text-lg text-white ${memory.is_completed ? 'line-through opacity-60' : ''}`}>
                            {memory.title}
                        </h3>
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                onToggleFavorite(memory.id);
                            }}
                            className="flex-shrink-0 transition-transform hover:scale-110"
                        >
                            <Star
                                className={memory.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-yellow-400'}
                                size={20}
                            />
                        </button>
                    </div>

                    {/* Audio Player */}
                    {memory.audio_url && (
                        <div className="mb-4">
                            <AudioPlayer src={memory.audio_url} />
                            {memory.duration && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                                    <Clock size={16} />
                                    <span>{formatDuration(memory.duration)} duration</span>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-slate-300 leading-relaxed mb-3">{memory.summary}</p>

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${categoryColors[memory.category]}`}>
                            {memory.category}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(memory.created_at)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        onDelete(memory.id);
                    }}
                    className="text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-xl"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Expandable Content */}
            {memory.content && (
                <div className="border-t border-slate-700/50 pt-4 mt-4">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
                    >
                        <span>Full Transcription</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 text-slate-300 text-sm leading-relaxed bg-midnight-900/50 p-4 rounded-2xl"
                        >
                            {memory.content}
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
