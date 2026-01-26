'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SpotifyLoginButton } from '@/components/spotify/login-button';
import { SpotifyTrack } from '@/lib/game/types';
import { formatArtists } from '@/lib/utils';

interface Stats {
  total: number;
  withDeezerPreviews: number;
  withSpotifyPreviews: number;
  withoutPreviews: number;
}

export default function TestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTracks();
    }
  }, [status]);

  const fetchTracks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test/tracks');
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }
      const data = await response.json();
      setTracks(data.tracks);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = (track: SpotifyTrack) => {
    const previewUrl = track.deezerPreviewUrl;
    
    if (!previewUrl) return;

    if (playingTrackId === track.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingTrackId(null);
    } else {
      // Stop any currently playing track
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Start new track
      const audio = new Audio(previewUrl);
      audio.play();
      audio.onended = () => setPlayingTrackId(null);
      audioRef.current = audio;
      setPlayingTrackId(track.id);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (status === 'loading') {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-white/20 border-t-[#1DB954] rounded-full"
        />
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
        <Card variant="glass" className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Deezer Preview Test</h1>
          <p className="text-white/60 mb-6">
            Sign in with Spotify to test Deezer track previews
          </p>
          <SpotifyLoginButton callbackUrl="/test" className="w-full" />
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Deezer Preview Test
          </h1>
          <p className="text-white/60">
            Click play to hear 30-second previews via Deezer
          </p>
          <p className="text-white/40 text-sm mt-2">
            {tracks.length} tracks loaded
          </p>
        </motion.div>

        {/* Stats Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <Card variant="glass" className="text-center">
            <div className="flex items-center justify-center gap-2 text-[#1DB954]">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
              <span className="font-semibold">Using Deezer Previews</span>
            </div>
            {stats && (
              <div className="flex justify-center gap-6 mt-3 text-sm">
                <div>
                  <span className="text-green-400 font-bold">{stats.withDeezerPreviews}</span>
                  <span className="text-white/50"> with Deezer</span>
                </div>
                <div>
                  <span className="text-yellow-400 font-bold">{stats.withoutPreviews}</span>
                  <span className="text-white/50"> without preview</span>
                </div>
              </div>
            )}
            <p className="text-white/40 text-xs mt-2">
              Tracks mapped via ISRC or search fallback
            </p>
          </Card>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-3 border-white/20 border-t-[#1DB954] rounded-full"
            />
          </div>
        )}

        {/* Track List */}
        {!isLoading && tracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {tracks.map((track, index) => {
              const hasPreview = !!track.deezerPreviewUrl;
              const isPlaying = playingTrackId === track.id;
              
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`rounded-xl bg-white/5 border overflow-hidden transition-colors ${
                    isPlaying
                      ? 'border-[#1DB954] bg-[#1DB954]/5' 
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Track Row */}
                  <div className="w-full flex items-center gap-3 p-3">
                    {/* Rank */}
                    <span className="w-6 text-center text-sm text-white/40 font-mono">
                      {index + 1}
                    </span>

                    {/* Album Art */}
                    <div className="relative w-12 h-12 rounded overflow-hidden shrink-0">
                      {track.album.images[0] && (
                        <Image
                          src={track.album.images[0].url}
                          alt={track.album.name}
                          fill
                          className={`object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
                          style={{ animationDuration: '3s' }}
                        />
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{track.name}</p>
                      <p className="text-sm text-white/60 truncate">
                        {formatArtists(track.artists)}
                      </p>
                    </div>

                    {/* Play Button */}
                    <button
                      onClick={() => togglePlay(track)}
                      disabled={!hasPreview}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                        !hasPreview
                          ? 'bg-white/5 text-white/30 cursor-not-allowed'
                          : isPlaying
                            ? 'bg-[#1DB954] text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Preview status indicator */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      hasPreview ? 'bg-green-400' : 'bg-yellow-400'
                    }`} title={hasPreview ? 'Deezer preview available' : 'No preview available'} />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-col gap-3 items-center">
          <Button onClick={() => router.push('/test/game')} className="w-full max-w-xs">
            Test Game UI
          </Button>
          <Button onClick={() => router.push('/')} variant="secondary" className="w-full max-w-xs">
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  );
}
