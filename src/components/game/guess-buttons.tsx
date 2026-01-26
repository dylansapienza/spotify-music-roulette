'use client';

import { Player } from '@/lib/game/types';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GuessButtonsProps {
  players: Player[];
  onGuess: (playerId: string) => void;
  selectedPlayerId?: string | null;
  correctPlayerId?: string | null;
  disabled?: boolean;
  showResults?: boolean;
}

// Dynamic sizing based on player count
function getLayoutConfig(playerCount: number) {
  if (playerCount <= 4) {
    return { cols: 'grid-cols-2', avatar: 'md' as const, padding: 'p-3', gap: 'gap-2', text: 'text-sm', badge: 'w-6 h-6' };
  }
  if (playerCount <= 6) {
    return { cols: 'grid-cols-3', avatar: 'sm' as const, padding: 'p-2.5', gap: 'gap-2', text: 'text-sm', badge: 'w-5 h-5' };
  }
  if (playerCount <= 9) {
    return { cols: 'grid-cols-3', avatar: 'sm' as const, padding: 'p-2', gap: 'gap-1.5', text: 'text-xs', badge: 'w-5 h-5' };
  }
  // 10+ players: tighter layout
  return { cols: 'grid-cols-3', avatar: 'xs' as const, padding: 'p-1.5', gap: 'gap-1', text: 'text-xs', badge: 'w-4 h-4' };
}

export function GuessButtons({
  players,
  onGuess,
  selectedPlayerId,
  correctPlayerId,
  disabled = false,
  showResults = false,
}: GuessButtonsProps) {
  const layout = getLayoutConfig(players.length);
  
  return (
    <div className={cn('grid w-full', layout.cols, layout.gap)}>
      {players.map((player, index) => {
        const isSelected = selectedPlayerId === player.id;
        const isCorrect = correctPlayerId === player.id;
        const isWrong = showResults && isSelected && !isCorrect;

        return (
          <motion.button
            key={player.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onGuess(player.id)}
            disabled={disabled || !!selectedPlayerId}
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-xl',
              layout.padding,
              'border-2 transition-all duration-200 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-70',
              !showResults && !isSelected && 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30',
              isSelected && !showResults && 'bg-[#1DB954]/20 border-[#1DB954] shadow-lg shadow-[#1DB954]/20',
              showResults && isCorrect && 'bg-[#1DB954]/20 border-[#1DB954]',
              isWrong && 'bg-red-500/20 border-red-500'
            )}
          >
            <Avatar src={player.image} name={player.name} size={layout.avatar} />
            <span className={cn('font-medium text-white text-center truncate w-full', layout.text)}>
              {player.name.split(' ')[0]}
            </span>
            {showResults && isCorrect && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn('absolute -top-1 -right-1 rounded-full bg-[#1DB954] flex items-center justify-center', layout.badge)}
              >
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
            {isWrong && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn('absolute -top-1 -right-1 rounded-full bg-red-500 flex items-center justify-center', layout.badge)}
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
