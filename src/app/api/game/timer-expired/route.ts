import { NextRequest, NextResponse } from 'next/server';
import { endRound, nextRound, startRound, getGame } from '@/lib/game/engine';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';

interface TimerExpiredRequest {
  code: string;
  roundNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TimerExpiredRequest = await request.json();
    const { code, roundNumber } = body;

    if (!code || roundNumber === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const game = getGame(code.toUpperCase());
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

    // Check if this is still the current round (avoid race conditions)
    const currentRound = game.rounds[game.currentRound];
    if (!currentRound || currentRound.number !== roundNumber) {
      // Round has already moved on, ignore this timer expiry
      return NextResponse.json({ success: true, skipped: true });
    }

    // Only end round if it's still in 'playing' status
    if (currentRound.status !== 'playing') {
      return NextResponse.json({ success: true, skipped: true });
    }

    // End the round (timer expired)
    const endResult = endRound(code.toUpperCase());
    if (endResult) {
      // Notify timer expired first
      await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.TIMER_EXPIRED, {});

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

      // After a delay, either start next round or end game
      const updatedGame = getGame(code.toUpperCase());

      setTimeout(async () => {
        try {
          if (updatedGame && updatedGame.currentRound + 1 >= updatedGame.totalRounds) {
            // Game over
            await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.GAME_OVER, {
              finalScores: updatedGame.scores,
              heartTotals: updatedGame.heartTotals,
            });
          } else {
            // Next round
            const newRound = nextRound(code.toUpperCase());
            if (newRound) {
              // Start the round to set status to 'playing'
              startRound(code.toUpperCase());
              // Send minimal data for next round
              await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.ROUND_START, {
                round: {
                  number: newRound.number,
                  status: newRound.status,
                  guesses: {},
                  guessTimestamps: {},
                  hearts: [],
                  startedAt: newRound.startedAt,
                  song: {
                    track: {
                      id: newRound.song.track.id,
                      name: newRound.song.track.name,
                      artists: newRound.song.track.artists.map((a) => ({ name: a.name })),
                      album: {
                        name: newRound.song.track.album.name,
                        images: newRound.song.track.album.images.slice(0, 1),
                      },
                      deezerPreviewUrl: newRound.song.track.deezerPreviewUrl,
                    },
                    ownerId: null,
                    ownerName: null,
                  },
                },
              });
            }
          }
        } catch (err) {
          console.error('Error in delayed round transition:', err);
        }
      }, 5000); // 5 second delay between rounds
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Timer expired error:', error);
    return NextResponse.json(
      { error: 'Failed to handle timer expiry' },
      { status: 500 }
    );
  }
}
