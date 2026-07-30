/**
 * Simple JSON file-backed in-memory store.
 * For production, replace with a proper database (Postgres, DynamoDB, etc.)
 * Persists to DATA_PATH/people.json so data survives pod restarts when using a PVC.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || '/data';
const STORE_FILE = path.join(DATA_PATH, 'people.json');

// Ensure data directory exists at startup
fs.mkdirSync(DATA_PATH, { recursive: true });

let people = [];

try {
  if (fs.existsSync(STORE_FILE)) {
    people = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load store file, starting fresh:', e.message);
  people = [];
}

function persist() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(people, null, 2));
  } catch (e) {
    console.error('Failed to persist store:', e.message);
  }
}

module.exports = {
  getAll: () => [...people],
  getById: (id) => people.find((p) => p.id === id) || null,
  add(person) {
    people.push(person);
    persist();
    return person;
  },
  remove(id) {
    const idx = people.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    people.splice(idx, 1);
    persist();
    return true;
  },
};
