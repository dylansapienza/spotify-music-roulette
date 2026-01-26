import { SpotifyTrack, SpotifyPlaylist, SpotifyUserSearchResult } from './game/types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Client Credentials token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get a Client Credentials token for accessing public Spotify data.
 * This doesn't require user authentication - just app credentials.
 * Token is cached and refreshed automatically when expired.
 */
export async function getClientCredentialsToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify client credentials');
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify token error:', response.status, errorText);
    throw new Error(`Failed to get Spotify token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Extract Spotify user ID from a profile URL or return the input if it's already a username.
 * Supports formats:
 * - spotify:user:username
 * - https://open.spotify.com/user/username
 * - username (direct)
 */
export function extractSpotifyUserId(input: string): string {
  const trimmed = input.trim();
  
  // Handle Spotify URI format: spotify:user:username
  if (trimmed.startsWith('spotify:user:')) {
    return trimmed.replace('spotify:user:', '');
  }
  
  // Handle URL format: https://open.spotify.com/user/username
  const urlMatch = trimmed.match(/open\.spotify\.com\/user\/([^/?]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Return as-is (assume it's a username)
  return trimmed;
}

/**
 * Get a user's public profile by their Spotify ID.
 * Uses Client Credentials flow (no user auth needed).
 */
export async function getSpotifyUserById(userId: string): Promise<SpotifyUserSearchResult> {
  const token = await getClientCredentialsToken();

  const response = await fetch(`${SPOTIFY_API_BASE}/users/${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify user profile error:', response.status, errorText);
    throw new Error(`Failed to get user profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a user's public playlists.
 * Uses Client Credentials flow (no user auth needed).
 * Only returns PUBLIC playlists.
 */
export async function getUserPublicPlaylists(userId: string, limit: number = 50): Promise<SpotifyPlaylist[]> {
  const token = await getClientCredentialsToken();

  const response = await fetch(
    `${SPOTIFY_API_BASE}/users/${encodeURIComponent(userId)}/playlists?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify playlists error:', response.status, errorText);
    throw new Error(`Failed to get user playlists: ${response.status}`);
  }

  const data = await response.json();
  // Filter to only public playlists (the API should only return public ones, but double-check)
  return (data.items || []).filter((playlist: SpotifyPlaylist) => playlist.public !== false);
}

/**
 * Get tracks from a playlist.
 * Uses Client Credentials flow (no user auth needed).
 * Only works for PUBLIC playlists.
 */
export async function getPlaylistTracks(playlistId: string, limit: number = 100): Promise<SpotifyTrack[]> {
  const token = await getClientCredentialsToken();

  const response = await fetch(
    `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&fields=items(track(id,name,artists,album,preview_url,external_urls,external_ids))`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Spotify playlist tracks error:', response.status, errorText);
    throw new Error(`Failed to get playlist tracks: ${response.status}`);
  }

  const data = await response.json();
  // Extract track objects from playlist items (filter out null/local tracks)
  return (data.items || [])
    .map((item: { track: SpotifyTrack | null }) => item.track)
    .filter((track: SpotifyTrack | null): track is SpotifyTrack => track !== null && track.id !== null);
}

