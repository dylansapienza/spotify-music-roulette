import { NextRequest, NextResponse } from 'next/server';
import { getUserPublicPlaylists } from '@/lib/spotify';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const playlists = await getUserPublicPlaylists(userId, 50);

    // Filter out playlists with no tracks
    const validPlaylists = playlists.filter((p) => p.tracks.total > 0);

    return NextResponse.json({ playlists: validPlaylists });
  } catch (error) {
    console.error('Get user playlists error:', error);
    return NextResponse.json(
      { error: 'Failed to get user playlists' },
      { status: 500 }
    );
  }
}
