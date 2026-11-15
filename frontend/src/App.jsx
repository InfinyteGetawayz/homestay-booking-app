import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import BookingDetails from './components/BookingDetails';
import CalendarScreen from './components/CalendarGrid';
import Expenses from './components/Expenses';
import Accounts from './components/Accounts';
import Settings from './components/Settings';
import BookingNotes from './components/BookingNotes';
import AnnualReport from './components/AnnualReport';
import { Home, PlusCircle, Lock, Wifi, WifiOff, ClipboardList, Menu, X } from 'lucide-react';
import { API_BASE } from './apiBase';

const isApiErrorResponse = (response) => response && !response.ok && response.status !== 0;
const LOCAL_PIN_KEY = 'local_app_pin';
const readLocalData = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Failed to read local storage key ${key}:`, error);
    return fallback;
  }
};
const writeLocalData = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};
const getLocalPin = () => localStorage.getItem(LOCAL_PIN_KEY) || '';
const setLocalPin = (pin) => localStorage.setItem(LOCAL_PIN_KEY, pin);
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [isPinSetup, setIsPinSetup] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [authStatusError, setAuthStatusError] = useState('');

  // Routing
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'add' | 'expenses' | 'accounts' | 'settings'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  // Data
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bookingsLoadError, setBookingsLoadError] = useState(false);
  const [propertiesLoadError, setPropertiesLoadError] = useState(false);

  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/') || '/';

  // 1. Initial Checks: auth status, offline listeners, and server refreshes
  useEffect(() => {
    checkPinStatus();
    
    const handleOnline = () => {
      setIsOffline(false);
      fetchProperties();
      fetchBookings();
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);
    const handleFocus = () => {
      if (isAuthenticated && navigator.onLine) {
        fetchProperties();
        fetchBookings();
        syncOfflineQueue();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isAuthenticated) {
      fetchProperties();
      if (navigator.onLine) {
        fetchBookings();
        syncOfflineQueue();
      }
    }
    const refreshInterval = isAuthenticated
      ? window.setInterval(() => {
          if (navigator.onLine) {
            fetchProperties();
            fetchBookings();
            syncOfflineQueue();
          }
        }, 30000)
      : null;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [isAuthenticated, token]);

  const checkPinStatus = async () => {
    const localPin = getLocalPin();
    const cachedB = readLocalData('bookings_cache', null);
    const cachedP = readLocalData('properties_cache', null);

    if (!navigator.onLine) {
      setIsPinSetup(Boolean(localPin));
      setAuthStatusError(localPin ? '' : 'The server is offline and no saved PIN is available on this device.');
      if (cachedB) setBookings(cachedB);
      if (cachedP) setProperties(cachedP);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth-status`);
      if (isApiErrorResponse(res)) {
        throw new Error(`Auth check failed with status ${res.status}`);
      }
      const data = await res.json();
      if (typeof data.isSetup !== 'boolean') {
        throw new Error('Auth status response is invalid.');
      }
      setIsPinSetup(data.isSetup);
      setAuthStatusError('');
    } catch (e) {
      console.error('Failed to check server PIN status:', e);
      setIsPinSetup(Boolean(localPin));
      setAuthStatusError('Unable to verify the server PIN. Do not initialize a new PIN; check the server connection and retry.');
      if (cachedB) setBookings(cachedB);
      if (cachedP) setProperties(cachedP);
    }
  };

  const fetchProperties = async () => {
    if (!navigator.onLine) {
      const cached = readLocalData('properties_cache', null);
      if (cached) setProperties(cached);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties`);
      if (isApiErrorResponse(res)) {
        throw new Error(`Properties request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Properties response was not a list.');
      setProperties(data);
      setPropertiesLoadError(false);
      localStorage.setItem('properties_cache', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to fetch properties:', e);
      setPropertiesLoadError(true);
      const cached = readLocalData('properties_cache', null);
      if (cached) setProperties(cached);
    }
  };

  const fetchBookings = async () => {
    if (!navigator.onLine) {
      const cached = readLocalData('bookings_cache', null);
      if (cached) {
        setBookings(cached);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      if (isApiErrorResponse(res)) {
        throw new Error(`Bookings request failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Bookings response was not a list.');
      setBookings(data);
      setSelectedBooking(current => current ? data.find(booking => booking.bookingId === current.bookingId) || null : null);
      setBookingsLoadError(false);
      localStorage.setItem('bookings_cache', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to fetch bookings:', e);
      setBookingsLoadError(true);
      const cached = readLocalData('bookings_cache', null);
      if (cached) setBookings(cached);
    }
  };

  const syncOfflineQueue = async () => {
    if (!token || token === 'local-mode') {
      return;
    }

    const queue = readLocalData('booking_sync_queue', []);
    if (queue.length === 0) return;

    setIsSyncing(true);
    const remainingQueue = [];
    let existingBookings = [];
    const needsExistingBookingCheck = queue.some(item => !item?.operation || item.operation === 'create');
    if (needsExistingBookingCheck) {
      try {
        const res = await fetch(`${API_BASE}/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Could not resolve queued bookings (${res.status}).`);
        existingBookings = await res.json();
      } catch (err) {
        console.error('Could not resolve legacy offline bookings:', err);
        setIsSyncing(false);
        return;
      }
    }

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      const queuedPayload = item?.operation ? item.payload : item;
      const legacyMatch = (!item?.operation || item.operation === 'create') && existingBookings.find(booking =>
        String(booking.mobileNumber || '') === String(queuedPayload.mobileNumber || '')
        && booking.checkInDate === queuedPayload.checkInDate
        && booking.checkOutDate === queuedPayload.checkOutDate
        && String(booking.roomSelection || '').split(',').map(room => room.trim()).sort().join(',')
          === String(queuedPayload.roomSelection || '').split(',').map(room => room.trim()).sort().join(',')
      );
      const isUpdate = (item?.operation === 'update' && item.bookingId && item.payload) || legacyMatch;
      const bookingId = item?.operation === 'update' ? item.bookingId : legacyMatch?.bookingId;
      const payload = queuedPayload;
      try {
        const res = await fetch(`${API_BASE}/bookings${isUpdate ? `/${encodeURIComponent(bookingId)}` : ''}`, {
          method: isUpdate ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          remainingQueue.push(item);
        }
      } catch (err) {
        console.error('Failed syncing offline booking:', err);
        remainingQueue.push(...queue.slice(index));
        break;
      }
    }

    localStorage.setItem('booking_sync_queue', JSON.stringify(remainingQueue));

    setIsSyncing(false);
    fetchBookings();
  };

  // 2. PIN login & Setup handlers
  const submitLogin = async (codeToSubmit = pinCode) => {
    if (!codeToSubmit) return;

    const localPin = getLocalPin();

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: codeToSubmit })
      });
      const data = await res.json();
      if (res.ok) {
        setLocalPin(codeToSubmit);
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        setPinCode('');
        return;
      }
      setLoginError(data.error || 'Incorrect PIN code.');
      setPinCode('');
    } catch (e) {
      if (localPin && codeToSubmit === localPin) {
        localStorage.setItem('auth_token', 'local-mode');
        setToken('local-mode');
        setIsAuthenticated(true);
        setPinCode('');
        return;
      }

      setLoginError('Server connection error. Local PIN not matched.');
      setPinCode('');
    }
  };

  const handleSetupPin = async (e) => {
    e.preventDefault();
    setSetupError('');
    if (setupPin !== setupConfirmPin) {
      return setSetupError('PINs do not match.');
    }
    if (setupPin.length < 4 || setupPin.length > 6 || isNaN(Number(setupPin))) {
      return setSetupError('PIN must be a 4 to 6 digit number.');
    }

    try {
      const res = await fetch(`${API_BASE}/setup-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: setupPin })
      });
      const data = await res.json();
      if (res.ok) {
        setLocalPin(setupPin);
        setIsPinSetup(true);
        alert('PIN configured successfully! You can now log in.');
      } else {
        setSetupError(data.error || 'PIN configuration failed.');
      }
    } catch (err) {
      setLocalPin(setupPin);
      setIsPinSetup(true);
      alert('Backend unavailable. Local static mode is active.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken('');
    setIsAuthenticated(false);
  };

  // 3. Booking list changes (add, update, delete)
  const handleBookingCreated = async (newBooking) => {
    const cachedBookings = readLocalData('bookings_cache', bookings);
    const nextBookings = [newBooking, ...cachedBookings.filter(booking => booking.bookingId !== newBooking.bookingId)];
    setBookings(nextBookings);
    writeLocalData('bookings_cache', nextBookings);
    setCurrentTab('dashboard');
    if (!String(newBooking.bookingId || '').includes('_OFFLINE_') && navigator.onLine && token && token !== 'local-mode') {
      await fetchBookings();
    }
  };

  const handleUpdateBooking = async (updatedBooking) => {
    const nextBookings = readLocalData('bookings_cache', bookings)
      .map(b => b.bookingId === updatedBooking.bookingId ? updatedBooking : b);
    setBookings(nextBookings);
    writeLocalData('bookings_cache', nextBookings);
    setSelectedBooking(updatedBooking);
    if (!String(updatedBooking.bookingId || '').includes('_OFFLINE_') && navigator.onLine && token && token !== 'local-mode') {
      await fetchBookings();
    }
  };

  const handleEditBooking = (booking) => {
    setSelectedBooking(null);
    setEditingBooking(booking);
    setCurrentTab('edit');
  };

  const handleDeleteBooking = async (bookingId) => {
    if (isOffline || !navigator.onLine || token === 'local-mode') {
      const nextBookings = bookings.filter(b => b.bookingId !== bookingId);
      setBookings(nextBookings);
      writeLocalData('bookings_cache', nextBookings);
      setSelectedBooking(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBookings(prev => prev.filter(b => b.bookingId !== bookingId));
        setSelectedBooking(null);
        await fetchBookings();
      } else {
        alert('Failed to delete booking.');
      }
    } catch (err) {
      alert('Network error deleting booking.');
    }
  };

  const handlePropertiesChanged = (nextProperties) => {
    setProperties(nextProperties);
    localStorage.setItem('properties_cache', JSON.stringify(nextProperties));
  };

  // Render Login or Setup first
  if (!isAuthenticated) {
    if (!isPinSetup) {
      if (authStatusError) {
        return (
          <div className="app-container" style={{ justifyContent: 'center', padding: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Cannot verify server PIN</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--accent-rose)', marginBottom: '20px' }}>{authStatusError}</p>
              <button type="button" className="btn btn-primary" onClick={checkPinStatus}>
                Retry connection
              </button>
            </div>
          </div>
        );
      }

      // First-time setup PIN
      return (
        <div className="app-container" style={{ justifyContent: 'center', padding: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '8px' }}>Setup Security PIN</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Create a 4-to-6 digit security PIN to control access to your booking manager.
            </p>
            
            <form onSubmit={handleSetupPin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label>Define PIN (4-6 digits)</label>
                <input 
                  type="password" 
                  maxLength={6}
                  className="form-control"
                  value={setupPin}
                  onChange={e => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label>Confirm PIN</label>
                <input 
                  type="password" 
                  maxLength={6}
                  className="form-control"
                  value={setupConfirmPin}
                  onChange={e => setSetupConfirmPin(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              {setupError && <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem' }}>⚠️ {setupError}</p>}

              <button type="submit" className="btn btn-primary" style={{ padding: '14px' }}>
                Initialize System
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Standard PIN Lock Screen
    return (
      <div className="app-container" style={{ justifyContent: 'center', padding: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ margin: '0 auto 16px', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#1a1a1a', border: '1px solid var(--border-color)' }}>
            <Lock size={28} style={{ margin: '0 auto' }} />
          </div>
          
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Infinyte Getawayz</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Enter PIN code to access Booking Manager
          </p>

          {loginError && (
            <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '10px' }}>
              ⚠️ {loginError}
            </p>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submitLogin(); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              className="form-control"
              placeholder="Enter PIN"
              value={pinCode}
              onChange={(e) => {
                setLoginError('');
                setPinCode(e.target.value.replace(/\D/g, ''));
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged-in Core App Structure
  return (
    <div className="app-container">
      {/* Offline Alert Banner */}
      {(isOffline || bookingsLoadError || propertiesLoadError) && (
        <div className="offline-banner">
          <WifiOff size={16} /> {isOffline
            ? 'Viewing offline data. Updates will sync when online.'
            : 'Server data is unavailable. Showing cached data and retrying automatically.'}
        </div>
      )}
      {isSyncing && (
        <div className="offline-banner offline-banner-sync">
          <Wifi size={16} style={{ animation: 'spin 1s linear infinite' }} /> Restoring server sync...
        </div>
      )}

      {/* Header Bar */}
      <header className="header" style={{ padding: '10px 20px' }}>
        <div className="logo-group">
          {/* Logo Treatment: Aspect Ratio 200:119 Black Logo */}
           <img src={base + 'logo.png'} alt="Infinyte Getawayz Logo" className="logo-img" />
          <div className="logo-text">
            <h1 style={{ display: 'none' }}>Infinyte Getawayz</h1>
          </div>
        </div>
        
        <span style={{ 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%', 
          backgroundColor: isOffline ? 'var(--accent-rose)' : 'var(--accent-teal)',
          boxShadow: `0 0 8px ${isOffline ? 'rgba(225, 29, 72, 0.5)' : 'rgba(13, 148, 136, 0.5)'}`
        }} title={isOffline ? 'Offline Mode' : 'Online Mode'} />
      </header>

      {/* Content Router */}
      {selectedBooking ? (
        <BookingDetails 
          booking={selectedBooking} 
          token={token}
          onBack={() => {
            setSelectedBooking(null);
            fetchBookings(); // Refresh data
          }}
          onUpdateBooking={handleUpdateBooking}
          onDeleteBooking={handleDeleteBooking}
          onEdit={handleEditBooking}
        />
      ) : currentTab === 'edit' ? (
        <BookingForm
          token={token}
          bookings={bookings}
          properties={properties}
          editingBooking={editingBooking}
          onBookingUpdated={async (updatedBooking) => {
            await handleUpdateBooking(updatedBooking);
            setEditingBooking(null);
            setSelectedBooking(null);
            setCurrentTab('dashboard');
          }}
          onCancelEdit={() => {
            setEditingBooking(null);
            setCurrentTab('dashboard');
          }}
          onBookingCreated={handleBookingCreated}
        />
      ) : (
        <>
          {currentTab === 'dashboard' && (
            <Dashboard 
              bookings={bookings} 
              properties={properties}
              token={token}
              onSelectBooking={setSelectedBooking} 
              onRefresh={fetchBookings}
              onUpdateBooking={handleUpdateBooking}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarScreen 
              bookings={bookings} 
              properties={properties}
            />
          )}

          {currentTab === 'add' && (
            <BookingForm 
              token={token} 
              bookings={bookings}
              properties={properties}
              onBookingCreated={handleBookingCreated} 
            />
          )}

          {currentTab === 'expenses' && (
            <Expenses token={token} properties={properties} />
          )}

          {currentTab === 'accounts' && (
            <Accounts token={token} bookings={bookings} properties={properties} />
          )}

          {currentTab === 'notes' && (
            <BookingNotes bookings={bookings} properties={properties} />
          )}

          {currentTab === 'annual-report' && (
            <AnnualReport bookings={bookings} properties={properties} />
          )}

          {currentTab === 'settings' && (
            <Settings 
              token={token} 
              onLogout={handleLogout} 
              onPropertiesChanged={handlePropertiesChanged}
            />
          )}
        </>
      )}

      {/* Bottom Nav (visible unless viewing detail page) */}
      {!selectedBooking && (
        <nav className="navbar">
          <button 
            onClick={() => { setCurrentTab('dashboard'); setIsMenuOpen(false); }}
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          >
            <Home className="nav-icon" />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => { setCurrentTab('add'); setIsMenuOpen(false); }}
            className={`nav-item ${currentTab === 'add' ? 'active' : ''}`}
          >
            <PlusCircle className="nav-icon" />
            <span>Add Guest</span>
          </button>
          
          <button
            onClick={() => { setCurrentTab('notes'); setIsMenuOpen(false); }}
            className={`nav-item ${currentTab === 'notes' ? 'active' : ''}`}
          >
            <ClipboardList className="nav-icon" />
            <span>Notes</span>
          </button>

          <div className="nav-more">
            {isMenuOpen && (
              <div className="nav-menu" role="menu" aria-label="More pages">
                {[
                  ['calendar', 'Calendar'],
                  ['expenses', 'Expenses'],
                  ['accounts', 'Accounts'],
                  ['annual-report', 'Business Year Totals'],
                  ['settings', 'Settings']
                ].map(([tab, label]) => (
                  <button key={tab} type="button" role="menuitem" className={currentTab === tab ? 'active' : ''} onClick={() => { setCurrentTab(tab); setIsMenuOpen(false); }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={`nav-item ${isMenuOpen ? 'active' : ''}`} aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(value => !value)}>
              {isMenuOpen ? <X className="nav-icon" /> : <Menu className="nav-icon" />}
              <span>More</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
