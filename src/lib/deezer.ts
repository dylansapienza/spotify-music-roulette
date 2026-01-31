import { Redis } from '@upstash/redis';
import { SpotifyTrack } from './game/types';

const DEEZER_API_BASE = 'https://api.deezer.com';

// Redis client for persistent caching
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis cache configuration
const CACHE_PREFIX = 'deezer:preview:';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,      // Start with 1 second
  maxDelayMs: 10000,      // Cap at 10 seconds
  jitterFactor: 0.3,      // Add up to 30% random jitter
};

// In-memory cache for Deezer preview URLs
// Key: Spotify track ID, Value: Deezer preview URL or null if not found
const previewCache = new Map<string, string | null>();

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getBackoffDelay(attempt: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelayMs);
  
  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * RETRY_CONFIG.jitterFactor * Math.random();
  return cappedDelay + jitter;
}

/**
 * Fetch with retry logic and exponential backoff
 * Handles rate limiting (429) and transient server errors (5xx)
 */
async function fetchWithRetry(
  url: string,
  context: string
): Promise<Response | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      
      // Success or client error (except rate limit) - don't retry
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      
      // Rate limited (429) or server error (5xx) - retry with backoff
      if (response.status === 429 || response.status >= 500) {
        const isRateLimit = response.status === 429;
        const retryAfter = response.headers.get('Retry-After');
        
        if (attempt < RETRY_CONFIG.maxRetries) {
          // Use Retry-After header if provided, otherwise use exponential backoff
          let delayMs = getBackoffDelay(attempt);
          if (retryAfter && isRateLimit) {
            const retryAfterSeconds = parseInt(retryAfter, 10);
            if (!isNaN(retryAfterSeconds)) {
              delayMs = retryAfterSeconds * 1000;
            }
          }
          
          console.log(
            `Deezer ${isRateLimit ? 'rate limited' : `error ${response.status}`} for ${context}. ` +
            `Retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`
          );
          
          await sleep(delayMs);
          continue;
        }
        
        console.warn(`Deezer request failed after ${RETRY_CONFIG.maxRetries} retries for ${context}`);
        return null;
      }
      
      // Other non-OK status - return as-is
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Network errors - retry with backoff
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delayMs = getBackoffDelay(attempt);
        console.log(
          `Deezer network error for ${context}: ${lastError.message}. ` +
          `Retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`
        );
        await sleep(delayMs);
        continue;
      }
    }
  }
  
  console.error(`Deezer request failed after ${RETRY_CONFIG.maxRetries} retries for ${context}:`, lastError);
  return null;
}

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
    const url = `${DEEZER_API_BASE}/track/isrc:${isrc}`;
    const response = await fetchWithRetry(url, `ISRC:${isrc}`);
    
    if (!response) {
      return null;
    }
    
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
    const url = `${DEEZER_API_BASE}/search?q=${query}&limit=5`;
    const response = await fetchWithRetry(url, `search:"${title}" by "${artist}"`);
    
    if (!response) {
      return null;
    }
    
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
 * Uses two-level caching: in-memory (L1) and Redis (L2)
 * Tries ISRC lookup first, then falls back to search
 */
export async function getDeezerPreviewUrl(track: SpotifyTrack): Promise<string | null> {
  const cacheKey = `${CACHE_PREFIX}${track.id}`;

  // L1: Check in-memory cache first (fastest)
  if (previewCache.has(track.id)) {
    return previewCache.get(track.id) ?? null;
  }

  // L2: Check Redis cache
  try {
    const cachedValue = await redis.get<string>(cacheKey);
    if (cachedValue !== null) {
      // Empty string means "not found on Deezer" (cached negative result)
      const previewUrl = cachedValue === '' ? null : cachedValue;
      // Populate L1 cache
      previewCache.set(track.id, previewUrl);
      console.log(`Redis cache hit for "${track.name}"`);
      return previewUrl;
    }
  } catch (error) {
    // Redis error - continue with API lookup
    console.warn(`Redis cache read error for ${track.id}:`, error);
  }

  // Cache miss - do API lookup
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

  // Cache the result in both L1 and L2
  // Store empty string for null to distinguish from "not cached"
  previewCache.set(track.id, previewUrl);

  try {
    await redis.set(cacheKey, previewUrl || '', { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.warn(`Redis cache write error for ${track.id}:`, error);
  }

  if (previewUrl) {
    console.log(`Found Deezer preview for "${track.name}": ${previewUrl.substring(0, 50)}...`);
  } else {
    console.log(`No Deezer preview found for "${track.name}" by ${track.artists[0]?.name}`);
  }

  return previewUrl;
}

/**
 * Batch fetch Deezer preview URLs for multiple Spotify tracks
 * Processes tracks sequentially with delays to avoid rate limiting
 * Deezer rate limit is 10 requests/second - with multiple players joining
 * simultaneously, we need to be conservative to avoid hitting limits
 */
export async function batchGetDeezerPreviews(
  tracks: SpotifyTrack[],
  onProgress?: (completed: number, total: number) => void
): Promise<SpotifyTrack[]> {
  // Process 1 track at a time with 200ms delay between tracks
  // This gives us ~5 req/sec per player (each track may need ISRC + search fallback)
  // With Redis caching, most lookups will be cache hits anyway
  const BATCH_SIZE = 1;
  const BATCH_DELAY_MS = 200; // Delay between tracks to stay under rate limit
  const results: SpotifyTrack[] = [];
  
  // Report initial progress
  onProgress?.(0, tracks.length);
  
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (track) => ({
        ...track,
        deezerPreviewUrl: await getDeezerPreviewUrl(track),
      }))
    );
    
    results.push(...batchResults);
    
    // Report progress after each batch
    onProgress?.(results.length, tracks.length);
    
    // Add delay between batches to respect rate limit (except for last batch)
    if (i + BATCH_SIZE < tracks.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
  
  // Log summary
  const foundCount = results.filter((t) => t.deezerPreviewUrl).length;
  console.log(`Deezer preview lookup complete: ${foundCount}/${tracks.length} tracks have previews`);
  
  return results;
}

/**
 * Clear the preview URL cache (useful for testing)
 */
export function clearDeezerCache(): void {
  previewCache.clear();
}
