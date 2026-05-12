import { writable, get } from 'svelte/store';
import { getStoredProfile, getStoredTokens, clearSpotifySession, fetchSpotifyProfile, getValidAccessToken, checkScopeVersion } from '$lib/spotifyAuth';
import type { SpotifyProfile } from '$lib/spotifyAuth';

function createSpotifyStore() {
  const connected = writable(false);
  const profile = writable<SpotifyProfile|null>(null);
  const accessToken = writable<string|null>(null);
  const isPremium = writable(false);

  async function hydrate() {
    // Force re-auth if scopes changed since last login
    if (!checkScopeVersion()) {
      connected.set(false);
      return;
    }
    const { accessToken: at } = getStoredTokens();
    if (!at) return;
    const token = await getValidAccessToken();
    if (!token) return;
    const cached = getStoredProfile();
    if (cached) { connected.set(true); profile.set(cached); accessToken.set(token); isPremium.set(cached.product === 'premium'); }
    try {
      const p = await fetchSpotifyProfile(token);
      connected.set(true); profile.set(p); accessToken.set(token); isPremium.set(p.product === 'premium');
    } catch { clearSpotifySession(); connected.set(false); profile.set(null); accessToken.set(null); isPremium.set(false); }
  }

  async function onConnected(at: string) {
    try {
      const p = await fetchSpotifyProfile(at);
      connected.set(true); profile.set(p); accessToken.set(at); isPremium.set(p.product === 'premium');
    } catch { clearSpotifySession(); }
  }

  function disconnect() {
    clearSpotifySession();
    connected.set(false); profile.set(null); accessToken.set(null); isPremium.set(false);
  }

  return { connected, profile, accessToken, isPremium, hydrate, onConnected, disconnect,
    getAccessToken: () => get(accessToken), getIsPremium: () => get(isPremium) };
}

export const spotifyStore = createSpotifyStore();
