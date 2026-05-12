import { create } from 'zustand';
import {
  getStoredProfile,
  getStoredTokens,
  clearSpotifySession,
  fetchSpotifyProfile,
  getValidAccessToken,
  type SpotifyProfile,
} from '@/lib/spotifyAuth';

interface SpotifyState {
  connected: boolean;
  profile: SpotifyProfile | null;
  accessToken: string | null;
  isPremium: boolean;
  /** Call once on app boot to restore session from localStorage */
  hydrate: () => Promise<void>;
  /** Called after successful OAuth code exchange */
  onConnected: (accessToken: string) => Promise<void>;
  disconnect: () => void;
}

export const useSpotifyStore = create<SpotifyState>((set) => ({
  connected: false,
  profile: null,
  accessToken: null,
  isPremium: false,

  hydrate: async () => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) return;

    // Try to get a valid token (refreshes if needed)
    const token = await getValidAccessToken();
    if (!token) return;

    // Restore profile from cache first for instant UI
    const cached = getStoredProfile();
    if (cached) {
      set({
        connected: true,
        profile: cached,
        accessToken: token,
        isPremium: cached.product === 'premium',
      });
    }

    // Then refresh profile in background
    try {
      const profile = await fetchSpotifyProfile(token);
      set({
        connected: true,
        profile,
        accessToken: token,
        isPremium: profile.product === 'premium',
      });
    } catch {
      // Token may be invalid — clear session
      clearSpotifySession();
      set({ connected: false, profile: null, accessToken: null, isPremium: false });
    }
  },

  onConnected: async (accessToken: string) => {
    try {
      const profile = await fetchSpotifyProfile(accessToken);
      set({
        connected: true,
        profile,
        accessToken,
        isPremium: profile.product === 'premium',
      });
    } catch {
      clearSpotifySession();
    }
  },

  disconnect: () => {
    clearSpotifySession();
    set({ connected: false, profile: null, accessToken: null, isPremium: false });
  },
}));
