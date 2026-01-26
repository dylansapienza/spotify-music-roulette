import { NextRequest, NextResponse } from 'next/server';
import { getGame } from '@/lib/game/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing game code' },
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

    // Don't send sensitive data
    return NextResponse.json({
      code: game.code,
      status: game.status,
      hostId: game.hostId,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        isHost: p.isHost,
        isConnected: p.isConnected,
      })),
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      scores: game.scores,
    });
  } catch (error) {
    console.error('Get game error:', error);
    return NextResponse.json(
      { error: 'Failed to get game' },
      { status: 500 }
    );
  }
}
