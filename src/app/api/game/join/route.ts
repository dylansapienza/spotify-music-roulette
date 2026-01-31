import { NextRequest, NextResponse } from 'next/server';
import { addPlayerToGame, getGame } from '@/lib/game/engine';
import { getPlaylistTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';
import { JoinGameRequest, Player, SpotifyTrack } from '@/lib/game/types';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';
import { shuffleArray } from '@/lib/utils';
import { nanoid } from 'nanoid';

// Maximum number of songs to process per player (keeps loading fast)
const MAX_SONGS_PER_PLAYER = 20;
// Fetch more tracks initially to account for songs without Deezer previews
const FETCH_MULTIPLIER = 1.5;
// Minimum playable songs required (warn if below this)
const MIN_PLAYABLE_SONGS = 10;

export async function POST(request: NextRequest) {
  // Parse request body BEFORE creating the stream
  let body: JoinGameRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { code, playerName, playerSpotifyId, playerImage, selectedPlaylists } = body;

  if (!code || !playerName || !playerSpotifyId || !selectedPlaylists || selectedPlaylists.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Check if game exists before starting the stream
  const existingGame = await getGame(code.toUpperCase());
  if (!existingGame) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (existingGame.status !== 'lobby') {
    return NextResponse.json({ error: 'Game has already started' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Send initial status
        sendEvent({ type: 'status', message: 'Fetching tracks from playlists...' });

        // Fetch tracks from all selected playlists
        console.log(`Player ${playerName}: Fetching tracks from ${selectedPlaylists.length} playlists...`);

        const allTracks: SpotifyTrack[] = [];
        const seenTrackIds = new Set<string>();

        for (const playlist of selectedPlaylists) {
          try {
            const tracks = await getPlaylistTracks(playlist.id, 100);
            console.log(`  - ${playlist.name}: ${tracks.length} tracks`);

            // Add unique tracks only
            for (const track of tracks) {
              if (!seenTrackIds.has(track.id)) {
                seenTrackIds.add(track.id);
                allTracks.push(track);
              }
            }
          } catch (err) {
            console.error(`Failed to fetch tracks from playlist ${playlist.name}:`, err);
          }
        }

        console.log(`Player ${playerName}: ${allTracks.length} unique tracks from playlists`);

        // Fetch more tracks initially to account for songs without Deezer previews
        const shuffledTracks = shuffleArray(allTracks);
        const initialFetchCount = MAX_SONGS_PER_PLAYER * FETCH_MULTIPLIER;
        const selectedTracks = shuffledTracks.slice(0, initialFetchCount);
        console.log(`Player ${playerName}: Selected ${selectedTracks.length} random tracks for Deezer lookup`);

        // Send progress update with total track count
        sendEvent({ type: 'progress', completed: 0, total: selectedTracks.length });

        // Fetch Deezer preview URLs for selected tracks with progress updates
        console.log(`Fetching Deezer previews for ${selectedTracks.length} tracks...`);
        const tracksWithPreviews = await batchGetDeezerPreviews(selectedTracks, (completed, total) => {
          sendEvent({ type: 'progress', completed, total });
        });

        // Filter to only tracks that have a Deezer preview URL
        const playableTracks = tracksWithPreviews.filter((t) => t.deezerPreviewUrl);
        console.log(`Player ${playerName}: ${playableTracks.length}/${tracksWithPreviews.length} tracks have Deezer previews`);

        // Take up to MAX_SONGS_PER_PLAYER playable tracks
        const finalTracks = playableTracks.slice(0, MAX_SONGS_PER_PLAYER);
        console.log(`Player ${playerName}: Using ${finalTracks.length} playable tracks`);

        // Warn if we have fewer than minimum required playable songs
        if (finalTracks.length < MIN_PLAYABLE_SONGS) {
          sendEvent({
            type: 'warning',
            message: `Only ${finalTracks.length} songs have audio previews. Consider selecting different playlists with more popular music.`,
          });
        }

        // Create the player
        const player: Player = {
          id: nanoid(),
          name: playerName,
          image: playerImage,
          spotifyId: playerSpotifyId,
          topTracks: finalTracks,
          selectedPlaylists,
          isHost: false,
          isConnected: true,
          isReady: true,
        };

        // Add player to game
        const gameState = await addPlayerToGame(code.toUpperCase(), player);
        if (!gameState) {
          sendEvent({ type: 'error', error: 'Failed to join game' });
          controller.close();
          return;
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
            isReady: player.isReady,
            topTracks: [], // Omit tracks - only needed server-side
            selectedPlaylists: player.selectedPlaylists,
          },
        });

        console.log(`Player ${playerName} joined game ${code.toUpperCase()}`);

        // Send complete event with game data
        sendEvent({
          type: 'complete',
          success: true,
          gameState,
        });

        controller.close();
      } catch (error) {
        console.error('Join game error:', error);
        sendEvent({ type: 'error', error: 'Failed to join game' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
