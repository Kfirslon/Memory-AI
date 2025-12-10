import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Memory } from '@/lib/types';
import { Calendar, ChevronDown, ChevronUp, Star, Trash2, CheckCircle2, Circle, Clock, Pencil, Bell } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface MemoryCardProps {
    memory: Memory;
    onToggleFavorite: (id: string) => void;
    onToggleComplete: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: { title: string; content: string }) => void;
}

export default function MemoryCard({
    memory,
    onToggleFavorite,
    onToggleComplete,
    onDelete,
    onUpdate,
}: MemoryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const categoryColors = {
        task: 'bg-blue-100 text-blue-700 border-blue-200',
        reminder: 'bg-amber-100 text-amber-700 border-amber-200',
        idea: 'bg-purple-100 text-purple-700 border-purple-200',
        note: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        // Convert UTC time to user's local timezone
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
            <div>
                {isEditing ? (
                    <div className="mb-4 space-y-3">
                        <input
                            type="text"
                            defaultValue={memory.title}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            id={`edit-title-${memory.id}`}
                            placeholder="Memory Title"
                        />
                        <textarea
                            defaultValue={memory.content}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[100px]"
                            id={`edit-content-${memory.id}`}
                            placeholder="Memory Content"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const titleInput = document.getElementById(`edit-title-${memory.id}`) as HTMLInputElement;
                                    const contentInput = document.getElementById(`edit-content-${memory.id}`) as HTMLTextAreaElement;
                                    if (onUpdate && titleInput && contentInput) {
                                        onUpdate(memory.id, {
                                            title: titleInput.value,
                                            content: contentInput.value
                                        });
                                        setIsEditing(false);
                                    }
                                }}
                                className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-lg shadow-primary-900/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Title Row - Always visible at top */
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
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
                        <h3 className={`font-bold text-xl text-white flex-1 ${memory.is_completed ? 'line-through opacity-60' : ''}`}>
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
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="text-slate-400 hover:text-blue-400 transition-colors p-2 hover:bg-blue-500/10 rounded-xl"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this memory?')) {
                                    onDelete(memory.id);
                                }
                            }}
                            className="text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-xl"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="space-y-4">
                    {/* Audio Player */}
                    {memory.audio_url && (
                        <div>
                            <AudioPlayer src={memory.audio_url} />
                            {memory.duration && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                                    <Clock size={16} />
                                    <span>{formatDuration(memory.duration)} duration</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Image Thumbnail */}
                    {memory.image_url && (
                        <div className="rounded-xl overflow-hidden border border-white/10">
                            <img
                                src={memory.image_url}
                                alt="Memory attachment"
                                className="w-full h-auto max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(memory.image_url!, '_blank')}
                            />
                        </div>
                    )}

                    <p className="text-slate-300 leading-relaxed">{memory.summary}</p>

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${categoryColors[memory.category]}`}>
                            {memory.category}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(memory.created_at)}
                        </span>
                        {memory.reminder_time && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 animate-pulse">
                                <Bell size={14} />
                                Reminder: {formatDate(memory.reminder_time)}
                            </span>
                        )}
                    </div>
                </div>
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
