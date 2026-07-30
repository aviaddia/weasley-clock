const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded images
const DATA_PATH = process.env.DATA_PATH || '/data';
app.use('/uploads', express.static(path.join(DATA_PATH, 'uploads')));

// Routes
app.use('/api/people', require('./routes/people'));
app.use('/api/locations', require('./routes/locations'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Weasley Clock backend running on port ${PORT}`));
