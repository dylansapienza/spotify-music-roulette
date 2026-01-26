import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/lib/game/engine';
import { getTopTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';
import { CreateGameRequest, CreateGameResponse, Player, TIME_RANGE_LABELS } from '@/lib/game/types';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const body: CreateGameRequest = await request.json();
    const { hostName, hostSpotifyId, hostImage, accessToken, timeRange = 'medium_term', totalRounds = 10 } = body;

    if (!hostName || !hostSpotifyId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch host's top tracks with selected time range
    const spotifyTracks = await getTopTracks(accessToken, 50, timeRange);
    console.log(`Host ${hostName}: Fetched ${spotifyTracks.length} tracks (${TIME_RANGE_LABELS[timeRange]})`);
    
    // Fetch Deezer preview URLs for all tracks
    console.log(`Fetching Deezer previews for ${spotifyTracks.length} tracks...`);
    const topTracks = await batchGetDeezerPreviews(spotifyTracks);
    const tracksWithPreviews = topTracks.filter((t) => t.deezerPreviewUrl).length;
    console.log(`Host ${hostName}: ${tracksWithPreviews}/${topTracks.length} tracks have Deezer previews`);

    // Create the host player (keep all tracks)
    const host: Player = {
      id: nanoid(),
      name: hostName,
      image: hostImage,
      spotifyId: hostSpotifyId,
      topTracks: topTracks,
      isHost: true,
      isConnected: true,
    };

    // Create the game with settings
    const gameState = createGame(host, timeRange, totalRounds);

    const response: CreateGameResponse = {
      code: gameState.code,
      gameState,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Create game error:', error);
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }
}
