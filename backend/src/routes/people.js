const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { validateFormat, checkReachability } = require('../services/phoneService');

const router = express.Router();

// Ensure upload directory exists
const DATA_PATH = process.env.DATA_PATH || '/data';
const UPLOAD_DIR = path.join(DATA_PATH, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are accepted'));
  },
});

// GET /api/people
router.get('/', (req, res) => {
  res.json(store.getAll());
});

// POST /api/people  (multipart/form-data: name, phone, image?)
router.post('/', upload.single('image'), async (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  if (!validateFormat(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format. Use E.164 e.g. +447911123456' });
  }

  const validation = await checkReachability(phone);

  const person = {
    id: uuidv4(),
    name: name.trim(),
    phone,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    valid: validation.valid,
    reachable: validation.reachable,
    carrier: validation.carrier,
    createdAt: new Date().toISOString(),
  };

  store.add(person);
  res.status(201).json(person);
});

// DELETE /api/people/:id
router.delete('/:id', (req, res) => {
  // Also delete the uploaded image file if it exists
  const person = store.getById(req.params.id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  if (person.imageUrl) {
    const filePath = path.join(DATA_PATH, person.imageUrl);
    fs.unlink(filePath, () => {}); // best-effort
  }

  store.remove(req.params.id);
  res.json({ success: true });
});

module.exports = router;
