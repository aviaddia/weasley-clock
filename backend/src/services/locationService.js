/**
 * Location triangulation service.
 *
 * In production, set LOCATION_API_URL + LOCATION_API_KEY to a real
 * carrier-grade or third-party location API (e.g. Unwired Labs, Twilio,
 * or your own mobile-app location reporting endpoint).
 *
 * Without those env vars the service runs in MOCK mode, returning a
 * deterministic pseudo-random location derived from the phone number –
 * useful for local dev and demos.
 */
const axios = require('axios');
const { DEFAULT_CLOCK_LOCATIONS } = require('./clockLocationService');

const LOCATIONS = DEFAULT_CLOCK_LOCATIONS.map((slot) => slot.name);

/**
 * Returns { location: string, reachable: boolean, coordinates: {lat,lng}|null }
 */
async function getPhoneLocation(phone) {
  const apiUrl = process.env.LOCATION_API_URL;
  const apiKey = process.env.LOCATION_API_KEY;

  if (!apiUrl) {
    return mockLocation(phone);
  }

  try {
    const resp = await axios.post(
      apiUrl,
      { phone },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 8000,
      }
    );
    return normalizeResponse(resp.data);
  } catch (err) {
    console.error(`Location API error for ${phone}:`, err.message);
    return { location: 'Lost', reachable: false, coordinates: null };
  }
}

/**
 * Normalise external API payload into our standard shape.
 * Adjust the field mappings to match your chosen provider.
 */
function normalizeResponse(data) {
  return {
    location: data.location || data.status || 'Traveling',
    locationId: data.locationId || null,
    reachable: data.reachable !== false,
    coordinates: data.lat && data.lng ? { lat: data.lat, lng: data.lng } : null,
  };
}

/**
 * Deterministic mock: same phone always returns the same location
 * so the UI is stable during development.
 */
function mockLocation(phone) {
  const hash = phone
    .replace(/\D/g, '')
    .split('')
    .reduce((acc, ch) => acc + Number(ch), 0);
  const slot = DEFAULT_CLOCK_LOCATIONS[hash % DEFAULT_CLOCK_LOCATIONS.length];
  return {
    location: slot.name,
    locationId: slot.id,
    reachable: true,
    coordinates: null,
    mock: true,
  };
}

module.exports = { getPhoneLocation, LOCATIONS };
