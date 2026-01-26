'use client';

import { Player } from '@/lib/game/types';
import { Avatar } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

interface ScoreboardProps {
  players: Player[];
  scores: Record<string, number>;
  showAnimation?: boolean;
}

export function Scoreboard({ players, scores, showAnimation = true }: ScoreboardProps) {
  // Sort players by score
  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  return (
    <div className="w-full max-w-md space-y-3">
      {sortedPlayers.map((player, index) => {
        const score = scores[player.id] || 0;
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
              {isFirst && (
                <span className="text-yellow-500 text-sm font-medium">Winner!</span>
              )}
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
