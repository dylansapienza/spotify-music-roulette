'use client';

import { Player } from '@/lib/game/types';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  scores?: Record<string, number>;
  showScores?: boolean;
  guessedPlayers?: string[];
}

export function PlayerList({
  players,
  currentPlayerId,
  scores,
  showScores = false,
  guessedPlayers = [],
}: PlayerListProps) {
  return (
    <div className="space-y-3">
      {players.map((player, index) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl',
            'bg-white/5 border border-white/10',
            player.id === currentPlayerId && 'border-[#1DB954]',
            !player.isConnected && 'opacity-50'
          )}
        >
          <Avatar
            src={player.image}
            name={player.name}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">
                {player.name}
              </span>
              {player.isHost && (
                <span className="px-2 py-0.5 text-xs font-medium bg-[#1DB954]/20 text-[#1DB954] rounded-full">
                  HOST
                </span>
              )}
              {player.id === currentPlayerId && (
                <span className="px-2 py-0.5 text-xs font-medium bg-white/20 text-white rounded-full">
                  YOU
                </span>
              )}
            </div>
            {!player.isConnected && (
              <span className="text-xs text-white/50">Disconnected</span>
            )}
          </div>
          {showScores && scores && (
            <div className="text-right">
              <span className="text-lg font-bold text-[#1DB954]">
                {scores[player.id] || 0}
              </span>
              <span className="text-xs text-white/50 ml-1">pts</span>
            </div>
          )}
          {guessedPlayers.includes(player.id) && (
            <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
