import { NextRequest, NextResponse } from 'next/server';
import { endRound, getGame } from '@/lib/game/engine';
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
    const endResult = await endRound(code.toUpperCase());
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

      // NOTE: Next round transition is now handled by client-side timer
      // calling /api/game/next-round after 5 seconds
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
