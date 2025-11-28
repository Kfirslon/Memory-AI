'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface AudioPlayerProps {
    src: string;
}

export default function AudioPlayer({ src }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
            <audio ref={audioRef} src={src} />

            <button
                onClick={togglePlay}
                className="w-8 h-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
            </button>

            <div className="flex-grow bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-primary-600 rounded-full"
                    style={{ width: `${progress}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
            </div>
        </div>
    );
}