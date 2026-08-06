import React, { useState, useEffect, useCallback } from 'react';
import WeasleyClock from './components/WeasleyClock';
import AddPersonModal from './components/AddPersonModal';
import EditLocationsModal from './components/EditLocationsModal';

const REFRESH_INTERVAL = 30_000; // 30 s

export default function App() {
  const [locations, setLocations] = useState([]);
  const [clockLocations, setClockLocations] = useState([]);
  const [people, setPeople] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLocations(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(`Could not fetch locations: ${e.message}`);
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPeople(await res.json());
    } catch (e) {
      setError(`Could not fetch people: ${e.message}`);
    }
  }, []);

  const fetchClockLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/clock-locations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setClockLocations(await res.json());
    } catch (e) {
      setError(`Could not fetch clock locations: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
    fetchLocations();
    fetchClockLocations();
    const timer = setInterval(fetchLocations, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchPeople, fetchLocations, fetchClockLocations]);

  async function handleAddPerson(formData) {
    const res = await fetch('/api/people', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    await fetchPeople();
    await fetchLocations();
  }

  async function handleRemovePerson(id) {
    await fetch(`/api/people/${id}`, { method: 'DELETE' });
    await fetchPeople();
    await fetchLocations();
  }

  async function handleSaveClockLocations(updated) {
    const responses = await Promise.all(
      updated.map((slot) =>
        fetch(`/api/clock-locations/${slot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: slot.name, coordinates: slot.coordinates }),
        })
      )
    );

    const failed = responses.find((r) => !r.ok);
    if (failed) {
      const body = await failed.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${failed.status}`);
    }

    await fetchClockLocations();
    await fetchLocations();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">The Weasley Clock</h1>
        <p className="app-subtitle">Always know where your family is</p>
      </header>

      <main className="app-main">
        <WeasleyClock locations={locations} clockLocations={clockLocations} />

        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Family Members</h2>
            <div className="sidebar-actions">
              <button className="btn-add" onClick={() => setShowModal(true)}>
                + Add Person
              </button>
              <button
                className="btn-add btn-add-secondary"
                onClick={() => setShowLocationsModal(true)}
              >
                Edit Locations
              </button>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <ul className="person-list">
            {people.map((p) => (
              <li key={p.id} className="person-item">
                <div className="person-avatar">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} />
                  ) : (
                    <span>{p.name[0]}</span>
                  )}
                </div>
                <div className="person-info">
                  <strong>{p.name}</strong>
                  <small>{p.phone}</small>
                  {p.reachable === false && (
                    <span className="badge badge-unreachable">Unreachable</span>
                  )}
                </div>
                <button
                  className="btn-remove"
                  onClick={() => handleRemovePerson(p.id)}
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))}
            {people.length === 0 && (
              <li className="empty-hint">No family members yet. Add one!</li>
            )}
          </ul>

          {lastUpdated && (
            <p className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </aside>
      </main>

      {showModal && (
        <AddPersonModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddPerson}
        />
      )}

      {showLocationsModal && (
        <EditLocationsModal
          locations={clockLocations}
          onClose={() => setShowLocationsModal(false)}
          onSave={handleSaveClockLocations}
        />
      )}
    </div>
  );
}
