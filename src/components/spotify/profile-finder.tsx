'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SpotifyUserSearchResult } from '@/lib/game/types';

const SAVED_PROFILE_KEY = 'spotify_saved_profile';

interface ProfileFinderProps {
  onProfileSelect: (profile: SpotifyUserSearchResult) => void;
  selectedProfile: SpotifyUserSearchResult | null;
}

export function ProfileFinder({ onProfileSelect, selectedProfile }: ProfileFinderProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<SpotifyUserSearchResult | null>(null);
  const [showSavedOption, setShowSavedOption] = useState(false);

  // Load saved profile from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_PROFILE_KEY);
      if (saved) {
        const profile = JSON.parse(saved) as SpotifyUserSearchResult;
        setSavedProfile(profile);
        // Only show saved option if no profile is currently selected
        if (!selectedProfile) {
          setShowSavedOption(true);
        }
      }
    } catch (e) {
      // Invalid saved data, ignore
      localStorage.removeItem(SAVED_PROFILE_KEY);
    }
  }, [selectedProfile]);

  // Clipboard auto-detection when page becomes visible
  useEffect(() => {
    const checkClipboard = async () => {
      // Don't check if already have input or profile selected
      if (usernameInput || selectedProfile) return;
      
      try {
        const text = await navigator.clipboard.readText();
        if (
          text.includes('open.spotify.com/user/') ||
          text.startsWith('spotify:user:')
        ) {
          setUsernameInput(text);
        }
      } catch {
        // Clipboard access denied - silent fail (expected on many browsers)
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkClipboard();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [usernameInput, selectedProfile]);

  const handleLookup = useCallback(async () => {
    if (!usernameInput.trim()) {
      setError('Please enter a username or profile URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/spotify/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: usernameInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User not found');
      }

      // Save profile to localStorage for future visits
      try {
        localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(data.user));
      } catch {
        // localStorage might be full or disabled
      }

      onProfileSelect(data.user);
      setShowSavedOption(false);
    } catch (err) {
      console.error('Lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to find user. Please check the username.');
    } finally {
      setIsLoading(false);
    }
  }, [usernameInput, onProfileSelect]);

  const handleUseSavedProfile = useCallback(() => {
    if (savedProfile) {
      onProfileSelect(savedProfile);
      setShowSavedOption(false);
    }
  }, [savedProfile, onProfileSelect]);

  const handleDifferentProfile = useCallback(() => {
    setShowSavedOption(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLookup();
    }
  };

  const handleClearSelection = () => {
    onProfileSelect(null as unknown as SpotifyUserSearchResult);
    setUsernameInput('');
    setError(null);
  };

  // If a profile is selected, show it
  if (selectedProfile) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedProfile.images?.[0]?.url ? (
              <img
                src={selectedProfile.images[0].url}
                alt={selectedProfile.display_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xl">
                  {selectedProfile.display_name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-white">{selectedProfile.display_name}</p>
              <p className="text-sm text-white/60">@{selectedProfile.id}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
          >
            Change
          </Button>
        </div>
      </Card>
    );
  }

  // Show saved profile option if available
  if (showSavedOption && savedProfile) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm text-white/60 mb-3">Welcome back! Use your saved profile?</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {savedProfile.images?.[0]?.url ? (
                <img
                  src={savedProfile.images[0].url}
                  alt={savedProfile.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xl">
                    {savedProfile.display_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold text-white">{savedProfile.display_name}</p>
                <p className="text-sm text-white/60">@{savedProfile.id}</p>
              </div>
            </div>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button
            onClick={handleUseSavedProfile}
            className="flex-1"
          >
            Use This Profile
          </Button>
          <Button
            onClick={handleDifferentProfile}
            variant="ghost"
            className="flex-1"
          >
            Different Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="Your Spotify username or profile URL"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          onKeyDown={handleKeyDown}
          error={error || undefined}
        />
        <div className="flex items-center justify-between text-xs py-2 px-2">
          <a
            href="spotify://user"
            className="text-[#1DB954] hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Open Spotify App
          </a>
          <span className="text-white/40">
            Tap Share → Copy link
          </span>
        </div>
      </div>

      <Button
        onClick={handleLookup}
        isLoading={isLoading}
        disabled={!usernameInput.trim()}
        className="w-full"
      >
        Find Profile
      </Button>
    </div>
  );
}
