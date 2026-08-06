const express = require('express');
const store = require('../store');
const { getPhoneLocation } = require('../services/locationService');
const clockLocationService = require('../services/clockLocationService');

const router = express.Router();

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function resolveClockLocation(raw, slots) {
  if (!raw || !Array.isArray(slots) || slots.length === 0) {
    return null;
  }

  if (raw.locationId) {
    const byId = slots.find((slot) => slot.id === raw.locationId);
    if (byId) return byId;
  }

  const wanted = normalizeKey(raw.location);
  if (!wanted) return null;

  return (
    slots.find((slot) => normalizeKey(slot.name) === wanted || normalizeKey(slot.id) === wanted) ||
    null
  );
}

function mergeLocationData(person, loc, slots) {
  const resolvedSlot = resolveClockLocation(loc, slots);
  return {
    id: person.id,
    name: person.name,
    imageUrl: person.imageUrl,
    phone: person.phone,
    ...loc,
    locationId: resolvedSlot ? resolvedSlot.id : loc.locationId || null,
    location: resolvedSlot ? resolvedSlot.name : loc.location,
    slotCoordinates: resolvedSlot ? resolvedSlot.coordinates : null,
  };
}

// GET /api/locations  – returns current location for every tracked person
router.get('/', async (req, res) => {
  const people = store.getAll();
  const slots = clockLocationService.getAll();

  const results = await Promise.allSettled(
    people.map(async (person) => {
      const loc = await getPhoneLocation(person.phone);
      return mergeLocationData(person, loc, slots);
    })
  );

  res.json(
    results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { error: r.reason?.message || 'Unknown error' }
    )
  );
});

// GET /api/locations/:id  – location for a single person
router.get('/:id', async (req, res) => {
  const person = store.getById(req.params.id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  const slots = clockLocationService.getAll();
  const loc = await getPhoneLocation(person.phone);
  res.json(mergeLocationData(person, loc, slots));
});

module.exports = router;
