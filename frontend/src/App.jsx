import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import BookingDetails from './components/BookingDetails';
import CalendarScreen from './components/CalendarScreen';
import Settings from './components/Settings';
import { Home, PlusCircle, Settings as SettingsIcon, Calendar as CalendarIcon, Lock, Wifi, WifiOff } from 'lucide-react';
import { API_BASE } from './apiBase';

const isApiErrorResponse = (response) => response && !response.ok && response.status !== 0;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [isPinSetup, setIsPinSetup] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [setupError, setSetupError] = useState('');

  // Routing
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'add' | 'settings'
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Data
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const base = import.meta.env.BASE_URL || '/';

  // 1. Initial Checks: auth status, offline listeners, and properties loading
  useEffect(() => {
    checkPinStatus();
    
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isAuthenticated) {
      fetchProperties();
      if (navigator.onLine) {
        fetchBookings();
        syncOfflineQueue();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  const checkPinStatus = async () => {
    if (isOffline) {
      setIsPinSetup(true);
      const cachedB = localStorage.getItem('bookings_cache');
      const cachedP = localStorage.getItem('properties_cache');
      if (cachedB) setBookings(JSON.parse(cachedB));
      if (cachedP) setProperties(JSON.parse(cachedP));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth-status`);
      if (isApiErrorResponse(res)) {
        throw new Error(`Auth check failed with status ${res.status}`);
      }
      const data = await res.json();
      setIsPinSetup(data.isSetup);
    } catch (e) {
      console.error(e);
      setIsPinSetup(true);
    }
  };

  const fetchProperties = async () => {
    if (isOffline) {
      const cached = localStorage.getItem('properties_cache');
      if (cached) setProperties(JSON.parse(cached));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties`);
      if (isApiErrorResponse(res)) {
        throw new Error(`Properties request failed with status ${res.status}`);
      }
      const data = await res.json();
      setProperties(data);
      localStorage.setItem('properties_cache', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to fetch properties:', e);
      const cached = localStorage.getItem('properties_cache');
      if (cached) setProperties(JSON.parse(cached));
    }
  };

  const fetchBookings = async () => {
    if (isOffline) {
      const cached = localStorage.getItem('bookings_cache');
      if (cached) {
        setBookings(JSON.parse(cached));
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
      setBookings(data);
      localStorage.setItem('bookings_cache', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to fetch bookings:', e);
      const cached = localStorage.getItem('bookings_cache');
      if (cached) setBookings(JSON.parse(cached));
    }
  };

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('booking_sync_queue') || '[]');
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const payload of queue) {
      try {
        const res = await fetch(`${API_BASE}/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error('Failed syncing offline booking:', err);
        break; // Stop syncing if connection drops again
      }
    }

    // Keep failed unsynced items in queue
    const remainingQueue = queue.slice(successCount);
    localStorage.setItem('booking_sync_queue', JSON.stringify(remainingQueue));

    setIsSyncing(false);
    fetchBookings();
  };

  // 2. PIN login & Setup handlers
  const handlePinKeyPress = (val) => {
    setLoginError('');
    if (val === 'clear') {
      setPinCode('');
    } else if (val === 'submit') {
      submitLogin();
    } else {
      if (pinCode.length < 6) {
        const nextPin = pinCode + val;
        setPinCode(nextPin);
        if (nextPin.length >= 4) {
          // Auto submit login on 4-6 digit PIN entry for speed
          setTimeout(() => submitLogin(nextPin), 150);
        }
      }
    }
  };

  const submitLogin = async (codeToSubmit = pinCode) => {
    if (!codeToSubmit) return;
    
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: codeToSubmit })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        setPinCode('');
      } else {
        setLoginError(data.error || 'Incorrect PIN code.');
        setPinCode('');
      }
    } catch (e) {
      setLoginError('Server connection error. Logging in offline...');
      if (localStorage.getItem('auth_token')) {
        setIsAuthenticated(true);
        setPinCode('');
      }
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
        setIsPinSetup(true);
        alert('PIN configured successfully! You can now log in.');
      } else {
        setSetupError(data.error || 'PIN configuration failed.');
      }
    } catch (err) {
      setSetupError('Server connection error.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken('');
    setIsAuthenticated(false);
  };

  // 3. Booking list changes (add, update, delete)
  const handleBookingCreated = async (newBooking) => {
    setBookings(prev => [newBooking, ...prev]);
    setCurrentTab('dashboard');
    if (navigator.onLine && token) {
      await fetchBookings();
    }
  };

  const handleUpdateBooking = async (updatedBooking) => {
    setBookings(prev => prev.map(b => b.bookingId === updatedBooking.bookingId ? updatedBooking : b));
    setSelectedBooking(updatedBooking);
    if (navigator.onLine && token) {
      await fetchBookings();
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (isOffline) {
      alert('Delete actions are disabled while offline.');
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

          {/* Indicators */}
          <div className="pin-indicator">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`pin-dot ${i < pinCode.length ? 'filled' : ''}`} />
            ))}
          </div>

          {loginError && (
            <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '10px' }}>
              ⚠️ {loginError}
            </p>
          )}

          {/* Numpad */}
          <div className="pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} type="button" onClick={() => handlePinKeyPress(String(num))} className="pin-key">
                {num}
              </button>
            ))}
            <button type="button" onClick={() => handlePinKeyPress('clear')} className="pin-key" style={{ fontSize: '0.9rem', color: 'var(--accent-rose)' }}>
              Clear
            </button>
            <button type="button" onClick={() => handlePinKeyPress('0')} className="pin-key">
              0
            </button>
            <button type="button" onClick={() => handlePinKeyPress('submit')} className="pin-key" style={{ fontSize: '0.9rem', color: 'var(--accent-teal)' }}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in Core App Structure
  return (
    <div className="app-container">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="offline-banner">
          <WifiOff size={16} /> Viewing offline data. Updates will sync when online.
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
            onClick={() => setCurrentTab('dashboard')} 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          >
            <Home className="nav-icon" />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => setCurrentTab('calendar')} 
            className={`nav-item ${currentTab === 'calendar' ? 'active' : ''}`}
          >
            <CalendarIcon className="nav-icon" />
            <span>Calendar</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('add')} 
            className={`nav-item ${currentTab === 'add' ? 'active' : ''}`}
          >
            <PlusCircle className="nav-icon" />
            <span>Add Guest</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('settings')} 
            className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          >
            <SettingsIcon className="nav-icon" />
            <span>Settings</span>
          </button>
        </nav>
      )}
    </div>
  );
}
