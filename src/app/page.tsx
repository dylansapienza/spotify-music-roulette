'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { ProfileFinder } from '@/components/spotify/profile-finder';
import { PlaylistSelector } from '@/components/spotify/playlist-selector';
import { SpotifyUserSearchResult, PlaylistSelection, RoundCount, ROUND_OPTIONS } from '@/lib/game/types';

type Mode = 'home' | 'setup' | 'create' | 'join';
type SetupStep = 'name' | 'profile' | 'playlists';

interface LoadingProgress {
  completed: number;
  total: number;
  message?: string;
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('home');
  const [setupStep, setSetupStep] = useState<SetupStep>('name');
  const [gameCode, setGameCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalRounds, setTotalRounds] = useState<RoundCount>(10);

  // Player setup state
  const [playerName, setPlayerName] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<SpotifyUserSearchResult | null>(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState<PlaylistSelection[]>([]);
  const [isJoining, setIsJoining] = useState(false); // Track if we're joining vs creating
  const [playlistsValid, setPlaylistsValid] = useState(false);
  const [totalTrackCount, setTotalTrackCount] = useState(0);

  const MIN_REQUIRED_TRACKS = 25;

  const isSetupComplete = playerName.trim() && selectedProfile && selectedPlaylists.length > 0 && playlistsValid;

  const handleStartSetup = (joining: boolean) => {
    setIsJoining(joining);
    setMode('setup');
    setSetupStep('name');
    setError(null);
  };

  const handleNextStep = () => {
    if (setupStep === 'name') {
      if (!playerName.trim()) {
        setError('Please enter your name');
        return;
      }
      setError(null);
      setSetupStep('profile');
    } else if (setupStep === 'profile') {
      if (!selectedProfile) {
        setError('Please select your Spotify profile');
        return;
      }
      setError(null);
      setSetupStep('playlists');
    }
  };

  const handleBackStep = () => {
    setError(null);
    if (setupStep === 'playlists') {
      setSetupStep('profile');
    } else if (setupStep === 'profile') {
      setSetupStep('name');
    } else {
      setMode('home');
      // Reset state
      setPlayerName('');
      setSelectedProfile(null);
      setSelectedPlaylists([]);
    }
  };

  const handleContinueToGame = () => {
    if (!isSetupComplete) return;
    setError(null);
    setMode(isJoining ? 'join' : 'create');
  };

  const handleCreateGame = async () => {
    if (!isSetupComplete) return;
    setIsLoading(true);
    setLoadingProgress(null);
    setError(null);

    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: playerName,
          hostSpotifyId: selectedProfile!.id,
          hostImage: selectedProfile!.images?.[0]?.url || null,
          selectedPlaylists,
          totalRounds,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'progress') {
              setLoadingProgress({ completed: data.completed, total: data.total });
            } else if (data.type === 'status') {
              setLoadingProgress((prev) => ({ ...prev, completed: 0, total: 0, message: data.message }));
            } else if (data.type === 'error') {
              throw new Error(data.error);
            } else if (data.type === 'complete') {
              // Store player info in localStorage for the game page
              localStorage.setItem(
                'musicRoulette_player',
                JSON.stringify({
                  id: data.gameState.players[0].id,
                  name: playerName,
                  spotifyId: selectedProfile!.id,
                  image: selectedProfile!.images?.[0]?.url || null,
                  isHost: true,
                })
              );
              router.push(`/game/${data.code}`);
              return;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  };

  const handleJoinGame = async () => {
    if (!isSetupComplete || !gameCode.trim()) return;
    setIsLoading(true);
    setLoadingProgress(null);
    setError(null);

    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: gameCode.toUpperCase(),
          playerName: playerName,
          playerSpotifyId: selectedProfile!.id,
          playerImage: selectedProfile!.images?.[0]?.url || null,
          selectedPlaylists,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to read response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'progress') {
              setLoadingProgress({ completed: data.completed, total: data.total });
            } else if (data.type === 'status') {
              setLoadingProgress((prev) => ({ ...prev, completed: 0, total: 0, message: data.message }));
            } else if (data.type === 'error') {
              throw new Error(data.error);
            } else if (data.type === 'complete') {
              // Find the current player in the game state
              const currentPlayer = data.gameState.players.find(
                (p: { spotifyId: string }) => p.spotifyId === selectedProfile!.id
              );

              // Store player info
              localStorage.setItem(
                'musicRoulette_player',
                JSON.stringify({
                  id: currentPlayer.id,
                  name: playerName,
                  spotifyId: selectedProfile!.id,
                  image: selectedProfile!.images?.[0]?.url || null,
                  isHost: false,
                })
              );
              router.push(`/game/${gameCode.toUpperCase()}`);
              return;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
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

        {/* Show player info if setup is complete */}
        {isSetupComplete && mode !== 'home' && mode !== 'setup' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 mb-6 p-3 bg-white/5 rounded-xl"
          >
            <Avatar
              src={selectedProfile?.images?.[0]?.url}
              name={playerName}
              size="sm"
            />
            <span className="text-white/80">
              Playing as <span className="font-semibold text-white">{playerName}</span>
            </span>
          </motion.div>
        )}

        {/* Main content */}
        <AnimatePresence mode="wait">
          {mode === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <Button
                onClick={() => handleStartSetup(false)}
                className="w-full"
                size="lg"
              >
                Create Game
              </Button>
              <Button
                onClick={() => handleStartSetup(true)}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                Join Game
              </Button>
            </motion.div>
          ) : mode === 'setup' ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card variant="glass">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  {['name', 'profile', 'playlists'].map((step, idx) => (
                    <div
                      key={step}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        ['name', 'profile', 'playlists'].indexOf(setupStep) >= idx
                          ? 'bg-[#1DB954]'
                          : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                {setupStep === 'name' && (
                  <>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      What&apos;s your name?
                    </h2>
                    <p className="text-white/60 mb-4">
                      This is how other players will see you
                    </p>
                    <Input
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="mb-4"
                      autoFocus
                    />
                  </>
                )}

                {setupStep === 'profile' && (
                  <>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Find your Spotify profile
                    </h2>
                    <p className="text-white/60 mb-4">
                      Search for your Spotify username to link your music
                    </p>
                    <ProfileFinder
                      onProfileSelect={setSelectedProfile}
                      selectedProfile={selectedProfile}
                    />
                  </>
                )}

                {setupStep === 'playlists' && selectedProfile && (
                  <>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Choose your playlists
                    </h2>
                    <p className="text-white/60 mb-4">
                      Select 1-5 public playlists for the game
                    </p>
                    <PlaylistSelector
                      userId={selectedProfile.id}
                      selectedPlaylists={selectedPlaylists}
                      onPlaylistsChange={setSelectedPlaylists}
                      maxPlaylists={5}
                      minTotalTracks={MIN_REQUIRED_TRACKS}
                      onValidationChange={(isValid, totalTracks) => {
                        setPlaylistsValid(isValid);
                        setTotalTrackCount(totalTracks);
                      }}
                    />
                  </>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  {setupStep === 'playlists' ? (
                    <Button
                      onClick={handleContinueToGame}
                      disabled={selectedPlaylists.length === 0 || !playlistsValid}
                      className="w-full"
                      size="lg"
                    >
                      {selectedPlaylists.length === 0
                        ? 'Select at least 1 playlist'
                        : !playlistsValid
                          ? `Need ${MIN_REQUIRED_TRACKS - totalTrackCount} more tracks`
                          : 'Continue'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNextStep}
                      disabled={
                        (setupStep === 'name' && !playerName.trim()) ||
                        (setupStep === 'profile' && !selectedProfile)
                      }
                      className="w-full"
                      size="lg"
                    >
                      Next
                    </Button>
                  )}
                  <Button
                    onClick={handleBackStep}
                    variant="ghost"
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </Card>
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
                  Game Settings
                </h2>
                <p className="text-white/60 mb-4">
                  Choose how many rounds to play
                </p>

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

                {/* Loading Progress Bar */}
                {isLoading && loadingProgress && (
                  <div className="mb-4 p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">
                        {loadingProgress.message || 'Loading songs...'}
                      </span>
                      {loadingProgress.total > 0 && (
                        <span className="text-sm text-white/60">
                          {loadingProgress.completed}/{loadingProgress.total}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#1DB954] rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: loadingProgress.total > 0
                            ? `${(loadingProgress.completed / loadingProgress.total) * 100}%`
                            : '0%',
                        }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Button
                    onClick={handleCreateGame}
                    isLoading={isLoading}
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? 'Creating Game...' : 'Create Game'}
                  </Button>
                  <Button
                    onClick={() => {
                      setMode('setup');
                      setSetupStep('playlists');
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

                {/* Loading Progress Bar */}
                {isLoading && loadingProgress && (
                  <div className="mb-4 p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">
                        {loadingProgress.message || 'Loading songs...'}
                      </span>
                      {loadingProgress.total > 0 && (
                        <span className="text-sm text-white/60">
                          {loadingProgress.completed}/{loadingProgress.total}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#1DB954] rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: loadingProgress.total > 0
                            ? `${(loadingProgress.completed / loadingProgress.total) * 100}%`
                            : '0%',
                        }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
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
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleJoinGame}
                    isLoading={isLoading}
                    disabled={gameCode.length !== 4 || isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? 'Joining Game...' : 'Join Game'}
                  </Button>
                  <Button
                    onClick={() => {
                      setMode('setup');
                      setSetupStep('playlists');
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
          <p>Find your Spotify profile, select playlists,</p>
          <p>and guess whose music is playing!</p>
        </motion.div>
      </motion.div>
    </main>
  );
}
