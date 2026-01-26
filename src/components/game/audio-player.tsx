"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";

interface AudioPlayerProps {
  trackId: string;
  albumArt: string;
  songName: string;
  artistName: string;
  previewUrl?: string | null;
  showPlayer?: boolean;
  compact?: boolean;
  autoPlay?: boolean;
  revealed?: boolean; // false = pixelated album art, true = clear
  // Heart functionality
  onHeart?: () => void;
  hasHearted?: boolean;
  isOwnSong?: boolean;
  heartCount?: number;
}

// Blurred album art component - hides album art during guessing
function BlurredImage({
  src,
  alt,
  revealed,
  className = "",
}: {
  src: string;
  alt: string;
  revealed: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={`relative w-full h-full ${className}`}
      initial={false}
      animate={{
        filter: revealed ? "blur(0px)" : "blur(20px)",
        scale: revealed ? 1 : 1.1, // Slight scale to hide edges when blurred
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Image src={src} alt={alt} fill className="object-cover" />
    </motion.div>
  );
}

export function AudioPlayer({
  trackId,
  albumArt,
  songName,
  artistName,
  previewUrl,
  showPlayer = true,
  compact = false,
  autoPlay = false,
  revealed = true,
  onHeart,
  hasHearted = false,
  isOwnSong = false,
  heartCount = 0,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when track changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(null);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [trackId, previewUrl]);

  // Auto-play when enabled
  useEffect(() => {
    if (autoPlay && previewUrl && audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Auto-play was prevented, user needs to interact
          setIsPlaying(false);
        });
      }
    }
  }, [autoPlay, previewUrl, trackId]);

  const togglePlay = async () => {
    if (!audioRef.current || !previewUrl) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Playback error:", err);
      setError("Failed to play audio");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
    setIsLoading(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setError("Preview unavailable");
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  // Heart button component
  const HeartButton = () => {
    // Don't show heart button if no handler
    if (!onHeart) return null;

    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onHeart();
        }}
        disabled={hasHearted}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
          hasHearted
            ? "bg-pink-500/20 border border-pink-500/40 cursor-default"
            : "bg-white/10 border border-white/20 hover:bg-pink-500/20 hover:border-pink-500/40"
        }`}
      >
        <motion.svg
          className={`w-4 h-4 ${hasHearted ? "text-pink-500" : "text-white/70"}`}
          fill={hasHearted ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
          initial={false}
          animate={hasHearted ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </motion.svg>
        <span className={`text-xs font-medium ${hasHearted ? "text-pink-500" : "text-white/70"}`}>
          {heartCount > 0 ? heartCount : "Love it"}
        </span>
      </motion.button>
    );
  };

  // Play button component
  const PlayButton = ({ size = "large" }: { size?: "small" | "large" }) => {
    const sizeClasses = size === "large" ? "w-14 h-14" : "w-10 h-10";
    const iconSize = size === "large" ? "w-6 h-6" : "w-4 h-4";

    if (!previewUrl) {
      return (
        <div
          className={`${sizeClasses} rounded-full bg-white/10 flex items-center justify-center`}
        >
          <svg
            className={`${iconSize} text-white/40`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
      );
    }

    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={togglePlay}
        disabled={isLoading}
        className={`${sizeClasses} rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors disabled:opacity-50`}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className={`${iconSize} border-2 border-white border-t-transparent rounded-full`}
          />
        ) : isPlaying ? (
          <svg
            className={`${iconSize} text-white`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg
            className={`${iconSize} text-white ml-0.5`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </motion.button>
    );
  };

  // Progress bar component
  const ProgressBar = () => (
    <div className="w-full space-y-1">
      <div
        className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer overflow-hidden"
        onClick={handleSeek}
      >
        <motion.div
          className="h-full bg-green-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/40">
        <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="w-full">
        {/* Hidden audio element */}
        {previewUrl && (
          <audio
            ref={audioRef}
            src={previewUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            preload="metadata"
          />
        )}

        {/* Compact layout - album art with centered play button */}
        <div className="flex flex-col items-center">
          {/* Album art with prominent play button */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-xl mb-4"
          >
            <BlurredImage src={albumArt} alt={songName} revealed={revealed} />
            
            {/* Play button overlay - only shown when album art is blurred */}
            {showPlayer && !revealed && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePlay}
                  disabled={isLoading || !previewUrl}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isPlaying 
                      ? "bg-white/90 text-black" 
                      : "bg-green-500 hover:bg-green-400 text-white"
                  } ${!previewUrl ? "bg-white/20 cursor-not-allowed" : ""}`}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-7 h-7 border-3 border-current border-t-transparent rounded-full"
                    />
                  ) : isPlaying ? (
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Song info */}
          <div className="text-center w-full mb-3">
            <h3 className="text-xl font-bold text-white truncate px-2">
              {songName}
            </h3>
            <p className="text-white/60 text-sm truncate px-2">{artistName}</p>
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          {/* Heart button - shown during guessing (not revealed) */}
          {!revealed && onHeart && (
            <div className="flex justify-center mb-3">
              <HeartButton />
            </div>
          )}

          {/* Play button - shown separately when album art is revealed */}
          {showPlayer && revealed && (
            <div className="flex justify-center mb-3">
              <PlayButton size="small" />
            </div>
          )}

          {/* Progress bar */}
          {showPlayer && previewUrl && (
            <div className="w-full">
              <ProgressBar />
            </div>
          )}
          
          {/* Tap to play hint when not playing and album is blurred */}
          {showPlayer && previewUrl && !isPlaying && !error && !revealed && (
            <p className="text-white/40 text-xs mt-2">Tap to play preview</p>
          )}
        </div>
      </div>
    );
  }

  // Full layout for larger screens
  return (
    <div className="flex flex-col items-center">
      {/* Hidden audio element */}
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="metadata"
        />
      )}

      {/* Album art with vinyl effect and play button */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`relative w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl mb-6 group ${isPlaying ? "animate-spin-slow" : ""}`}
        style={{ animationDuration: "3s" }}
      >
        <BlurredImage src={albumArt} alt={songName} revealed={revealed} />
        {/* Vinyl effect overlay */}
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent z-10" />
        <div className="absolute inset-[30%] rounded-full bg-black/80 z-10" />
        <div className="absolute inset-[45%] rounded-full bg-white/20 z-10" />

        {/* Play button overlay - only shown when album art is blurred */}
        {showPlayer && !revealed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <PlayButton size="large" />
          </div>
        )}
      </motion.div>

      {/* Song info */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">{songName}</h3>
        <p className="text-white/60">{artistName}</p>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {/* Player controls */}
      {showPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm space-y-4"
        >
          {/* Play button centered */}
          <div className="flex justify-center">
            <PlayButton size="large" />
          </div>

          {/* Progress bar */}
          {previewUrl && <ProgressBar />}
        </motion.div>
      )}

      {/* Hint text */}
      <p className="text-white/40 text-xs mt-3 text-center">
        {previewUrl
          ? "30 second preview"
          : "Preview not available for this track"}
      </p>
    </div>
  );
}
