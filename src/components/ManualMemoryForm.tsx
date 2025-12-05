'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Loader2, Calendar } from 'lucide-react';
import { MemoryCategory } from '@/lib/types';
import { uploadImageToSupabase } from '@/lib/imageUpload';

interface ManualMemoryFormProps {
    onSubmit: (data: {
        title: string;
        content: string;
        category: MemoryCategory;
        imageUrl: string | null;
        reminderTime: string | null;
    }) => Promise<void>;
    onCancel: () => void;
}

export default function ManualMemoryForm({ onSubmit, onCancel }: ManualMemoryFormProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<MemoryCategory>('note');
    const [reminderTime, setReminderTime] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('Image must be less than 10MB');
            return;
        }

        setImageFile(file);
        setError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim() || !content.trim()) {
            setError('Title and content are required');
            return;
        }

        setIsSubmitting(true);

        try {
            let imageUrl: string | null = null;

            // Upload image if selected
            if (imageFile) {
                // Get current user ID
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (user?.id) {
                    imageUrl = await uploadImageToSupabase(imageFile, user.id);
                }
            }

            await onSubmit({
                title: title.trim(),
                content: content.trim(),
                category,
                imageUrl,
                reminderTime: reminderTime || null,
            });

            // Reset form
            setTitle('');
            setContent('');
            setCategory('note');
            setReminderTime('');
            removeImage();
        } catch (err: any) {
            setError(err.message || 'Failed to save memory');
        } finally {
            setIsSubmitting(false);
        }
    };

    const categoryColors = {
        task: 'from-blue-500 to-blue-600',
        reminder: 'from-amber-500 to-amber-600',
        idea: 'from-purple-500 to-purple-600',
        note: 'from-slate-500 to-slate-600',
    };

    return (
        <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="w-full max-w-2xl mx-auto space-y-6 py-6"
        >
            {/* Title Input */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your memory a catchy title..."
                    className="w-full px-4 py-3 bg-cosmic-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-white placeholder:text-slate-500 transition-all"
                    maxLength={100}
                    disabled={isSubmitting}
                />
            </div>

            {/* Content Textarea */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Content
                </label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's on your mind? Describe your thought, task, idea, or note..."
                    className="w-full px-4 py-3 bg-cosmic-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-white placeholder:text-slate-500 transition-all resize-none"
                    rows={6}
                    disabled={isSubmitting}
                />
            </div>

            {/* Category Selector */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                    Category
                </label>
                <div className="grid grid-cols-4 gap-3">
                    {(['task', 'reminder', 'idea', 'note'] as const).map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            disabled={isSubmitting}
                            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${category === cat
                                ? `bg-gradient-to-r ${categoryColors[cat]} text-white shadow-glow`
                                : 'bg-cosmic-800/50 text-slate-400 hover:bg-cosmic-800 hover:text-white border border-white/5'
                                }`}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reminder Time (only show for reminders) */}
            {category === 'reminder' && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                >
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                        <Calendar size={16} />
                        Remind me at
                    </label>
                    <input
                        type="datetime-local"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="w-full px-4 py-3 bg-cosmic-900/50 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-white transition-all"
                        disabled={isSubmitting}
                    />
                </motion.div>
            )}

            {/* Image Upload */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <ImageIcon size={16} />
                    Add Photo (Optional)
                </label>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={isSubmitting}
                />

                {imagePreview ? (
                    <div className="relative group">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-2xl border border-white/10"
                        />
                        <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            disabled={isSubmitting}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-primary-500/50 hover:bg-cosmic-900/30 transition-all flex flex-col items-center gap-2 text-slate-400 hover:text-white"
                        disabled={isSubmitting}
                    >
                        <ImageIcon size={32} />
                        <span className="text-sm font-medium">Click to upload image</span>
                        <span className="text-xs text-slate-500">JPG, PNG, GIF up to 10MB</span>
                    </button>
                )}
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-cosmic-800/50 hover:bg-cosmic-800 text-white font-semibold rounded-2xl transition-all border border-white/5 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !content.trim()}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-cosmic-600 hover:shadow-glow text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save Memory'
                    )}
                </button>
            </div>
        </motion.form>
    );
}
