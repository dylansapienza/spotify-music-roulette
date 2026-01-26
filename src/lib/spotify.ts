import { SpotifyTrack, SpotifyUser, TimeRange } from './game/types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export async function getSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify user API error:', response.status, errorText);
    throw new Error(`Failed to fetch Spotify user: ${response.status}`);
  }

  return response.json();
}

export async function getTopTracks(
  accessToken: string,
  limit: number = 50,
  timeRange: TimeRange = 'medium_term'
): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify top tracks API error:', response.status, errorText);
    throw new Error(`Failed to fetch top tracks: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Debug: Log first track to verify API response structure
  if (data.items?.[0]) {
    const sample = data.items[0];
    console.log('=== SPOTIFY API DEBUG ===');
    console.log('Sample track:', sample.name, 'by', sample.artists?.[0]?.name);
    console.log('preview_url:', sample.preview_url);
    console.log('ISRC:', sample.external_ids?.isrc);
    console.log('Full track object keys:', Object.keys(sample));
  }
  
  return data.items;
}

// Filter tracks to only those with preview URLs
export function filterPlayableTracks(tracks: SpotifyTrack[]): SpotifyTrack[] {
  return tracks.filter((track) => track.preview_url !== null);
}
