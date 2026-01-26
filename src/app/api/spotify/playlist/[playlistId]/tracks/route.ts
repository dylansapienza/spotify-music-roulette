import { NextRequest, NextResponse } from 'next/server';
import { getPlaylistTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Get tracks from the playlist
    const tracks = await getPlaylistTracks(playlistId, 100);

    // Fetch Deezer preview URLs for all tracks
    const tracksWithPreviews = await batchGetDeezerPreviews(tracks);

    // Count tracks that have playable previews
    const playableCount = tracksWithPreviews.filter(
      (t) => t.deezerPreviewUrl || t.preview_url
    ).length;

    return NextResponse.json({
      tracks: tracksWithPreviews,
      totalTracks: tracksWithPreviews.length,
      playableTracks: playableCount,
    });
  } catch (error) {
    console.error('Get playlist tracks error:', error);
    return NextResponse.json(
      { error: 'Failed to get playlist tracks' },
      { status: 500 }
    );
  }
}
