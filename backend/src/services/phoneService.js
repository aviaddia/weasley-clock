/**
 * Phone validation service.
 *
 * Two layers:
 *  1. Local format check via libphonenumber-js (always runs).
 *  2. Optional carrier/reachability check via a configurable external API.
 *     Set env vars PHONE_VALIDATION_API_URL and PHONE_VALIDATION_API_KEY
 *     to enable (e.g. NumVerify: http://apilayer.net/api/validate).
 */
const { isValidPhoneNumber, parsePhoneNumber } = require('libphonenumber-js');
const axios = require('axios');

function validateFormat(phone) {
  try {
    return isValidPhoneNumber(phone);
  } catch {
    return false;
  }
}

async function checkReachability(phone) {
  const apiUrl = process.env.PHONE_VALIDATION_API_URL;
  const apiKey = process.env.PHONE_VALIDATION_API_KEY;

  if (!apiUrl || !apiKey) {
    // No external API configured – return format-only result
    return { valid: validateFormat(phone), reachable: null, carrier: null };
  }

  try {
    const resp = await axios.get(apiUrl, {
      params: { number: phone, access_key: apiKey },
      timeout: 5000,
    });
    return {
      valid: resp.data.valid === true,
      reachable: resp.data.line_type != null,
      carrier: resp.data.carrier || null,
    };
  } catch (err) {
    console.error('Phone validation API error:', err.message);
    return { valid: validateFormat(phone), reachable: null, carrier: null };
  }
}

module.exports = { validateFormat, checkReachability };
