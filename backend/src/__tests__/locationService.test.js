const { getPhoneLocation, LOCATIONS } = require('../services/locationService');

describe('locationService › mock mode (no LOCATION_API_URL)', () => {
  beforeEach(() => {
    delete process.env.LOCATION_API_URL;
    delete process.env.LOCATION_API_KEY;
  });

  test('LOCATIONS exports exactly 8 entries', () => {
    expect(LOCATIONS).toHaveLength(8);
  });

  test('returns a location that exists in LOCATIONS list', async () => {
    const result = await getPhoneLocation('+447911123456');
    expect(LOCATIONS).toContain(result.location);
  });

  test('marks phone as reachable in mock mode', async () => {
    const result = await getPhoneLocation('+15551234567');
    expect(result.reachable).toBe(true);
  });

  test('sets mock:true flag in mock mode', async () => {
    const result = await getPhoneLocation('+447911123456');
    expect(result.mock).toBe(true);
  });

  test('same phone always returns the same location (deterministic)', async () => {
    const phone = '+972521234567';
    const r1 = await getPhoneLocation(phone);
    const r2 = await getPhoneLocation(phone);
    expect(r1.location).toBe(r2.location);
  });

  test('different phones can return different locations', async () => {
    // Run over a sample and collect unique locations; shouldn't all be identical
    const phones = ['+1', '+44', '+972', '+33', '+49', '+81', '+86', '+55'];
    const results = await Promise.all(phones.map(getPhoneLocation));
    const unique = new Set(results.map((r) => r.location));
    expect(unique.size).toBeGreaterThan(1);
  });
});
