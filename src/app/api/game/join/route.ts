import { NextRequest, NextResponse } from 'next/server';
import { addPlayerToGame, getGame } from '@/lib/game/engine';
import { getTopTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';
import { JoinGameRequest, JoinGameResponse, Player, TIME_RANGE_LABELS } from '@/lib/game/types';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const body: JoinGameRequest = await request.json();
    const { code, playerName, playerSpotifyId, playerImage, accessToken } = body;

    if (!code || !playerName || !playerSpotifyId || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if game exists
    const existingGame = getGame(code.toUpperCase());
    if (!existingGame) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    if (existingGame.status !== 'lobby') {
      return NextResponse.json(
        { success: false, error: 'Game has already started' },
        { status: 400 }
      );
    }

    // Use the game's time range setting for fetching tracks
    const timeRange = existingGame.timeRange;

    // Fetch player's top tracks with the game's time range
    const spotifyTracks = await getTopTracks(accessToken, 50, timeRange);
    console.log(`Player ${playerName}: Fetched ${spotifyTracks.length} tracks (${TIME_RANGE_LABELS[timeRange]})`);
    
    // Fetch Deezer preview URLs for all tracks
    console.log(`Fetching Deezer previews for ${spotifyTracks.length} tracks...`);
    const topTracks = await batchGetDeezerPreviews(spotifyTracks);
    const tracksWithPreviews = topTracks.filter((t) => t.deezerPreviewUrl).length;
    console.log(`Player ${playerName}: ${tracksWithPreviews}/${topTracks.length} tracks have Deezer previews`);

    // Create the player (keep all tracks)
    const player: Player = {
      id: nanoid(),
      name: playerName,
      image: playerImage,
      spotifyId: playerSpotifyId,
      topTracks: topTracks,
      isHost: false,
      isConnected: true,
    };

    // Add player to game
    const gameState = addPlayerToGame(code.toUpperCase(), player);
    if (!gameState) {
      return NextResponse.json(
        { success: false, error: 'Failed to join game' },
        { status: 500 }
      );
    }

    // Notify other players (send minimal data - tracks are too large for Pusher's 10KB limit)
    await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.PLAYER_JOINED, {
      player: {
        id: player.id,
        name: player.name,
        image: player.image,
        spotifyId: player.spotifyId,
        isHost: player.isHost,
        isConnected: player.isConnected,
        topTracks: [], // Omit tracks - only needed server-side
      },
    });

    const response: JoinGameResponse = {
      success: true,
      gameState,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Join game error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join game' },
      { status: 500 }
    );
  }
}
