'use client';

import { Player } from '@/lib/game/types';
import { Avatar } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ScoreboardProps {
  players: Player[];
  scores: Record<string, number>;
  heartTotals?: Record<string, number>;
  showAnimation?: boolean;
}

export function Scoreboard({ players, scores, heartTotals = {}, showAnimation = true }: ScoreboardProps) {
  // Sort players by score
  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  // Find the "Best Taste" winner - player with most hearts received (must have at least 1)
  const bestTasteWinner = useMemo(() => {
    const playersWithHearts = players.filter(p => (heartTotals[p.id] || 0) > 0);
    if (playersWithHearts.length === 0) return null;
    
    const sorted = [...playersWithHearts].sort(
      (a, b) => (heartTotals[b.id] || 0) - (heartTotals[a.id] || 0)
    );
    
    // Check for ties at the top
    const topHearts = heartTotals[sorted[0].id] || 0;
    const tiedPlayers = sorted.filter(p => (heartTotals[p.id] || 0) === topHearts);
    
    // If there's a tie, no single winner
    if (tiedPlayers.length > 1) return null;
    
    return sorted[0];
  }, [players, heartTotals]);

  return (
    <div className="w-full max-w-md space-y-3">
      {/* Best Taste Award */}
      {bestTasteWinner && (
        <motion.div
          initial={showAnimation ? { opacity: 0, scale: 0.9 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-2 border-pink-500/40"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <motion.svg 
              className="w-6 h-6 text-pink-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </motion.svg>
            <span className="text-pink-400 font-bold text-lg">Best Taste Award</span>
            <motion.svg 
              className="w-6 h-6 text-pink-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </motion.svg>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Avatar src={bestTasteWinner.image} name={bestTasteWinner.name} size="md" />
            <div>
              <span className="text-white font-semibold">{bestTasteWinner.name}</span>
              <div className="flex items-center gap-1 text-pink-400 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>{heartTotals[bestTasteWinner.id]} hearts received</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Score rankings */}
      {sortedPlayers.map((player, index) => {
        const score = scores[player.id] || 0;
        const hearts = heartTotals[player.id] || 0;
        const isFirst = index === 0;
        const isSecond = index === 1;
        const isThird = index === 2;

        return (
          <motion.div
            key={player.id}
            initial={showAnimation ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            className={`flex items-center gap-3 p-4 rounded-2xl ${
              isFirst
                ? 'bg-gradient-to-r from-yellow-500/25 to-yellow-600/15 border-2 border-yellow-500/40'
                : isSecond
                ? 'bg-gradient-to-r from-gray-400/25 to-gray-500/15 border-2 border-gray-400/40'
                : isThird
                ? 'bg-gradient-to-r from-orange-600/25 to-orange-700/15 border-2 border-orange-600/40'
                : 'bg-white/5 border border-white/10'
            }`}
          >
            {/* Rank */}
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xl shrink-0 ${
                isFirst
                  ? 'bg-yellow-500 text-black'
                  : isSecond
                  ? 'bg-gray-400 text-black'
                  : isThird
                  ? 'bg-orange-600 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              {index + 1}
            </div>

            {/* Player info */}
            <Avatar src={player.image} name={player.name} size="lg" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white text-lg block truncate">
                {player.name}
              </span>
              <div className="flex items-center gap-2">
                {isFirst && (
                  <span className="text-yellow-500 text-sm font-medium">Winner!</span>
                )}
                {hearts > 0 && (
                  <span className="flex items-center gap-1 text-pink-400 text-xs">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {hearts}
                  </span>
                )}
              </div>
            </div>

            {/* Score */}
            <motion.div
              initial={showAnimation ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.15 + 0.2 }}
              className="text-right shrink-0"
            >
              <span className="text-3xl font-bold text-[#1DB954]">{score}</span>
              <span className="text-sm text-white/50 ml-1">pts</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
