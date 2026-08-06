const express = require('express');
const clockLocationService = require('../services/clockLocationService');

const router = express.Router();

// GET /api/clock-locations
router.get('/', (req, res) => {
  res.json(clockLocationService.getAll());
});

// PUT /api/clock-locations/:id
router.put('/:id', (req, res) => {
  const existing = clockLocationService.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Clock location not found' });
  }

  try {
    const updated = clockLocationService.update(req.params.id, req.body || {});
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid payload' });
  }
});

module.exports = router;