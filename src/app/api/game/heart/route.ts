import { NextRequest, NextResponse } from 'next/server';
import { submitHeart, getGame } from '@/lib/game/engine';
import { HeartRequest } from '@/lib/game/types';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';

export async function POST(request: NextRequest) {
  try {
    const body: HeartRequest = await request.json();
    const { code, playerId } = body;

    if (!code || !playerId) {
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

    // Submit the heart
    const result = submitHeart(code.toUpperCase(), playerId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit heart' },
        { status: 400 }
      );
    }

    // Only notify others if it's not the owner hearting their own song
    // (owner can still click for UI feedback, but it doesn't count or broadcast)
    if (!result.isOwnSong) {
      await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.PLAYER_HEARTED, {
        playerId,
        visibleHeartCount: result.visibleHeartCount,
      });
    }

    return NextResponse.json({
      success: true,
      heartCount: result.visibleHeartCount,
      isOwnSong: result.isOwnSong || false
    });
  } catch (error) {
    console.error('Heart error:', error);
    return NextResponse.json(
      { error: 'Failed to submit heart' },
      { status: 500 }
    );
  }
}
