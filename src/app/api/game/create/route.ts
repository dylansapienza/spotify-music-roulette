import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/lib/game/engine';
import { getPlaylistTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';
import { CreateGameRequest, Player, SpotifyTrack } from '@/lib/game/types';
import { shuffleArray } from '@/lib/utils';
import { nanoid } from 'nanoid';

// Maximum number of songs to process per player (keeps loading fast)
const MAX_SONGS_PER_PLAYER = 25;

export async function POST(request: NextRequest) {
  // Parse request body BEFORE creating the stream
  let body: CreateGameRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { hostName, hostSpotifyId, hostImage, selectedPlaylists, totalRounds = 10 } = body;

  if (!hostName || !hostSpotifyId || !selectedPlaylists || selectedPlaylists.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        console.log(`Host ${hostName}: Fetching tracks from ${selectedPlaylists.length} playlists...`);

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

        console.log(`Host ${hostName}: ${allTracks.length} unique tracks from playlists`);

        // Randomly select up to MAX_SONGS_PER_PLAYER tracks to keep loading fast
        const shuffledTracks = shuffleArray(allTracks);
        const selectedTracks = shuffledTracks.slice(0, MAX_SONGS_PER_PLAYER);
        console.log(`Host ${hostName}: Selected ${selectedTracks.length} random tracks for processing`);

        // Send progress update with total track count
        sendEvent({ type: 'progress', completed: 0, total: selectedTracks.length });

        // Fetch Deezer preview URLs for selected tracks with progress updates
        console.log(`Fetching Deezer previews for ${selectedTracks.length} tracks...`);
        const tracksWithPreviews = await batchGetDeezerPreviews(selectedTracks, (completed, total) => {
          sendEvent({ type: 'progress', completed, total });
        });

        const playableCount = tracksWithPreviews.filter((t) => t.deezerPreviewUrl).length;
        console.log(`Host ${hostName}: ${playableCount}/${tracksWithPreviews.length} tracks have Deezer previews`);

        // Create the host player
        const host: Player = {
          id: nanoid(),
          name: hostName,
          image: hostImage,
          spotifyId: hostSpotifyId,
          topTracks: tracksWithPreviews,
          selectedPlaylists,
          isHost: true,
          isConnected: true,
          isReady: true,
        };

        // Create the game
        const gameState = await createGame(host, 'medium_term', totalRounds);
        console.log(`Game created with code: ${gameState.code}`);

        // Send complete event with game data
        sendEvent({
          type: 'complete',
          code: gameState.code,
          gameState,
        });

        controller.close();
      } catch (error) {
        console.error('Create game error:', error);
        sendEvent({ type: 'error', error: 'Failed to create game' });
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
