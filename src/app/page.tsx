'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { SpotifyLoginButton } from '@/components/spotify/login-button';
import { Avatar } from '@/components/ui/avatar';
import { TimeRange, TIME_RANGE_LABELS, RoundCount, ROUND_OPTIONS } from '@/lib/game/types';

type Mode = 'home' | 'create' | 'join';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('home');
  const [gameCode, setGameCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('medium_term');
  const [totalRounds, setTotalRounds] = useState<RoundCount>(10);

  const isAuthenticated = status === 'authenticated' && session;

  const handleCreateGame = async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: session.user?.name || 'Player',
          hostSpotifyId: session.spotifyId,
          hostImage: session.user?.image || null,
          accessToken: session.accessToken,
          timeRange,
          totalRounds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game');
      }

      // Store player info in localStorage for the game page
      localStorage.setItem(
        'musicRoulette_player',
        JSON.stringify({
          id: data.gameState.players[0].id,
          name: session.user?.name,
          spotifyId: session.spotifyId,
          image: session.user?.image,
          isHost: true,
        })
      );

      router.push(`/game/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!session || !gameCode.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: gameCode.toUpperCase(),
          playerName: session.user?.name || 'Player',
          playerSpotifyId: session.spotifyId,
          playerImage: session.user?.image || null,
          accessToken: session.accessToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game');
      }

      // Find the current player in the game state
      const currentPlayer = data.gameState.players.find(
        (p: { spotifyId: string }) => p.spotifyId === session.spotifyId
      );

      // Store player info
      localStorage.setItem(
        'musicRoulette_player',
        JSON.stringify({
          id: currentPlayer.id,
          name: session.user?.name,
          spotifyId: session.spotifyId,
          image: session.user?.image,
          isHost: false,
        })
      );

      router.push(`/game/${gameCode.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo and title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#1DB954] flex items-center justify-center glow"
          >
            <svg
              className="w-14 h-14 text-black"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">Music Roulette</h1>
          <p className="text-white/60">Guess whose song is playing!</p>
        </div>

        {/* User info if logged in */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 mb-6 p-3 bg-white/5 rounded-xl"
          >
            <Avatar
              src={session.user?.image}
              name={session.user?.name || 'Player'}
              size="sm"
            />
            <span className="text-white/80">
              Playing as <span className="font-semibold text-white">{session.user?.name}</span>
            </span>
          </motion.div>
        )}

        {/* Main content */}
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card variant="glass" className="text-center">
                <p className="text-white/70 mb-6">
                  Connect your Spotify account to start playing with friends
                </p>
                <SpotifyLoginButton className="w-full" />
              </Card>
            </motion.div>
          ) : mode === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <Button
                onClick={() => setMode('create')}
                className="w-full"
                size="lg"
              >
                Create Game
              </Button>
              <Button
                onClick={() => setMode('join')}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                Join Game
              </Button>
            </motion.div>
          ) : mode === 'create' ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card variant="glass">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Create a New Game
                </h2>
                <p className="text-white/60 mb-4">
                  Start a game and share the code with your friends
                </p>
                
                {/* Time Range Selector */}
                <div className="mb-4">
                  <label className="block text-sm text-white/60 mb-2">
                    Music from:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          timeRange === range
                            ? 'bg-[#1DB954] text-black'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {TIME_RANGE_LABELS[range]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Rounds Selector */}
                <div className="mb-6">
                  <label className="block text-sm text-white/60 mb-2">
                    Number of songs:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ROUND_OPTIONS.map((count) => (
                      <button
                        key={count}
                        onClick={() => setTotalRounds(count)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          totalRounds === count
                            ? 'bg-[#1DB954] text-black'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <Button
                    onClick={handleCreateGame}
                    isLoading={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    Create Game
                  </Button>
                  <Button
                    onClick={() => {
                      setMode('home');
                      setError(null);
                    }}
                    variant="ghost"
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card variant="glass">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Join a Game
                </h2>
                <p className="text-white/60 mb-6">
                  Enter the 4-letter code from your friend
                </p>
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <Input
                    placeholder="ABCD"
                    value={gameCode}
                    onChange={(e) =>
                      setGameCode(e.target.value.toUpperCase().slice(0, 4))
                    }
                    className="text-center text-2xl tracking-[0.5em] font-mono uppercase"
                    maxLength={4}
                  />
                  <Button
                    onClick={handleJoinGame}
                    isLoading={isLoading}
                    disabled={gameCode.length !== 4}
                    className="w-full"
                    size="lg"
                  >
                    Join Game
                  </Button>
                  <Button
                    onClick={() => {
                      setMode('home');
                      setError(null);
                      setGameCode('');
                    }}
                    variant="ghost"
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How to play */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-white/40 text-sm"
        >
          <p>Connect Spotify, create or join a game,</p>
          <p>and guess whose music is playing!</p>
        </motion.div>
      </motion.div>
    </main>
  );
}
