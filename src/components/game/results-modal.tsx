'use client';

import { Player } from '@/lib/game/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo } from 'react';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songOwnerName: string;
  songOwnerId: string;
  players: Player[];
  guesses: Record<string, string>;
  roundScores: Record<string, number>;
  totalScores: Record<string, number>;
  currentPlayerId: string;
  selectedGuess: string | null;
  hasGuessed: boolean;
}

export function ResultsModal({
  isOpen,
  onClose,
  songOwnerName,
  songOwnerId,
  players,
  guesses,
  roundScores,
  totalScores,
  currentPlayerId,
  selectedGuess,
  hasGuessed,
}: ResultsModalProps) {
  // Auto-close after 5 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const currentPlayerPoints = roundScores[currentPlayerId] || 0;
  const isCorrect = selectedGuess === songOwnerId;

  // Sort players by total score (rank order)
  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0));
  }, [players, totalScores]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm max-h-[80vh] overflow-y-auto bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl shadow-2xl"
          >
            {/* Header - Song owner reveal */}
            <div className="sticky top-0 bg-gradient-to-b from-zinc-900 to-zinc-900/95 p-4 pb-3 border-b border-white/10">
              <p className="text-white/60 text-sm text-center">This was</p>
              <p className="text-2xl font-bold text-[#1DB954] text-center">
                {songOwnerName}&apos;s song!
              </p>
              
              {/* Your result */}
              <div className="mt-2 text-center">
                {isCorrect ? (
                  <p className="text-green-400 text-sm font-medium">
                    You got it right! +{currentPlayerPoints} pts
                  </p>
                ) : hasGuessed ? (
                  <p className="text-red-400 text-sm">Better luck next time!</p>
                ) : (
                  <p className="text-white/50 text-sm">Time ran out!</p>
                )}
              </div>
            </div>

            {/* Scores by rank */}
            <div className="p-4 pt-3">
              <p className="text-white/50 text-xs mb-3 text-center uppercase tracking-wider">
                Standings
              </p>
              
              <div className="space-y-2">
                {rankedPlayers.map((player, index) => {
                  const guessedId = guesses[player.id];
                  const guessedPlayer = guessedId 
                    ? players.find((p) => p.id === guessedId) 
                    : null;
                  const playerIsCorrect = guessedId === songOwnerId;
                  const isYou = player.id === currentPlayerId;
                  const playerRoundPoints = roundScores[player.id] || 0;
                  const playerTotalPoints = totalScores[player.id] || 0;
                  const didGuess = !!guessedId;
                  const rank = index + 1;

                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${
                        isYou 
                          ? 'bg-white/10 border border-white/20' 
                          : 'bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <span className={`w-5 text-center font-bold ${
                        rank === 1 ? 'text-yellow-400' : 
                        rank === 2 ? 'text-gray-300' : 
                        rank === 3 ? 'text-amber-600' : 'text-white/40'
                      }`}>
                        {rank}
                      </span>
                      
                      {/* Name */}
                      <span className={`flex-1 font-medium truncate ${isYou ? 'text-white' : 'text-white/80'}`}>
                        {isYou ? 'You' : player.name.split(' ')[0]}
                      </span>
                      
                      {/* Guess result */}
                      <div className="flex items-center gap-1.5">
                        {didGuess ? (
                          <>
                            <span className="text-white/40 text-xs">→</span>
                            <span className={`text-xs ${playerIsCorrect ? 'text-green-400' : 'text-white/50'}`}>
                              {guessedPlayer?.name.split(' ')[0] || '?'}
                            </span>
                            {playerIsCorrect ? (
                              <span className="text-green-400 text-xs font-medium">+{playerRoundPoints}</span>
                            ) : (
                              <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </>
                        ) : (
                          <span className="text-white/30 italic text-xs">—</span>
                        )}
                      </div>
                      
                      {/* Total score */}
                      <span className={`font-bold min-w-[40px] text-right ${
                        rank === 1 ? 'text-[#1DB954]' : 'text-white/70'
                      }`}>
                        {playerTotalPoints}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Tap to dismiss hint */}
            <div className="px-4 pb-4 pt-2">
              <p className="text-white/30 text-xs text-center">Tap anywhere to dismiss</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
