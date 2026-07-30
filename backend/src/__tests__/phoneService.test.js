const { validateFormat, checkReachability } = require('../services/phoneService');

describe('phoneService › validateFormat', () => {
  test('accepts valid UK E.164 number', () => {
    expect(validateFormat('+447911123456')).toBe(true);
  });

  test('accepts valid US E.164 number', () => {
    expect(validateFormat('+15551234567')).toBe(true);
  });

  test('accepts valid Israeli E.164 number', () => {
    expect(validateFormat('+972521234567')).toBe(true);
  });

  test('rejects number missing country code', () => {
    expect(validateFormat('07911123456')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(validateFormat('')).toBe(false);
  });

  test('rejects letters', () => {
    expect(validateFormat('+1abcdefghij')).toBe(false);
  });

  test('rejects too-short number', () => {
    expect(validateFormat('+123')).toBe(false);
  });
});

describe('phoneService › checkReachability (no external API)', () => {
  beforeEach(() => {
    delete process.env.PHONE_VALIDATION_API_URL;
    delete process.env.PHONE_VALIDATION_API_KEY;
  });

  test('valid phone → valid:true, reachable:null when no API configured', async () => {
    const result = await checkReachability('+447911123456');
    expect(result.valid).toBe(true);
    expect(result.reachable).toBeNull();
    expect(result.carrier).toBeNull();
  });

  test('invalid phone → valid:false when no API configured', async () => {
    const result = await checkReachability('not-a-phone');
    expect(result.valid).toBe(false);
  });
});
