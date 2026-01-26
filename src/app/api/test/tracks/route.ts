import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTopTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch Spotify tracks
    const spotifyTracks = await getTopTracks(session.accessToken, 50);
    
    // Fetch Deezer preview URLs
    console.log('Fetching Deezer previews for test page...');
    const tracks = await batchGetDeezerPreviews(spotifyTracks);
    
    // Calculate stats
    const totalTracks = tracks.length;
    const tracksWithDeezerPreviews = tracks.filter((t) => t.deezerPreviewUrl).length;
    const tracksWithSpotifyPreviews = tracks.filter((t) => t.preview_url).length;

    return NextResponse.json({
      tracks,
      stats: {
        total: totalTracks,
        withDeezerPreviews: tracksWithDeezerPreviews,
        withSpotifyPreviews: tracksWithSpotifyPreviews,
        withoutPreviews: totalTracks - tracksWithDeezerPreviews,
      },
    });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
