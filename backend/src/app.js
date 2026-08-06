const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded images
const DATA_PATH = process.env.DATA_PATH || '/data';
app.use('/uploads', express.static(path.join(DATA_PATH, 'uploads')));

let startupComplete = false;

async function initializeBackend() {
  // Ensure data directories exist before reporting startup readiness.
  await fsPromises.mkdir(path.join(DATA_PATH, 'uploads'), { recursive: true });
  startupComplete = true;
}

initializeBackend().catch((error) => {
  console.error('Backend startup initialization failed:', error);
});

// Routes
app.use('/api/people', require('./routes/people'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/clock-locations', require('./routes/clockLocations'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', startupComplete }));

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/startup', (req, res) => {
  if (!startupComplete) {
    return res.status(503).json({ status: 'starting' });
  }

  return res.json({ status: 'started' });
});

app.get('/health/ready', async (req, res) => {
  if (!startupComplete) {
    return res.status(503).json({ status: 'starting' });
  }

  try {
    await fsPromises.access(DATA_PATH, fs.constants.R_OK | fs.constants.W_OK);
    return res.json({ status: 'ready' });
  } catch (error) {
    return res.status(503).json({ status: 'not-ready', reason: 'data-path-unavailable' });
  }
});

// Only start listening when run directly (not when required by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Weasley Clock backend running on port ${PORT}`));
}

module.exports = app;
