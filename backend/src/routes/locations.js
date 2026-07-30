const express = require('express');
const store = require('../store');
const { getPhoneLocation } = require('../services/locationService');

const router = express.Router();

// GET /api/locations  – returns current location for every tracked person
router.get('/', async (req, res) => {
  const people = store.getAll();

  const results = await Promise.allSettled(
    people.map(async (person) => {
      const loc = await getPhoneLocation(person.phone);
      return {
        id: person.id,
        name: person.name,
        imageUrl: person.imageUrl,
        phone: person.phone,
        ...loc,
      };
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

  const loc = await getPhoneLocation(person.phone);
  res.json({ id: person.id, name: person.name, imageUrl: person.imageUrl, ...loc });
});

module.exports = router;
