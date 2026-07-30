/**
 * Integration tests for the People API routes.
 * Uses supertest to exercise the full Express stack.
 * DATA_PATH is pointed at a temp directory so no real /data access is needed.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

// Must be set before any app module is required
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weasley-people-'));
process.env.DATA_PATH = tmpDir;

const request = require('supertest');
const app = require('../../app');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/people', () => {
  test('returns 200 and an array', async () => {
    const res = await request(app).get('/api/people');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/people', () => {
  test('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/people')
      .field('phone', '+447911123456');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  test('rejects missing phone', async () => {
    const res = await request(app)
      .post('/api/people')
      .field('name', 'Ron Weasley');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });

  test('rejects invalid phone format', async () => {
    const res = await request(app)
      .post('/api/people')
      .field('name', 'Ron Weasley')
      .field('phone', 'not-a-phone');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid phone/i);
  });

  test('creates a person with valid data', async () => {
    const res = await request(app)
      .post('/api/people')
      .field('name', 'Hermione Granger')
      .field('phone', '+447700900123');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Hermione Granger');
    expect(res.body.phone).toBe('+447700900123');
  });
});

describe('DELETE /api/people/:id', () => {
  test('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/people/nonexistent-id');
    expect(res.status).toBe(404);
  });

  test('deletes an existing person', async () => {
    // First create
    const create = await request(app)
      .post('/api/people')
      .field('name', 'Harry Potter')
      .field('phone', '+447700900456');
    const { id } = create.body;

    // Then delete
    const del = await request(app).delete(`/api/people/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    // Confirm gone
    const list = await request(app).get('/api/people');
    expect(list.body.find((p) => p.id === id)).toBeUndefined();
  });
});

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
