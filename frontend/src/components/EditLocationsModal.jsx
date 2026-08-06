import React, { useMemo, useState } from 'react';
import { DEFAULT_CLOCK_LOCATIONS } from './WeasleyClock';

function toInputValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return String(value);
}

function buildMapUrl({ name, lat, lng }) {
  if (lat !== '' && lng !== '') {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(name || 'location')}`;
}

function buildMapEmbedUrl({ name, lat, lng }) {
  if (lat !== '' && lng !== '') {
    return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=13&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(name || 'location')}&z=13&output=embed`;
}

function validateRows(rows) {
  for (const row of rows) {
    if (!row.name.trim()) {
      return 'Location name cannot be empty';
    }

    const hasLat = row.lat !== '';
    const hasLng = row.lng !== '';
    if (hasLat !== hasLng) {
      return `Please set both latitude and longitude for ${row.name}`;
    }

    if (hasLat && hasLng) {
      const latNum = Number(row.lat);
      const lngNum = Number(row.lng);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return `Coordinates for ${row.name} must be numbers`;
      }
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return `Coordinates for ${row.name} are out of range`;
      }
    }
  }

  return null;
}

export default function EditLocationsModal({ locations, onClose, onSave }) {
  const sourceLocations = Array.isArray(locations) && locations.length > 0
    ? locations
    : DEFAULT_CLOCK_LOCATIONS;

  const [rows, setRows] = useState(() =>
    sourceLocations.map((loc) => ({
      id: loc.id,
      name: loc.name || '',
      lat: toInputValue(loc.coordinates?.lat),
      lng: toInputValue(loc.coordinates?.lng),
    }))
  );
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(true);

  const hasChanges = useMemo(() => {
    return rows.some((row, i) => {
      const source = sourceLocations[i];
      const sourceLat = toInputValue(source.coordinates?.lat);
      const sourceLng = toInputValue(source.coordinates?.lng);
      return row.name !== source.name || row.lat !== sourceLat || row.lng !== sourceLng;
    });
  }, [rows, sourceLocations]);

  function updateRow(id, patch) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const validationError = validateRows(rows);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = rows.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      coordinates:
        row.lat === '' || row.lng === ''
          ? null
          : { lat: Number(row.lat), lng: Number(row.lng) },
    }));

    setLoading(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save locations');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Edit Clock Locations</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="location-editor-toolbar">
            <p className="location-editor-hint">
              Edit each slot label and set optional coordinates. Open Google Maps to copy coordinates into the fields.
            </p>
            <button
              type="button"
              className="btn-toggle-preview"
              onClick={() => setShowMapPreview((prev) => !prev)}
            >
              {showMapPreview ? 'Hide Map Preview' : 'Show Map Preview'}
            </button>
          </div>

          <div className="location-editor-list">
            {rows.map((row) => (
              <div key={row.id} className="location-editor-row">
                <div className="location-editor-name">
                  <label htmlFor={`loc-name-${row.id}`}>Label</label>
                  <input
                    id={`loc-name-${row.id}`}
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                </div>

                <div className="location-editor-coord">
                  <label htmlFor={`loc-lat-${row.id}`}>Latitude</label>
                  <input
                    id={`loc-lat-${row.id}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 31.7683"
                    value={row.lat}
                    onChange={(e) => updateRow(row.id, { lat: e.target.value })}
                  />
                </div>

                <div className="location-editor-coord">
                  <label htmlFor={`loc-lng-${row.id}`}>Longitude</label>
                  <input
                    id={`loc-lng-${row.id}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 35.2137"
                    value={row.lng}
                    onChange={(e) => updateRow(row.id, { lng: e.target.value })}
                  />
                </div>

                <div className="location-editor-actions">
                  <a
                    className="btn-map"
                    href={buildMapUrl(row)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                  <button
                    type="button"
                    className="btn-clear-coords"
                    onClick={() => updateRow(row.id, { lat: '', lng: '' })}
                  >
                    Clear
                  </button>
                </div>

                {showMapPreview && (
                  <div className="location-map-preview">
                    <iframe
                      src={buildMapEmbedUrl(row)}
                      title={`Map preview for ${row.name || row.id}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !hasChanges}>
              {loading ? 'Saving…' : 'Save Locations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
