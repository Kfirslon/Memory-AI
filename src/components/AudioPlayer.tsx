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
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        // Detect iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            if (audio.duration) {
                const prog = (audio.currentTime / audio.duration) * 100;
                setProgress(prog);
                setCurrentTime(audio.currentTime);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        const handleError = (e: ErrorEvent) => {
            console.error('Audio playback error:', e);
            setError(true);
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError as any);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError as any);
        };
    }, []);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        try {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                await audio.play();
                setIsPlaying(true);
            }
        } catch (err) {
            console.error('Playback failed:', err);
            setError(true);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    };

    const formatTime = (seconds: number): string => {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Check if file is WebM and user is on iOS
    const isWebM = src.includes('.webm');
    if (isIOS && isWebM) {
        return (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                <div className="text-xs text-amber-700">
                    ⚠️ Audio not supported on iOS Safari. Please use Chrome.
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-2xl">
                <div className="text-xs text-red-700">
                    ❌ Audio playback error
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
            <audio 
                ref={audioRef} 
                src={src}
                preload="metadata"
                playsInline
                crossOrigin="anonymous"
            />

            <button
                onClick={togglePlay}
                className="w-8 h-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
            </button>

            <div 
                className="flex-grow bg-slate-200 h-1.5 rounded-full overflow-hidden cursor-pointer"
                onClick={handleSeek}
            >
                <motion.div
                    className="h-full bg-primary-600 rounded-full"
                    style={{ width: `${progress}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
            </div>

            <span className="text-xs text-slate-500 font-mono tabular-nums flex-shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>
        </div>
    );
}
