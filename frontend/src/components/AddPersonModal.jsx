import React, { useState, useRef } from 'react';

export default function AddPersonModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required');
    if (!phone.trim()) return setError('Phone number is required');

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('phone', phone.trim());
    if (file) formData.append('image', file);

    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Add Family Member</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Ron Weasley"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone Number{' '}
              <small style={{ fontWeight: 400 }}>(international format, e.g. +447911123456)</small>
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Photo (optional)</label>
            <div
              className="photo-drop"
              onClick={() => fileRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="photo-preview" />
              ) : (
                <span>Click to upload a photo</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add to Clock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
