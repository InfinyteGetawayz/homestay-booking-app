import React, { useState, useEffect } from 'react';
import { Shield, Bell, Download, RefreshCw, AlertTriangle, Key, Plus, Trash2, Settings as SetIcon } from 'lucide-react';
import { API_BASE } from '../apiBase';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Settings({ token, onLogout }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState({ type: '', text: '' });

  const [globalMute, setGlobalMute] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupMessage, setBackupMessage] = useState({ type: '', text: '' });

  // Dynamic Property Registry States
  const [properties, setProperties] = useState([]);
  const [newPropName, setNewPropName] = useState('');
  const [newPropId, setNewPropId] = useState('');
  const [deletePropId, setDeletePropId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // Room Configuration States
  const [selectedPropId, setSelectedPropId] = useState('');
  const [roomConfigString, setRoomConfigString] = useState('');
  const [propertyMessage, setPropertyMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // Check if service worker & push notifications are supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      checkPushSubscription();
    }
    fetchSettings();
    fetchBackups();
    fetchProperties();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.globalMuteReminders !== undefined) {
        setGlobalMute(data.globalMuteReminders);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch(`${API_BASE}/properties`);
      const data = await res.json();
      setProperties(data);
      localStorage.setItem('properties_cache', JSON.stringify(data));
      if (data.length > 0 && !selectedPropId) {
        setSelectedPropId(data[0].id);
        setRoomConfigString(data[0].rooms.join(', '));
      }
    } catch (e) {
      console.error('Failed to fetch properties:', e);
      const cached = JSON.parse(localStorage.getItem('properties_cache') || '[]');
      setProperties(cached);
    }
  };

  const handleGlobalMuteToggle = async () => {
    const nextVal = !globalMute;
    setGlobalMute(nextVal);
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ globalMuteReminders: nextVal })
      });
    } catch (e) {
      setGlobalMute(!nextVal); // revert on error
    }
  };

  const checkPushSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(!!sub);
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
  };

  const handlePushToggle = async () => {
    if (!pushSupported) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch(`${API_BASE}/unsubscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
        }
        setPushEnabled(false);
      } else {
        // Request Permissions & Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Notification permissions were denied.');
          return;
        }

        const res = await fetch(`${API_BASE}/vapid-key`);
        const { publicKey } = await res.json();

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        await fetch(`${API_BASE}/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subscription })
        });
        setPushEnabled(true);
      }
    } catch (err) {
      console.error('Failed to toggle push notifications:', err);
      alert('Failed to register push subscription. Check server logs.');
    }
  };

  const handlePinChange = async (e) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setPinMessage({ type: 'error', text: 'New PINs do not match.' });
      return;
    }
    if (newPin.length < 4 || newPin.length > 6 || isNaN(Number(newPin))) {
      setPinMessage({ type: 'error', text: 'PIN must be a 4 to 6 digit number.' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json();
      if (res.ok) {
        setPinMessage({ type: 'success', text: 'PIN updated successfully!' });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setPinMessage({ type: 'error', text: data.error || 'Failed to update PIN.' });
      }
    } catch (err) {
      setPinMessage({ type: 'error', text: 'Server connection error.' });
    }
  };

  // Dynamic scaling handlers
  const handleEnlistProperty = async (e) => {
    e.preventDefault();
    setPropertyMessage({ type: '', text: '' });
    if (!newPropName.trim() || !newPropId.trim()) {
      return setPropertyMessage({ type: 'error', text: 'All fields are required.' });
    }
    if (newPropId.length !== 3) {
      return setPropertyMessage({ type: 'error', text: 'Property Code must be exactly 3 characters.' });
    }

    const payload = {
      id: newPropId.toUpperCase(),
      name: newPropName.trim(),
      rooms: []
    };

    try {
      const res = await fetch(`${API_BASE}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setPropertyMessage({ type: 'success', text: 'Property enlisted successfully!' });
        setNewPropName('');
        setNewPropId('');
        fetchProperties();
      } else {
        setPropertyMessage({ type: 'error', text: data.error || 'Failed to enlist property.' });
      }
    } catch (err) {
      setPropertyMessage({ type: 'error', text: 'Server connection error.' });
    }
  };

  const handleDeleteProperty = async (e) => {
    e.preventDefault();
    setPropertyMessage({ type: '', text: '' });
    if (!deletePropId) {
      return setPropertyMessage({ type: 'error', text: 'Select a property to delete.' });
    }
    if (!confirmDelete) {
      return setPropertyMessage({ type: 'error', text: 'Please check the safety confirmation box.' });
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${deletePropId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPropertyMessage({ type: 'success', text: 'Property removed successfully!' });
        setDeletePropId('');
        setConfirmDelete(false);
        fetchProperties();
      } else {
        setPropertyMessage({ type: 'error', text: data.error || 'Failed to delete property.' });
      }
    } catch (err) {
      setPropertyMessage({ type: 'error', text: 'Server connection error.' });
    }
  };

  const handlePropertyChangeForRooms = (propId) => {
    setSelectedPropId(propId);
    const prop = properties.find(p => p.id === propId);
    if (prop) {
      setRoomConfigString(prop.rooms.join(', '));
    }
  };

  const handleSaveRooms = async (e) => {
    e.preventDefault();
    setPropertyMessage({ type: '', text: '' });
    if (!selectedPropId) {
      return setPropertyMessage({ type: 'error', text: 'Select a property first.' });
    }

    // Split and sanitize room strings
    const rooms = roomConfigString
      .split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    try {
      const res = await fetch(`${API_BASE}/properties/${selectedPropId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rooms })
      });
      const data = await res.json();
      if (res.ok) {
        setPropertyMessage({ type: 'success', text: 'Room configurations updated successfully!' });
        fetchProperties();
      } else {
        setPropertyMessage({ type: 'error', text: data.error || 'Failed to save room config.' });
      }
    } catch (err) {
      setPropertyMessage({ type: 'error', text: 'Server connection error.' });
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(`${API_BASE}/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setBackups(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleDownloadBackup = (filename) => {
    fetch(`${API_BASE}/backups/download/${filename}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => alert('Failed to download backup.'));
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Are you absolutely sure you want to restore the backup: ${filename}? This will overwrite the current database!`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/backups/restore/${filename}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBackupMessage({ type: 'success', text: `Backup restored successfully! Current database is now updated.` });
        fetchBackups();
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Failed to restore backup.' });
      }
    } catch (e) {
      setBackupMessage({ type: 'error', text: 'Server connection error.' });
    }
  };

  const handleExportCSV = () => {
    fetch(`${API_BASE}/export-csv`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings_database_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => alert('Failed to export CSV database.'));
  };

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* SECTION 1: SYSTEM CONTROLS & CSV EXPORT */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Download size={20} /> Data Management
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Export your bookings directly as an Excel-reconcilable CSV file.
        </p>
        <button onClick={handleExportCSV} className="btn btn-primary" style={{ padding: '12px' }}>
          Export Database to CSV
        </button>
      </div>

      {/* SECTION 2: DYNAMIC PROPERTY REGISTRY ENGINE (US Version 1.1) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <SetIcon size={20} /> Property & Inventory Scaling
        </h2>

        {propertyMessage.text && (
          <div style={{ 
            fontSize: '0.8rem', 
            padding: '10px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '14px',
            backgroundColor: propertyMessage.type === 'success' ? 'rgba(13, 148, 136, 0.1)' : 'rgba(225, 29, 72, 0.1)',
            color: propertyMessage.type === 'success' ? '#0f766e' : '#be123c',
            border: `1px solid ${propertyMessage.type === 'success' ? 'rgba(13, 148, 136, 0.2)' : 'rgba(225, 29, 72, 0.2)'}`
          }}>
            {propertyMessage.text}
          </div>
        )}

        {/* Enlist New Property */}
        <form onSubmit={handleEnlistProperty} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Enlist New Homestay</h3>
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Property Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={newPropName}
                onChange={e => setNewPropName(e.target.value)}
                placeholder="e.g. Kolkata Hub"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>3-Letter Code (e.g. KOL)</label>
              <input 
                type="text" 
                maxLength={3}
                className="form-control" 
                value={newPropId}
                onChange={e => setNewPropId(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                placeholder="e.g. KOL"
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary" style={{ padding: '8px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Enlist Property
          </button>
        </form>

        {/* Delete Property */}
        {properties.length > 0 && (
          <form onSubmit={handleDeleteProperty} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Remove Homestay Property</h3>
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label>Select Homestay</label>
              <select 
                className="form-control"
                value={deletePropId}
                onChange={e => setDeletePropId(e.target.value)}
              >
                <option value="">-- Choose Property --</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '500' }}>
              <input 
                type="checkbox" 
                checked={confirmDelete}
                onChange={e => setConfirmDelete(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
              />
              <span>I confirm that removing this property deletes its room inventory layouts.</span>
            </label>

            <button type="submit" className="btn btn-rose" style={{ padding: '8px', fontSize: '0.85rem' }}>
              <Trash2 size={16} /> Remove Property
            </button>
          </form>
        )}

        {/* Configure Rooms */}
        {properties.length > 0 && (
          <form onSubmit={handleSaveRooms} style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Room Inventory Configuration</h3>
            
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label>Select Homestay</label>
              <select 
                className="form-control"
                value={selectedPropId}
                onChange={e => handlePropertyChangeForRooms(e.target.value)}
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 4 }}>
              <label>Room Labels (comma-separated)</label>
              <input 
                type="text" 
                className="form-control" 
                value={roomConfigString}
                onChange={e => setRoomConfigString(e.target.value)}
                placeholder="e.g. R1, R2, R3, L1"
                required
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Separate each room label with a comma.</p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ padding: '8px', fontSize: '0.85rem' }}>
              Save Room Configuration
            </button>
          </form>
        )}

      </div>

      {/* SECTION 3: ALERTS & REMINDERS */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Bell size={20} /> Notifications & Alerts
        </h2>
        
        <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '0.95rem', fontWeight: '600' }}>Global Mute Reminders</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mute all check-in notifications globally.</p>
          </div>
          <input 
            type="checkbox" 
            checked={globalMute} 
            onChange={handleGlobalMuteToggle}
            style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--text-primary)' }}
          />
        </div>

        {pushSupported ? (
          <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.95rem', fontWeight: '600' }}>Web Push Notifications</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {pushEnabled ? 'Subscribed on this device.' : 'Receive 3-day pre-arrival alerts.'}
              </p>
            </div>
            <button 
              onClick={handlePushToggle} 
              className={`btn ${pushEnabled ? 'btn-rose' : 'btn-teal'}`}
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
            >
              {pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-rose)' }}>
            ⚠️ Web Push is not supported in this browser. Use Chrome/Safari on mobile.
          </p>
        )}
      </div>

      {/* SECTION 4: SECURITY & PIN CHANGE */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Shield size={20} /> Security Settings
        </h2>
        
        <form onSubmit={handlePinChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Current Login PIN</label>
            <input 
              type="password" 
              maxLength={6}
              className="form-control" 
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>New PIN (4-6 digits)</label>
              <input 
                type="password" 
                maxLength={6}
                className="form-control" 
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Confirm New PIN</label>
              <input 
                type="password" 
                maxLength={6}
                className="form-control" 
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>

          {pinMessage.text && (
            <p style={{ 
              fontSize: '0.8rem', 
              fontWeight: '600',
              color: pinMessage.type === 'success' ? 'var(--accent-teal)' : 'var(--accent-rose)' 
            }}>
              {pinMessage.text}
            </p>
          )}

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px', marginTop: '4px' }}>
            Update PIN Code
          </button>
        </form>
      </div>

      {/* SECTION 5: SERVER BACKUPS */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Key size={20} /> Local Server Backups
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          The server retains the last 50 database backups taken automatically before edits/saves.
        </p>

        {backupMessage.text && (
          <div style={{ 
            fontSize: '0.8rem', 
            padding: '10px', 
            borderRadius: 'var(--radius-sm)', 
            marginBottom: '14px',
            backgroundColor: backupMessage.type === 'success' ? 'rgba(13, 148, 136, 0.1)' : 'rgba(225, 29, 72, 0.1)',
            color: backupMessage.type === 'success' ? 'var(--accent-teal)' : 'var(--accent-rose)',
            border: `1px solid ${backupMessage.type === 'success' ? 'rgba(13, 148, 136, 0.2)' : 'rgba(225, 29, 72, 0.2)'}`
          }}>
            {backupMessage.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available Backups ({backups.length})</span>
          <button onClick={fetchBackups} disabled={loadingBackups} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className={loadingBackups ? 'spin-anim' : ''} /> Refresh
          </button>
        </div>

        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          {backups.length === 0 ? (
            <p style={{ padding: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No backups found.</p>
          ) : (
            backups.map(b => (
              <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                  <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{b.filename}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(b.createdAt).toLocaleString()} | {(b.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => handleDownloadBackup(b.filename)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                    Download
                  </button>
                  <button onClick={() => handleRestoreBackup(b.filename)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
                    Restore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* LOGOUT */}
      <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '14px', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)' }}>
        Logout from System
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
