import { NextRequest, NextResponse } from 'next/server';
import { submitGuess, endRound, getGame } from '@/lib/game/engine';
import { GuessRequest } from '@/lib/game/types';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';

export async function POST(request: NextRequest) {
  try {
    const body: GuessRequest = await request.json();
    const { code, playerId, guessedPlayerId } = body;

    if (!code || !playerId || !guessedPlayerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const game = await getGame(code.toUpperCase());
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'playing') {
      return NextResponse.json(
        { error: 'Game is not in progress' },
        { status: 400 }
      );
    }

    // Submit the guess
    const result = await submitGuess(code.toUpperCase(), playerId, guessedPlayerId);
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to submit guess' },
        { status: 500 }
      );
    }

    // Notify others that this player has guessed
    await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.PLAYER_GUESSED, {
      playerId,
      hasGuessed: true,
    });

    // Check if all players have guessed
    if (result.allGuessed) {
      // End the round immediately
      const endResult = await endRound(code.toUpperCase());
      if (endResult) {
        // Send round end with minimal data (strip to essentials for Pusher 10KB limit)
        await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.ROUND_END, {
          round: {
            number: endResult.round.number,
            status: endResult.round.status,
            guesses: endResult.round.guesses,
            guessTimestamps: endResult.round.guessTimestamps,
            hearts: endResult.round.hearts,
            song: {
              track: {
                id: endResult.round.song.track.id,
                name: endResult.round.song.track.name,
                artists: endResult.round.song.track.artists.map((a) => ({ name: a.name })),
                album: {
                  name: endResult.round.song.track.album.name,
                  images: endResult.round.song.track.album.images.slice(0, 1),
                },
                deezerPreviewUrl: endResult.round.song.track.deezerPreviewUrl,
              },
              ownerId: endResult.round.song.ownerId,
              ownerName: endResult.round.song.ownerName,
            },
          },
          scores: endResult.scores,
          roundScores: endResult.roundScores,
          heartTotals: endResult.heartTotals,
        });

        // NOTE: Next round transition is now handled by client-side timer
        // calling /api/game/next-round after 5 seconds
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guess error:', error);
    return NextResponse.json(
      { error: 'Failed to submit guess' },
      { status: 500 }
    );
  }
}
