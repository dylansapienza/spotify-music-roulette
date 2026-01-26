'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SpotifyPlaylist, PlaylistSelection } from '@/lib/game/types';
import { cn } from '@/lib/utils';

interface PlaylistSelectorProps {
  userId: string;
  selectedPlaylists: PlaylistSelection[];
  onPlaylistsChange: (playlists: PlaylistSelection[]) => void;
  maxPlaylists?: number;
}

export function PlaylistSelector({
  userId,
  selectedPlaylists,
  onPlaylistsChange,
  maxPlaylists = 5,
}: PlaylistSelectorProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchPlaylists = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/spotify/user/${encodeURIComponent(userId)}/playlists`);

        if (!response.ok) {
          throw new Error('Failed to fetch playlists');
        }

        const data = await response.json();
        // Sort playlists by track count (descending) so larger playlists appear first
        const sortedPlaylists = (data.playlists || []).sort(
          (a: SpotifyPlaylist, b: SpotifyPlaylist) => b.tracks.total - a.tracks.total
        );
        setPlaylists(sortedPlaylists);

        if (data.playlists?.length === 0) {
          setError('No public playlists found. Make sure you have at least one public playlist on Spotify.');
        }
      } catch (err) {
        console.error('Fetch playlists error:', err);
        setError('Failed to load playlists. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylists();
  }, [userId]);

  const togglePlaylist = (playlist: SpotifyPlaylist) => {
    const isSelected = selectedPlaylists.some((p) => p.id === playlist.id);

    if (isSelected) {
      // Remove playlist
      onPlaylistsChange(selectedPlaylists.filter((p) => p.id !== playlist.id));
    } else {
      // Add playlist (if under limit)
      if (selectedPlaylists.length >= maxPlaylists) {
        return; // Can't add more
      }

      const selection: PlaylistSelection = {
        id: playlist.id,
        name: playlist.name,
        imageUrl: playlist.images?.[0]?.url,
        trackCount: playlist.tracks.total,
      };

      onPlaylistsChange([...selectedPlaylists, selection]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1DB954]"></div>
        <span className="ml-3 text-white/60">Loading playlists...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error}</p>
        <a
          href="https://open.spotify.com/collection/playlists"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1DB954] hover:underline"
        >
          Manage your playlists on Spotify
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <p className="text-sm text-white/80">
          <span className="font-medium text-[#1DB954]">Tip:</span> Pick playlists that represent <em>your</em> music taste — like your favorite songs or most-played tracks. The more "you" it is, the more fun the game!
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          Select up to {maxPlaylists} playlists ({selectedPlaylists.length}/{maxPlaylists} selected)
        </p>
        {selectedPlaylists.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPlaylistsChange([])}
          >
            Clear All
          </Button>
        )}
      </div>

      {playlists.length === 0 ? (
        <p className="text-white/60 text-center py-4">
          No public playlists found for this user.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
          {playlists.map((playlist) => {
            const isSelected = selectedPlaylists.some((p) => p.id === playlist.id);
            const isDisabled = !isSelected && selectedPlaylists.length >= maxPlaylists;

            return (
              <button
                key={playlist.id}
                onClick={() => togglePlaylist(playlist)}
                disabled={isDisabled}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                  isSelected
                    ? 'bg-[#1DB954]/20 border-2 border-[#1DB954]'
                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {playlist.images?.[0]?.url ? (
                  <img
                    src={playlist.images[0].url}
                    alt={playlist.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white/60"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{playlist.name}</p>
                  <p className="text-sm text-white/60">
                    {playlist.tracks.total} tracks
                  </p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedPlaylists.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-sm text-white/60 mb-2">Selected playlists:</p>
          <div className="flex flex-wrap gap-2">
            {selectedPlaylists.map((playlist) => (
              <span
                key={playlist.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#1DB954]/20 rounded-full text-sm"
              >
                {playlist.name}
                <button
                  onClick={() =>
                    onPlaylistsChange(selectedPlaylists.filter((p) => p.id !== playlist.id))
                  }
                  className="ml-1 hover:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
