const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || '/data';
const STORE_FILE = path.join(DATA_PATH, 'clock-locations.json');

const DEFAULT_CLOCK_LOCATIONS = [
  { id: 'home', name: 'Home', coordinates: null },
  { id: 'work', name: 'Work', coordinates: null },
  { id: 'school', name: 'School', coordinates: null },
  { id: 'hospital', name: 'Hospital', coordinates: null },
  { id: 'traveling', name: 'Traveling', coordinates: null },
  { id: 'lost', name: 'Lost', coordinates: null },
  { id: 'mortal-peril', name: 'Mortal Peril', coordinates: null },
  { id: 'prison', name: 'Prison', coordinates: null },
];

fs.mkdirSync(DATA_PATH, { recursive: true });

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeCoordinates(coordinates) {
  if (coordinates == null) return null;

  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

function normalizeLocation(input, fallback) {
  const id = String(input?.id || fallback.id);
  const rawName = String(input?.name ?? fallback.name).trim();
  const name = rawName || fallback.name;
  const coordinates = normalizeCoordinates(input?.coordinates ?? fallback.coordinates);
  return { id, name, coordinates };
}

function alignToDefaultSlots(incoming) {
  const byId = new Map((incoming || []).map((loc) => [loc.id, loc]));
  return DEFAULT_CLOCK_LOCATIONS.map((slot) => normalizeLocation(byId.get(slot.id), slot));
}

function loadInitialState() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return deepClone(DEFAULT_CLOCK_LOCATIONS);
    }
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!Array.isArray(parsed)) {
      return deepClone(DEFAULT_CLOCK_LOCATIONS);
    }
    return alignToDefaultSlots(parsed);
  } catch (err) {
    console.warn('Could not load clock locations store, using defaults:', err.message);
    return deepClone(DEFAULT_CLOCK_LOCATIONS);
  }
}

let locations = loadInitialState();

function persist() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(locations, null, 2));
}

module.exports = {
  DEFAULT_CLOCK_LOCATIONS,
  getAll() {
    return deepClone(locations);
  },
  getById(id) {
    return locations.find((loc) => loc.id === id) || null;
  },
  update(id, updates = {}) {
    const idx = locations.findIndex((loc) => loc.id === id);
    if (idx === -1) return null;

    const existing = locations[idx];
    const nextName = updates.name === undefined ? existing.name : String(updates.name).trim();
    if (!nextName) {
      throw new Error('Location name cannot be empty');
    }

    let nextCoordinates = existing.coordinates;
    if (Object.prototype.hasOwnProperty.call(updates, 'coordinates')) {
      if (updates.coordinates == null || updates.coordinates === '') {
        nextCoordinates = null;
      } else {
        const normalized = normalizeCoordinates(updates.coordinates);
        if (!normalized) {
          throw new Error('Coordinates must include valid lat/lng values');
        }
        nextCoordinates = normalized;
      }
    }

    const updated = {
      ...existing,
      name: nextName,
      coordinates: nextCoordinates,
    };

    locations[idx] = updated;
    persist();
    return deepClone(updated);
  },
};