import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/lib/game/engine';
import { getPlaylistTracks } from '@/lib/spotify';
import { batchGetDeezerPreviews } from '@/lib/deezer';
import { CreateGameRequest, Player, SpotifyTrack } from '@/lib/game/types';
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

        // Fetch more tracks initially to account for songs without Deezer previews
        const shuffledTracks = shuffleArray(allTracks);
        const initialFetchCount = MAX_SONGS_PER_PLAYER * FETCH_MULTIPLIER;
        const selectedTracks = shuffledTracks.slice(0, initialFetchCount);
        console.log(`Host ${hostName}: Selected ${selectedTracks.length} random tracks for Deezer lookup`);

        // Send progress update with total track count
        sendEvent({ type: 'progress', completed: 0, total: selectedTracks.length });

        // Fetch Deezer preview URLs for selected tracks with progress updates
        console.log(`Fetching Deezer previews for ${selectedTracks.length} tracks...`);
        const tracksWithPreviews = await batchGetDeezerPreviews(selectedTracks, (completed, total) => {
          sendEvent({ type: 'progress', completed, total });
        });

        // Filter to only tracks that have a Deezer preview URL
        const playableTracks = tracksWithPreviews.filter((t) => t.deezerPreviewUrl);
        console.log(`Host ${hostName}: ${playableTracks.length}/${tracksWithPreviews.length} tracks have Deezer previews`);

        // Take up to MAX_SONGS_PER_PLAYER playable tracks
        const finalTracks = playableTracks.slice(0, MAX_SONGS_PER_PLAYER);
        console.log(`Host ${hostName}: Using ${finalTracks.length} playable tracks`);

        // Warn if we have fewer than minimum required playable songs
        if (finalTracks.length < MIN_PLAYABLE_SONGS) {
          sendEvent({
            type: 'warning',
            message: `Only ${finalTracks.length} songs have audio previews. Consider selecting different playlists with more popular music.`,
          });
        }

        // Create the host player
        const host: Player = {
          id: nanoid(),
          name: hostName,
          image: hostImage,
          spotifyId: hostSpotifyId,
          topTracks: finalTracks,
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
