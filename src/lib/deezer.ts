import { SpotifyTrack } from './game/types';

const DEEZER_API_BASE = 'https://api.deezer.com';

// In-memory cache for Deezer preview URLs
// Key: Spotify track ID, Value: Deezer preview URL or null if not found
const previewCache = new Map<string, string | null>();

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
  };
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
}

/**
 * Get a Deezer track by ISRC code
 * This is the primary lookup method as ISRC is a universal identifier
 */
export async function getDeezerTrackByISRC(isrc: string): Promise<DeezerTrack | null> {
  try {
    const response = await fetch(`${DEEZER_API_BASE}/track/isrc:${isrc}`);
    
    if (!response.ok) {
      console.log(`Deezer ISRC lookup failed for ${isrc}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Deezer returns an error object if not found
    if (data.error) {
      console.log(`Deezer ISRC not found for ${isrc}:`, data.error.message);
      return null;
    }
    
    return data as DeezerTrack;
  } catch (error) {
    console.error(`Error fetching Deezer track by ISRC ${isrc}:`, error);
    return null;
  }
}

/**
 * Search for a track on Deezer by title and artist name
 * This is the fallback method when ISRC lookup fails
 */
export async function searchDeezerTrack(
  title: string,
  artist: string
): Promise<DeezerTrack | null> {
  try {
    // Clean up the search query - remove special characters that might break the search
    const cleanTitle = title
      .replace(/['"()[\]{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanArtist = artist
      .replace(/['"()[\]{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Use simple space-separated query (more reliable than advanced syntax)
    const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
    const response = await fetch(`${DEEZER_API_BASE}/search?q=${query}&limit=5`);
    
    if (!response.ok) {
      console.log(`Deezer search failed for "${title}" by "${artist}": ${response.status}`);
      return null;
    }
    
    const data: DeezerSearchResponse = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.log(`Deezer search found no results for "${title}" by "${artist}"`);
      return null;
    }
    
    // Try to find the best match - prioritize exact artist name match
    const lowerArtist = cleanArtist.toLowerCase();
    const bestMatch = data.data.find(
      (track) => track.artist.name.toLowerCase() === lowerArtist
    );
    
    return bestMatch || data.data[0];
  } catch (error) {
    console.error(`Error searching Deezer for "${title}" by "${artist}":`, error);
    return null;
  }
}

/**
 * Get the Deezer preview URL for a Spotify track
 * Tries ISRC lookup first, then falls back to search
 */
export async function getDeezerPreviewUrl(track: SpotifyTrack): Promise<string | null> {
  // Check cache first
  if (previewCache.has(track.id)) {
    return previewCache.get(track.id) ?? null;
  }
  
  let deezerTrack: DeezerTrack | null = null;
  
  // Try ISRC lookup first (most accurate)
  const isrc = track.external_ids?.isrc;
  if (isrc) {
    deezerTrack = await getDeezerTrackByISRC(isrc);
  }
  
  // Fallback to search if ISRC lookup failed
  if (!deezerTrack) {
    const artistName = track.artists[0]?.name || '';
    deezerTrack = await searchDeezerTrack(track.name, artistName);
  }
  
  // Extract preview URL
  const previewUrl = deezerTrack?.preview || null;
  
  // Cache the result (even if null to avoid repeated lookups)
  previewCache.set(track.id, previewUrl);
  
  if (previewUrl) {
    console.log(`Found Deezer preview for "${track.name}": ${previewUrl.substring(0, 50)}...`);
  } else {
    console.log(`No Deezer preview found for "${track.name}" by ${track.artists[0]?.name}`);
  }
  
  return previewUrl;
}

/**
 * Batch fetch Deezer preview URLs for multiple Spotify tracks
 * Adds a small delay between requests to avoid rate limiting
 */
export async function batchGetDeezerPreviews(
  tracks: SpotifyTrack[]
): Promise<SpotifyTrack[]> {
  const DELAY_MS = 100; // 100ms delay between requests to be nice to Deezer API
  
  const tracksWithPreviews: SpotifyTrack[] = [];
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    
    // Get preview URL
    const deezerPreviewUrl = await getDeezerPreviewUrl(track);
    
    // Add to result with the preview URL
    tracksWithPreviews.push({
      ...track,
      deezerPreviewUrl,
    });
    
    // Add delay between requests (except for the last one)
    if (i < tracks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
  
  // Log summary
  const foundCount = tracksWithPreviews.filter((t) => t.deezerPreviewUrl).length;
  console.log(`Deezer preview lookup complete: ${foundCount}/${tracks.length} tracks have previews`);
  
  return tracksWithPreviews;
}

/**
 * Clear the preview URL cache (useful for testing)
 */
export function clearDeezerCache(): void {
  previewCache.clear();
}
