import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Memory } from '@/lib/types';
import { Calendar, ChevronDown, ChevronUp, Star, Trash2, CheckCircle, Circle, Clock } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

interface MemoryCardProps {
    memory: Memory;
    onToggleFavorite: (id: string) => void;
    onToggleComplete?: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: { title: string; content: string }) => void;
}

const categoryColors = {
    task: 'bg-blue-100 text-blue-700 border-blue-200',
    reminder: 'bg-orange-100 text-orange-700 border-orange-200',
    idea: 'bg-purple-100 text-purple-700 border-purple-200',
    note: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const MemoryCard: React.FC<MemoryCardProps> = ({ memory, onToggleFavorite, onToggleComplete, onDelete, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const formattedDate = new Date(memory.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const isTaskOrReminder = memory.category === 'task' || memory.category === 'reminder';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 overflow-hidden ${memory.is_completed ? 'opacity-70 grayscale-[0.5]' : ''}`}
        >
            <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${categoryColors[memory.category]}`}>
                            {memory.category}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {formattedDate}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(memory.id); }}
                            className={`p-2 rounded-full transition-colors ${memory.is_favorite ? 'text-yellow-400 hover:bg-yellow-50' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-400'}`}
                        >
                            <Star size={18} fill={memory.is_favorite ? "currentColor" : "none"} />
                        </button>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    {/* Checkbox for tasks */}
                    {isTaskOrReminder && onToggleComplete && (
                        <button
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleComplete(memory.id); }}
                            className={`flex-shrink-0 mt-1 transition-colors ${memory.is_completed ? 'text-green-500' : 'text-slate-300 hover:text-green-400'}`}
                        >
                            {memory.is_completed ? <CheckCircle size={24} fill="currentColor" className="text-white bg-green-500 rounded-full" /> : <Circle size={24} />}
                        </button>
                    )}

                    <div className="flex-grow">
                        <h3 className={`text-lg font-bold text-slate-800 mb-2 leading-tight ${memory.is_completed ? 'line-through text-slate-400' : ''}`}>
                            {memory.title}
                        </h3>

                        <p className={`text-slate-600 text-sm leading-relaxed mb-4 ${memory.is_completed ? 'text-slate-400' : ''}`}>
                            {memory.summary}
                        </p>
                    </div>
                </div>

                {memory.audio_url && (
                    <div className="mb-3">
                        <AudioPlayer src={memory.audio_url} />
                        {memory.duration && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-2 ml-1">
                                <Clock size={12} />
                                <span>{memory.duration.toFixed(1)}s duration</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                        {isExpanded ? (
                            <>Less <ChevronUp size={14} /></>
                        ) : (
                            <>View Transcript <ChevronDown size={14} /></>
                        )}
                    </button>

                    <button
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(memory.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50 px-5 border-t border-slate-100 overflow-hidden"
                    >
                        <div className="py-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Transcript</h4>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {memory.content}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default MemoryCard;