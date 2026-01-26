'use client';

import { create } from 'zustand';
import { GameState, Player, Round } from './types';

interface GameStore {
  // Game state
  gameState: GameState | null;
  currentPlayer: Player | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  hasGuessedThisRound: boolean;
  
  // Actions
  setGameState: (state: GameState | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasGuessed: (hasGuessed: boolean) => void;
  
  // Game updates
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updateRound: (round: Round) => void;
  updateScores: (scores: Record<string, number>) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  gameState: null,
  currentPlayer: null,
  isLoading: false,
  error: null,
  hasGuessedThisRound: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setGameState: (state) => set({ gameState: state }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setHasGuessed: (hasGuessed) => set({ hasGuessedThisRound: hasGuessed }),

  addPlayer: (player) => {
    const { gameState } = get();
    if (!gameState) return;

    const existingIndex = gameState.players.findIndex(
      (p) => p.spotifyId === player.spotifyId
    );

    if (existingIndex >= 0) {
      // Update existing player
      const newPlayers = [...gameState.players];
      newPlayers[existingIndex] = { ...newPlayers[existingIndex], isConnected: true };
      set({
        gameState: { ...gameState, players: newPlayers },
      });
    } else {
      // Add new player
      set({
        gameState: {
          ...gameState,
          players: [...gameState.players, player],
          scores: { ...gameState.scores, [player.id]: 0 },
        },
      });
    }
  },

  removePlayer: (playerId) => {
    const { gameState } = get();
    if (!gameState) return;

    const newPlayers = gameState.players.map((p) =>
      p.id === playerId ? { ...p, isConnected: false } : p
    );

    set({
      gameState: { ...gameState, players: newPlayers },
    });
  },

  updateRound: (round) => {
    const { gameState } = get();
    if (!gameState) return;

    const newRounds = [...gameState.rounds];
    const roundIndex = newRounds.findIndex((r) => r.number === round.number);
    
    if (roundIndex >= 0) {
      newRounds[roundIndex] = round;
    } else {
      newRounds.push(round);
    }

    set({
      gameState: {
        ...gameState,
        rounds: newRounds,
        currentRound: round.number - 1,
      },
      hasGuessedThisRound: false,
    });
  },

  updateScores: (scores) => {
    const { gameState } = get();
    if (!gameState) return;

    set({
      gameState: { ...gameState, scores },
    });
  },

  reset: () => set(initialState),
}));
