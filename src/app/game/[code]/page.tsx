'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { PresenceChannel } from 'pusher-js';
import { subscribeToGame, unsubscribeFromGame } from '@/lib/pusher/client';
import { GAME_EVENTS } from '@/lib/constants';
import { GameState, Player, Round, ROUND_DURATION } from '@/lib/game/types';
import { Countdown } from '@/components/game/countdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayerList } from '@/components/game/player-list';
import { AudioPlayer } from '@/components/game/audio-player';
import { GuessButtons } from '@/components/game/guess-buttons';
import { Scoreboard } from '@/components/game/scoreboard';
import { ResultsModal } from '@/components/game/results-modal';
import { formatArtists } from '@/lib/utils';

interface LocalPlayer {
  id: string;
  name: string;
  spotifyId: string;
  image: string | null;
  isHost: boolean;
}

interface RoundData {
  number: number;
  song: {
    track: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: { images: { url: string }[] };
      preview_url?: string | null;
      deezerPreviewUrl?: string | null;
      external_urls?: { spotify: string };
    };
    ownerId: string | null;
    ownerName: string | null;
  };
  guesses: Record<string, string>;
  guessTimestamps?: Record<string, number>;
  status: string;
  startedAt?: number;
}

type GameView = 'loading' | 'lobby' | 'playing' | 'results';

export default function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  
  const [view, setView] = useState<GameView>('loading');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<LocalPlayer | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundData | null>(null);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessedPlayers, setGuessedPlayers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [hasHeartedThisRound, setHasHeartedThisRound] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const [heartTotals, setHeartTotals] = useState<Record<string, number>>({});

  // Load player info from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('musicRoulette_player');
    if (stored) {
      setCurrentPlayer(JSON.parse(stored));
    } else {
      router.push('/');
    }
  }, [router]);

  // Fetch initial game state
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/game/${code}`);
        if (!response.ok) {
          throw new Error('Game not found');
        }
        const data = await response.json();
        setGameState(data);
        
        if (data.status === 'lobby') {
          setView('lobby');
        } else if (data.status === 'playing') {
          setView('playing');
        } else if (data.status === 'finished') {
          setView('results');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game');
      }
    };

    if (code && currentPlayer) {
      fetchGame();
    }
  }, [code, currentPlayer]);

  // Subscribe to Pusher channel
  useEffect(() => {
    if (!code || !currentPlayer) return;

    let channel: PresenceChannel;
    
    try {
      channel = subscribeToGame(code, currentPlayer.id, currentPlayer.name);

      channel.bind(GAME_EVENTS.PLAYER_JOINED, (data: { player: Player }) => {
        setGameState((prev) => {
          if (!prev) return prev;
          const existingIndex = prev.players.findIndex(
            (p) => p.spotifyId === data.player.spotifyId
          );
          if (existingIndex >= 0) {
            const newPlayers = [...prev.players];
            newPlayers[existingIndex] = data.player;
            return { ...prev, players: newPlayers };
          }
          return {
            ...prev,
            players: [...prev.players, data.player],
            scores: { ...prev.scores, [data.player.id]: 0 },
          };
        });
      });

      channel.bind(GAME_EVENTS.PLAYER_LEFT, (data: { playerId: string }) => {
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === data.playerId ? { ...p, isConnected: false } : p
            ),
          };
        });
      });

      channel.bind(GAME_EVENTS.GAME_STARTED, (data: { gameState: GameState }) => {
        setGameState(data.gameState);
        setView('playing');
      });

      channel.bind(GAME_EVENTS.ROUND_START, (data: { round: RoundData }) => {
        setCurrentRound(data.round);
        setSelectedGuess(null);
        setHasGuessed(false);
        setGuessedPlayers([]);
        setShowResults(false);
        setRoundScores({});
        setTimerRunning(true);
        setResultsModalOpen(false);
        setHasHeartedThisRound(false);
        setHeartCount(0);
      });

      channel.bind(GAME_EVENTS.PLAYER_GUESSED, (data: { playerId: string }) => {
        setGuessedPlayers((prev) => [...prev, data.playerId]);
      });

      channel.bind(GAME_EVENTS.PLAYER_HEARTED, (data: { playerId: string; visibleHeartCount: number }) => {
        setHeartCount(data.visibleHeartCount);
      });

      channel.bind(GAME_EVENTS.ROUND_END, (data: { round: Round & { hearts?: string[] }; scores: Record<string, number>; roundScores: Record<string, number>; heartTotals?: Record<string, number> }) => {
        setTimerRunning(false);
        setCurrentRound((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            guesses: data.round.guesses, // Include all guesses for showing results
            guessTimestamps: data.round.guessTimestamps,
            song: {
              ...prev.song,
              ownerId: data.round.song.ownerId,
              ownerName: data.round.song.ownerName,
            },
          };
        });
        setGameState((prev) => {
          if (!prev) return prev;
          return { ...prev, scores: data.scores };
        });
        setRoundScores(data.roundScores || {});
        setHeartCount(data.round.hearts?.length || 0);
        if (data.heartTotals) {
          setHeartTotals(data.heartTotals);
        }
        setShowResults(true);
        setResultsModalOpen(true);
      });

      channel.bind(GAME_EVENTS.TIMER_EXPIRED, () => {
        setTimerRunning(false);
      });

      channel.bind(GAME_EVENTS.GAME_OVER, (data: { finalScores: Record<string, number>; heartTotals?: Record<string, number> }) => {
        setGameState((prev) => {
          if (!prev) return prev;
          return { ...prev, scores: data.finalScores, status: 'finished' };
        });
        if (data.heartTotals) {
          setHeartTotals(data.heartTotals);
        }
        setView('results');
      });
    } catch (err) {
      console.error('Pusher subscription error:', err);
    }

    return () => {
      unsubscribeFromGame(code);
    };
  }, [code, currentPlayer]);

  const handleStartGame = useCallback(async () => {
    if (!currentPlayer || !gameState) return;
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: gameState.code,
          hostId: currentPlayer.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start game');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setIsStarting(false);
    }
  }, [currentPlayer, gameState]);

  const handleGuess = useCallback(
    async (playerId: string) => {
      if (!currentPlayer || hasGuessed || !gameState) return;
      setSelectedGuess(playerId);
      setHasGuessed(true);

      try {
        await fetch('/api/game/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: gameState.code,
            playerId: currentPlayer.id,
            guessedPlayerId: playerId,
          }),
        });
      } catch (err) {
        console.error('Failed to submit guess:', err);
      }
    },
    [currentPlayer, hasGuessed, gameState]
  );

  const handleTimerExpired = useCallback(async () => {
    if (!gameState || !currentRound || showResults) return;
    
    setTimerRunning(false);
    
    // Only the host triggers the timer expiry API to avoid race conditions
    if (currentPlayer?.isHost) {
      try {
        await fetch('/api/game/timer-expired', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: gameState.code,
            roundNumber: currentRound.number,
          }),
        });
      } catch (err) {
        console.error('Failed to handle timer expiry:', err);
      }
    }
  }, [gameState, currentRound, currentPlayer, showResults]);

  const handleHeart = useCallback(async () => {
    if (!currentPlayer || !gameState || hasHeartedThisRound) return;
    
    setHasHeartedThisRound(true);
    
    try {
      const response = await fetch('/api/game/heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: gameState.code,
          playerId: currentPlayer.id,
        }),
      });
      
      if (!response.ok) {
        // Revert on error
        setHasHeartedThisRound(false);
      }
    } catch (err) {
      console.error('Failed to submit heart:', err);
      setHasHeartedThisRound(false);
    }
  }, [currentPlayer, gameState, hasHeartedThisRound]);

  const handlePlayAgain = () => {
    router.push('/');
  };

  if (view === 'loading' || !gameState) {
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

  return (
    <main className="min-h-[100dvh] gradient-bg flex flex-col">
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
            {/* Header */}
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
                Share the game code with your friends
              </p>

              <PlayerList
                players={gameState.players}
                currentPlayerId={currentPlayer?.id}
              />

              {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {currentPlayer?.isHost && (
                <div className="mt-6">
                  <Button
                    onClick={handleStartGame}
                    isLoading={isStarting}
                    disabled={gameState.players.filter((p) => p.isConnected).length < 2}
                    className="w-full"
                    size="lg"
                  >
                    Start Game
                  </Button>
                  {gameState.players.filter((p) => p.isConnected).length < 2 && (
                    <p className="text-white/50 text-sm text-center mt-2">
                      Need at least 2 players to start
                    </p>
                  )}
                </div>
              )}

              {!currentPlayer?.isHost && (
                <div className="mt-6 text-center text-white/60">
                  <p>Waiting for the host to start the game...</p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Playing View - Mobile-optimized */}
        {view === 'playing' && currentRound && (
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
                  Round {currentRound.number}/{gameState.totalRounds}
                </span>
              </div>
            </div>

            {/* Main content area - scrollable */}
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
                      key={currentRound.number}
                      seconds={ROUND_DURATION}
                      onComplete={handleTimerExpired}
                      isRunning={timerRunning}
                      variant="bar"
                    />
                  </motion.div>
                )}

                {/* Audio Player - Compact */}
                <div className="w-full mb-4">
                  <AudioPlayer
                    trackId={currentRound.song.track.id}
                    albumArt={currentRound.song.track.album.images[0]?.url || '/placeholder.png'}
                    songName={showResults ? currentRound.song.track.name : '🎵 Listen up...'}
                    artistName={showResults ? formatArtists(currentRound.song.track.artists) : 'Can you guess?'}
                    previewUrl={currentRound.song.track.deezerPreviewUrl}
                    revealed={showResults}
                    compact
                    onHeart={handleHeart}
                    hasHearted={hasHeartedThisRound}
                    isOwnSong={currentRound.song.ownerId === currentPlayer?.id}
                    heartCount={heartCount}
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
                      {currentRound.song.ownerName}&apos;s song!
                    </p>
                    {selectedGuess === currentRound.song.ownerId ? (
                      <p className="text-green-400 text-sm mt-1">
                        You got it right! +{roundScores[currentPlayer?.id || ''] || 0} pts
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
                      : `Waiting for others... (${guessedPlayers.length}/${gameState.players.filter((p) => p.isConnected).length})`
                    : 'Whose song is this?'}
                </p>

                {/* Guess buttons */}
                <div className="w-full">
                  <GuessButtons
                    players={gameState.players.filter((p) => p.isConnected)}
                    onGuess={handleGuess}
                    selectedPlayerId={selectedGuess}
                    correctPlayerId={showResults ? currentRound.song.ownerId : null}
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
                players={gameState.players}
                scores={gameState.scores}
                heartTotals={heartTotals}
              />

              <div className="mt-6 pb-4">
                <Button onClick={handlePlayAgain} className="w-full" size="lg">
                  Play Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Modal - shows who guessed what */}
      {currentRound && (
        <ResultsModal
          isOpen={resultsModalOpen}
          onClose={() => setResultsModalOpen(false)}
          songOwnerName={currentRound.song.ownerName || 'Unknown'}
          songOwnerId={currentRound.song.ownerId || ''}
          players={gameState.players.filter((p) => p.isConnected)}
          guesses={currentRound.guesses || {}}
          roundScores={roundScores}
          totalScores={gameState.scores}
          currentPlayerId={currentPlayer?.id || ''}
          selectedGuess={selectedGuess}
          hasGuessed={hasGuessed}
          roundHearts={heartCount}
        />
      )}
    </main>
  );
}
