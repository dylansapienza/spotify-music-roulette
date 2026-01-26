import { NextRequest, NextResponse } from 'next/server';
import { nextRound, startRound, getGame } from '@/lib/game/engine';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';

interface NextRoundRequest {
  code: string;
  currentRoundNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: NextRoundRequest = await request.json();
    const { code, currentRoundNumber } = body;

    if (!code || currentRoundNumber === undefined) {
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

    // Check if game is still playing
    if (game.status === 'finished') {
      // Game already finished, send game over event for any clients that missed it
      await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.GAME_OVER, {
        finalScores: game.scores,
        heartTotals: game.heartTotals,
      });
      return NextResponse.json({ success: true, gameOver: true });
    }

    if (game.status !== 'playing') {
      return NextResponse.json(
        { error: 'Game is not in progress' },
        { status: 400 }
      );
    }

    // Idempotency check: Verify the round hasn't already advanced
    // The currentRoundNumber from client is 1-indexed (round.number)
    // game.currentRound is 0-indexed
    const serverRoundNumber = game.currentRound + 1;

    if (serverRoundNumber > currentRoundNumber) {
      // Round already advanced by another client - return current state
      const currentRound = game.rounds[game.currentRound];
      if (currentRound) {
        // Re-send round start for this client
        await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.ROUND_START, {
          round: {
            number: currentRound.number,
            status: currentRound.status,
            guesses: {},
            guessTimestamps: {},
            hearts: [],
            startedAt: currentRound.startedAt,
            song: {
              track: {
                id: currentRound.song.track.id,
                name: currentRound.song.track.name,
                artists: currentRound.song.track.artists.map((a) => ({ name: a.name })),
                album: {
                  name: currentRound.song.track.album.name,
                  images: currentRound.song.track.album.images.slice(0, 1),
                },
                deezerPreviewUrl: currentRound.song.track.deezerPreviewUrl,
              },
              ownerId: null,
              ownerName: null,
            },
          },
        });
      }
      return NextResponse.json({ success: true, alreadyAdvanced: true });
    }

    // Check if this is the last round
    if (game.currentRound + 1 >= game.totalRounds) {
      // Advance to finished state
      await nextRound(code.toUpperCase());
      // returns null since game is finished

      // Get updated game state to send final scores
      const finishedGame = await getGame(code.toUpperCase());
      if (finishedGame) {
        await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.GAME_OVER, {
          finalScores: finishedGame.scores,
          heartTotals: finishedGame.heartTotals,
        });
      }
      return NextResponse.json({ success: true, gameOver: true });
    }

    // Advance to next round
    const newRound = await nextRound(code.toUpperCase());
    if (!newRound) {
      // Game must have finished (another client got there first)
      const finishedGame = await getGame(code.toUpperCase());
      if (finishedGame && finishedGame.status === 'finished') {
        await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.GAME_OVER, {
          finalScores: finishedGame.scores,
          heartTotals: finishedGame.heartTotals,
        });
        return NextResponse.json({ success: true, gameOver: true });
      }
      return NextResponse.json(
        { error: 'Failed to advance to next round' },
        { status: 500 }
      );
    }

    // Start the round
    const startedRound = await startRound(code.toUpperCase());
    if (!startedRound) {
      return NextResponse.json(
        { error: 'Failed to start next round' },
        { status: 500 }
      );
    }

    // Send round start event
    await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.ROUND_START, {
      round: {
        number: startedRound.number,
        status: startedRound.status,
        guesses: {},
        guessTimestamps: {},
        hearts: [],
        startedAt: startedRound.startedAt,
        song: {
          track: {
            id: startedRound.song.track.id,
            name: startedRound.song.track.name,
            artists: startedRound.song.track.artists.map((a) => ({ name: a.name })),
            album: {
              name: startedRound.song.track.album.name,
              images: startedRound.song.track.album.images.slice(0, 1),
            },
            deezerPreviewUrl: startedRound.song.track.deezerPreviewUrl,
          },
          ownerId: null,
          ownerName: null,
        },
      },
    });

    return NextResponse.json({ success: true, roundNumber: startedRound.number });
  } catch (error) {
    console.error('Next round error:', error);
    return NextResponse.json(
      { error: 'Failed to advance to next round' },
      { status: 500 }
    );
  }
}
