'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayerList } from '@/components/game/player-list';
import { AudioPlayer } from '@/components/game/audio-player';
import { GuessButtons } from '@/components/game/guess-buttons';
import { Scoreboard } from '@/components/game/scoreboard';
import { ResultsModal } from '@/components/game/results-modal';
import { Player, SpotifyTrack, ROUND_DURATION } from '@/lib/game/types';
import { SpotifyLoginButton } from '@/components/spotify/login-button';
import { formatArtists } from '@/lib/utils';
import { Countdown } from '@/components/game/countdown';

// Scoring constants (same as engine)
const BASE_POINTS = 100;
const POINTS_PER_SECOND_PENALTY = 2;
const MIN_POINTS = BASE_POINTS - (ROUND_DURATION * POINTS_PER_SECOND_PENALTY);

// Mock players for testing (you're always player-1)
const MOCK_PLAYERS: Player[] = [
  {
    id: 'player-1',
    spotifyId: 'spotify-1',
    name: 'You',
    image: null,
    isHost: true,
    isConnected: true,
    topTracks: [],
  },
  {
    id: 'player-2',
    spotifyId: 'spotify-2',
    name: 'Player 2',
    image: null,
    isHost: false,
    isConnected: true,
    topTracks: [],
  },
  {
    id: 'player-3',
    spotifyId: 'spotify-3',
    name: 'Player 3',
    image: null,
    isHost: false,
    isConnected: true,
    topTracks: [],
  },
  {
    id: 'player-4',
    spotifyId: 'spotify-4',
    name: 'Player 4',
    image: null,
    isHost: false,
    isConnected: true,
    topTracks: [],
  },
];

type GameView = 'lobby' | 'playing' | 'results';

export default function TestGamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Tracks from Spotify
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Game state
  const [view, setView] = useState<GameView>('lobby');
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS.slice(0, 2));
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(10);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({
    'player-1': 0,
    'player-2': 0,
    'player-3': 0,
    'player-4': 0,
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [correctPlayerId, setCorrectPlayerId] = useState('player-1');
  const [guessedCount, setGuessedCount] = useState(0);
  const [allGuesses, setAllGuesses] = useState<Record<string, string>>({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({});
  const [resultsModalOpen, setResultsModalOpen] = useState(false);

  const code = 'TEST';

  // Fetch tracks when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      fetchTracks();
    }
  }, [status]);

  const fetchTracks = async () => {
    setIsLoadingTracks(true);
    try {
      const response = await fetch('/api/test/tracks');
      if (!response.ok) throw new Error('Failed to fetch tracks');
      const data = await response.json();
      
      // Only use tracks that have Deezer previews
      const playableTracks = data.tracks.filter((t: SpotifyTrack) => t.deezerPreviewUrl);
      setTracks(playableTracks);
      setTotalRounds(Math.min(10, playableTracks.length));
      
      // Randomly assign first song owner
      setCorrectPlayerId(players[Math.floor(Math.random() * players.length)].id);
    } catch (error) {
      console.error('Failed to fetch tracks:', error);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const currentTrack = tracks[currentTrackIndex];

  // Calculate time-based score
  const calculateScore = (guessTime: number): number => {
    const elapsedMs = guessTime - roundStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const score = BASE_POINTS - (elapsedSeconds * POINTS_PER_SECOND_PENALTY);
    return Math.max(MIN_POINTS, score);
  };

  const handleGuess = (playerId: string) => {
    setSelectedGuess(playerId);
    setHasGuessed(true);
    setGuessedCount((prev) => prev + 1);
  };

  const handleTimerExpired = () => {
    setTimerRunning(false);
    if (!showResults) {
      simulateAllGuessed();
    }
  };

  const simulateAllGuessed = () => {
    const mockGuesses: Record<string, string> = {};
    const newRoundScores: Record<string, number> = {};
    const now = Date.now();
    
    if (selectedGuess) {
      mockGuesses['player-1'] = selectedGuess;
    }
    
    players.forEach((player) => {
      if (player.id !== 'player-1') {
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        mockGuesses[player.id] = randomPlayer.id;
      }
    });
    
    setAllGuesses(mockGuesses);
    setTimerRunning(false);
    setShowResults(true);
    setResultsModalOpen(true);
    
    // Calculate time-based scores
    Object.entries(mockGuesses).forEach(([playerId, guessedId]) => {
      if (guessedId === correctPlayerId) {
        // For player 1 (you), use actual time; for others, randomize
        const guessTime = playerId === 'player-1' ? now : roundStartTime + Math.random() * ROUND_DURATION * 1000;
        const points = calculateScore(guessTime);
        newRoundScores[playerId] = points;
        setScores((prev) => ({
          ...prev,
          [playerId]: (prev[playerId] || 0) + points,
        }));
      } else {
        newRoundScores[playerId] = 0;
      }
    });
    
    // Players who didn't guess get 0
    players.forEach((player) => {
      if (!(player.id in newRoundScores)) {
        newRoundScores[player.id] = 0;
      }
    });
    
    setRoundScores(newRoundScores);
  };

  const nextRound = () => {
    if (currentRound >= totalRounds || currentTrackIndex >= tracks.length - 1) {
      setView('results');
      return;
    }
    setCurrentRound((prev) => prev + 1);
    setCurrentTrackIndex((prev) => prev + 1);
    setSelectedGuess(null);
    setHasGuessed(false);
    setShowResults(false);
    setGuessedCount(0);
    setAllGuesses({});
    setRoundScores({});
    setResultsModalOpen(false);
    setCorrectPlayerId(players[Math.floor(Math.random() * players.length)].id);
    setRoundStartTime(Date.now());
    setTimerRunning(true);
  };

  const resetGame = () => {
    setView('lobby');
    setCurrentRound(1);
    setCurrentTrackIndex(0);
    setSelectedGuess(null);
    setHasGuessed(false);
    setShowResults(false);
    setGuessedCount(0);
    setAllGuesses({});
    setRoundScores({});
    setTimerRunning(false);
    setResultsModalOpen(false);
    setScores({
      'player-1': 0,
      'player-2': 0,
      'player-3': 0,
      'player-4': 0,
    });
    setCorrectPlayerId(players[Math.floor(Math.random() * players.length)].id);
  };

  // Start timer when entering playing view
  useEffect(() => {
    if (view === 'playing' && !timerRunning && !showResults) {
      setRoundStartTime(Date.now());
      setTimerRunning(true);
    }
  }, [view]);

  const addPlayer = () => {
    if (players.length < 4) {
      setPlayers([...players, MOCK_PLAYERS[players.length]]);
    }
  };

  const removePlayer = () => {
    if (players.length > 2) {
      setPlayers(players.slice(0, -1));
    }
  };

  const correctOwner = players.find((p) => p.id === correctPlayerId);

  // Loading state
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

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
        <Card variant="glass" className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Game UI Test</h1>
          <p className="text-white/60 mb-6">
            Sign in with Spotify to test the game with your real tracks
          </p>
          <SpotifyLoginButton callbackUrl="/test/game" className="w-full" />
        </Card>
      </main>
    );
  }

  // Loading tracks
  if (isLoadingTracks) {
    return (
      <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-white/20 border-t-[#1DB954] rounded-full mb-4"
        />
        <p className="text-white/60">Loading your tracks with Deezer previews...</p>
        <p className="text-white/40 text-sm mt-2">This may take a moment</p>
      </main>
    );
  }

  // No playable tracks
  if (tracks.length === 0 && !isLoadingTracks) {
    return (
      <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
        <Card variant="glass" className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Playable Tracks</h1>
          <p className="text-white/60 mb-6">
            Could not find Deezer previews for your Spotify tracks. Try refreshing.
          </p>
          <Button onClick={fetchTracks} className="w-full">
            Retry
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] gradient-bg flex flex-col">
      {/* Debug Controls - Fixed at top */}
      <div className="shrink-0 bg-black/80 border-b border-white/10 p-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60 font-mono">DEBUG MODE - {tracks.length} tracks</span>
            <div className="flex gap-1">
              <button
                onClick={() => setView('lobby')}
                className={`px-2 py-1 text-xs rounded ${view === 'lobby' ? 'bg-[#1DB954] text-black' : 'bg-white/10 text-white'}`}
              >
                Lobby
              </button>
              <button
                onClick={() => setView('playing')}
                className={`px-2 py-1 text-xs rounded ${view === 'playing' ? 'bg-[#1DB954] text-black' : 'bg-white/10 text-white'}`}
              >
                Playing
              </button>
              <button
                onClick={() => setView('results')}
                className={`px-2 py-1 text-xs rounded ${view === 'results' ? 'bg-[#1DB954] text-black' : 'bg-white/10 text-white'}`}
              >
                Results
              </button>
            </div>
          </div>
          
          {view === 'lobby' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Players: {players.length}</span>
              <button
                onClick={removePlayer}
                disabled={players.length <= 2}
                className="w-6 h-6 rounded bg-white/10 text-white text-sm disabled:opacity-30"
              >
                -
              </button>
              <button
                onClick={addPlayer}
                disabled={players.length >= 4}
                className="w-6 h-6 rounded bg-white/10 text-white text-sm disabled:opacity-30"
              >
                +
              </button>
            </div>
          )}
          
          {view === 'playing' && (
            <div className="flex flex-wrap items-center gap-2">
              {!hasGuessed && (
                <span className="text-xs text-yellow-400">Tap a player to guess</span>
              )}
              {hasGuessed && !showResults && (
                <button
                  onClick={simulateAllGuessed}
                  className="px-2 py-1 text-xs rounded bg-blue-500 text-white"
                >
                  Simulate All Guessed
                </button>
              )}
              {showResults && (
                <button
                  onClick={nextRound}
                  className="px-2 py-1 text-xs rounded bg-green-500 text-white"
                >
                  {currentRound >= totalRounds ? 'End Game' : 'Next Round'}
                </button>
              )}
              <button
                onClick={resetGame}
                className="px-2 py-1 text-xs rounded bg-white/10 text-white"
              >
                Reset
              </button>
            </div>
          )}
          
          {view === 'results' && (
            <button
              onClick={resetGame}
              className="px-2 py-1 text-xs rounded bg-white/10 text-white"
            >
              Play Again
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Lobby View */}
        {view === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-white/60 text-sm">Game Code:</span>
                <span className="text-2xl font-mono font-bold text-[#1DB954] tracking-wider">
                  {code}
                </span>
              </div>
            </motion.div>

            <Card variant="glass" className="w-full max-w-md">
              <h2 className="text-xl font-semibold text-white mb-1">
                Waiting for Players
              </h2>
              <p className="text-white/60 text-sm mb-4">
                Using your real Spotify tracks with Deezer previews
              </p>

              <PlayerList
                players={players}
                currentPlayerId="player-1"
              />

              <div className="mt-6">
                <Button
                  onClick={() => setView('playing')}
                  disabled={players.length < 2}
                  className="w-full"
                  size="lg"
                >
                  Start Game ({totalRounds} rounds)
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Playing View */}
        {view === 'playing' && currentTrack && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Top Bar - Game code + Round info */}
            <div className="shrink-0 px-4 pt-3 pb-2">
              <div className="flex items-center justify-center gap-3">
                <span className="text-[#1DB954] font-mono font-bold text-lg">{code}</span>
                <span className="text-white/30">•</span>
                <span className="text-white/70 font-medium">
                  Round {currentRound}/{totalRounds}
                </span>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col items-center max-w-md mx-auto">
                {/* Timer bar above album art */}
                {!showResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full mb-4"
                  >
                    <Countdown
                      key={currentRound}
                      seconds={ROUND_DURATION}
                      onComplete={handleTimerExpired}
                      isRunning={timerRunning}
                      variant="bar"
                    />
                  </motion.div>
                )}

                {/* Audio Player with Deezer preview */}
                <div className="w-full mb-4">
                  <AudioPlayer
                    trackId={currentTrack.id}
                    albumArt={currentTrack.album.images[0]?.url || '/placeholder.png'}
                    songName={showResults ? currentTrack.name : '🎵 Listen up...'}
                    artistName={showResults ? formatArtists(currentTrack.artists) : 'Can you guess?'}
                    previewUrl={currentTrack.deezerPreviewUrl}
                    revealed={showResults}
                    compact
                  />
                </div>

                {/* Song owner reveal (brief inline indicator) */}
                {showResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 py-3 px-4 rounded-xl bg-white/5 border border-white/10 w-full text-center"
                  >
                    <p className="text-white/60 text-sm">This was</p>
                    <p className="text-xl font-bold text-[#1DB954]">
                      {correctOwner?.name}&apos;s song!
                    </p>
                    {selectedGuess === correctPlayerId ? (
                      <p className="text-green-400 text-sm mt-1">
                        You got it right! +{roundScores['player-1'] || 0} pts
                      </p>
                    ) : hasGuessed ? (
                      <p className="text-red-400 text-sm mt-1">Better luck next time!</p>
                    ) : (
                      <p className="text-white/50 text-sm mt-1">Time ran out!</p>
                    )}
                  </motion.div>
                )}

                {/* Status text */}
                <p className="text-center text-white/60 text-sm mb-3">
                  {hasGuessed
                    ? showResults
                      ? 'Next round starting soon...'
                      : `Waiting for others... (${guessedCount}/${players.length})`
                    : 'Whose song is this?'}
                </p>

                {/* Guess buttons */}
                <div className="w-full">
                  <GuessButtons
                    players={players}
                    onGuess={handleGuess}
                    selectedPlayerId={selectedGuess}
                    correctPlayerId={showResults ? correctPlayerId : null}
                    disabled={hasGuessed}
                    showResults={showResults}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results View */}
        {view === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center p-4 overflow-y-auto"
          >
            <div className="text-center mb-6 mt-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-5xl mb-3"
              >
                🏆
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-1">Game Over!</h2>
              <p className="text-white/60 text-sm">Final Scores</p>
            </div>

            <div className="w-full max-w-md">
              <Scoreboard
                players={players}
                scores={scores}
              />

              <div className="mt-6 pb-4 space-y-3">
                <Button onClick={resetGame} className="w-full" size="lg">
                  Play Again
                </Button>
                <Button onClick={() => router.push('/test')} variant="secondary" className="w-full">
                  Back to Track List
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Modal - shows who guessed what */}
      <ResultsModal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        songOwnerName={correctOwner?.name || 'Unknown'}
        songOwnerId={correctPlayerId}
        players={players}
        guesses={allGuesses}
        roundScores={roundScores}
        totalScores={scores}
        currentPlayerId="player-1"
        selectedGuess={selectedGuess}
        hasGuessed={hasGuessed}
      />
    </main>
  );
}
