import React, { useState, useEffect } from 'react';
import { Home, Calendar, Users, DollarSign, Save, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../apiBase';

export default function BookingForm({ token, bookings = [], properties = [], onBookingCreated }) {
  // 17 Form Inputs state
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [typeOfBooking, setTypeOfBooking] = useState('B2C');
  const [perAdultTariff, setPerAdultTariff] = useState('');
  const [perChildTariff, setPerChildTariff] = useState('');
  
  const [numberAdults, setNumberAdults] = useState(1);
  const [numberChildren5Plus, setNumberChildren5Plus] = useState(0);
  const [numberChildrenUnder5, setNumberChildrenUnder5] = useState(0);
  
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  
  const [property, setProperty] = useState(properties[0]?.id || 'KGH'); // Default KGH or first property
  const [selectedRooms, setSelectedRooms] = useState([]);
  
  const [foodPreference, setFoodPreference] = useState('Veg');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [communicationTransport, setCommunicationTransport] = useState('To Be Arranged');
  const [b2bAgencyName, setB2bAgencyName] = useState('');

  // Fields 16 & 17: Guest Status & Settlement Swapped Interdependency
  const [guestStatus, setGuestStatus] = useState('Pending'); // Position 1: Pending | Completed Stay | No Show
  const [settlementCleared, setSettlementCleared] = useState('No'); // Position 2: Yes | No (CONDITIONAL: Disabled by default)

  // 10 Computed Outputs state
  const [computed, setComputed] = useState({
    totalNights: 0,
    totalPax: 0,
    totalAdultTariff: 0,
    totalChildTariff: 0,
    finalTariff: 0,
    pendingAmount: 0,
    foodingTotal: 0,
    lodgingTotal: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Dynamically query rooms based on property
  const matchedProperty = properties.find(p => p.id === property);
  const roomsList = matchedProperty ? matchedProperty.rooms : [];

  // Clear room selection when property changes
  useEffect(() => {
    setSelectedRooms([]);
  }, [property]);

  // Interdependency: Settlement Cleared is locked to "No" unless Guest Status is "Completed Stay"
  useEffect(() => {
    if (guestStatus !== 'Completed Stay') {
      setSettlementCleared('No');
    }
  }, [guestStatus]);

  // Recalculate outputs in real-time
  useEffect(() => {
    if (!checkInDate || !checkOutDate) {
      setComputed({
        totalNights: 0,
        totalPax: numberAdults + numberChildren5Plus,
        totalAdultTariff: 0,
        totalChildTariff: 0,
        finalTariff: 0,
        pendingAmount: 0,
        foodingTotal: 0,
        lodgingTotal: 0
      });
      return;
    }

    const dIn = new Date(checkInDate);
    const dOut = new Date(checkOutDate);
    const diffTime = dOut.getTime() - dIn.getTime();
    const totalNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const totalPax = numberAdults + numberChildren5Plus;

    const adultTariffVal = parseFloat(perAdultTariff) || 0;
    const childTariffVal = parseFloat(perChildTariff) || 0;
    const advanceVal = parseFloat(advanceAmount) || 0;

    const totalAdultTariff = numberAdults * adultTariffVal * totalNights;
    const totalChildTariff = numberChildren5Plus * childTariffVal * totalNights;
    const finalTariff = totalAdultTariff + totalChildTariff;

    const pendingAmount = finalTariff - advanceVal;

    // Fixed Fooding Standard rate is ₹400 per person per night
    const foodingTotal = 400 * totalPax * totalNights;
    const lodgingTotal = finalTariff - foodingTotal;

    setComputed({
      totalNights,
      totalPax,
      totalAdultTariff,
      totalChildTariff,
      finalTariff,
      pendingAmount,
      foodingTotal,
      lodgingTotal
    });
  }, [
    checkInDate, checkOutDate, perAdultTariff, perChildTariff,
    numberAdults, numberChildren5Plus, advanceAmount
  ]);

  // Crucial Overlapping Date Validation Engine (Instant check)
  useEffect(() => {
    if (!checkInDate || !checkOutDate || selectedRooms.length === 0) {
      setValidationError('');
      return;
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    // Check conflicts against existing active bookings
    for (const b of bookings) {
      if (b.paymentStatus === 'No Show') continue;
      const existingIn = new Date(b.checkInDate);
      const existingOut = new Date(b.checkOutDate);

      // Target Intersect = (Selected Check-In < Existing Check-Out) AND (Selected Check-Out > Existing Check-In)
      const datesOverlap = checkIn < existingOut && checkOut > existingIn;

      if (datesOverlap) {
        const existingRooms = b.roomSelection.split(',').map(r => r.trim());
        const conflictingRoom = selectedRooms.find(r => existingRooms.includes(r));
        if (conflictingRoom) {
          setValidationError(`Booking Conflict: Room ${conflictingRoom} is already reserved from ${b.checkInDate} to ${b.checkOutDate}. Please select an alternative room or adjust dates.`);
          return;
        }
      }
    }
    setValidationError('');
  }, [checkInDate, checkOutDate, selectedRooms, property, bookings]);

  const handleRoomToggle = (room) => {
    if (selectedRooms.includes(room)) {
      setSelectedRooms(selectedRooms.filter(r => r !== room));
    } else {
      setSelectedRooms([...selectedRooms, room]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Validation checks
    if (!guestName.trim()) return setSubmitError('Guest Name is required.');
    if (!mobileNumber.match(/^\d{10}$/)) return setSubmitError('Mobile Number must be a valid 10-digit number.');
    if (selectedRooms.length === 0) return setSubmitError('Please select at least one room.');
    if (!checkInDate) return setSubmitError('Check-In Date is required.');
    if (!checkOutDate) return setSubmitError('Check-Out Date is required.');
    if (validationError) return setSubmitError('Cannot save booking due to date conflict.');

    const dIn = new Date(checkInDate);
    const dOut = new Date(checkOutDate);
    if (dOut <= dIn) return setSubmitError('Check-Out date must be after Check-In date.');

    const dBook = new Date(bookingDate);
    if (dIn < dBook) return setSubmitError('Check-In date cannot be prior to Booking date.');

    if (typeOfBooking === 'B2B' && !b2bAgencyName.trim()) {
      return setSubmitError('Agency Name is required for B2B bookings.');
    }

    setIsSubmitting(true);

    const bookingPayload = {
      guestName: guestName.trim(),
      mobileNumber,
      bookingDate,
      typeOfBooking,
      perAdultTariff: parseFloat(perAdultTariff) || 0,
      perChildTariff: parseFloat(perChildTariff) || 0,
      numberAdults,
      numberChildren5Plus,
      numberChildrenUnder5,
      checkInDate,
      checkOutDate,
      advanceAmount: parseFloat(advanceAmount) || 0,
      roomSelection: selectedRooms.join(','),
      foodPreference,
      dietaryRestrictions,
      specialRequest,
      communicationTransport,
      b2bAgencyName: typeOfBooking === 'B2B' ? b2bAgencyName : '',
      settlement: settlementCleared,
      paymentStatus: guestStatus,
      mutedReminders: false
    };

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload)
      });
      const data = await res.json();
      if (res.ok) {
        onBookingCreated(data);
      } else {
        setSubmitError(data.error || 'Failed to save booking.');
      }
    } catch (err) {
      setSubmitError('Connection failed. Queueing booking offline...');
      // Local sync queue for offline capability
      const offlineQueue = JSON.parse(localStorage.getItem('booking_sync_queue') || '[]');
      offlineQueue.push(bookingPayload);
      localStorage.setItem('booking_sync_queue', JSON.stringify(offlineQueue));
      
      // Add a dummy local cache to bookings to show immediately
      const cached = JSON.parse(localStorage.getItem('bookings_cache') || '[]');
      const tempId = `${property}_OFFLINE_${Date.now()}`;
      const tempBooking = {
        ...bookingPayload,
        bookingId: tempId,
        createdAt: new Date().toISOString(),
        ...computed
      };
      cached.push(tempBooking);
      localStorage.setItem('bookings_cache', JSON.stringify(cached));
      
      alert('Booking saved offline. It will synchronize once internet is restored.');
      onBookingCreated(tempBooking);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '4px' }}>New Guest Booking</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Core Guest Info Panel */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            1. Guest Information
          </h3>

          <div className="form-group">
            <label>Guest Full Name <span className="req">*</span></label>
            <input 
              type="text" 
              className="form-control" 
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="e.g. Subhajit Nag"
              required
            />
          </div>

          <div className="form-group">
            <label>10-Digit Mobile Number <span className="req">*</span></label>
            <input 
              type="tel" 
              className="form-control" 
              value={mobileNumber}
              onChange={e => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="e.g. 9876543210"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Booking Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={bookingDate}
                onChange={e => setBookingDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Booking Type</label>
              <select 
                className="form-control" 
                value={typeOfBooking} 
                onChange={e => setTypeOfBooking(e.target.value)}
              >
                <option value="B2C">B2C (Direct)</option>
                <option value="B2B">B2B (Agency)</option>
                <option value="REL">REL (Relative)</option>
              </select>
            </div>
          </div>

          {typeOfBooking === 'B2B' && (
            <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
              <label>Agency Name <span className="req">*</span></label>
              <input 
                type="text" 
                className="form-control" 
                value={b2bAgencyName}
                onChange={e => setB2bAgencyName(e.target.value)}
                placeholder="e.g. MakeMyTrip"
                required
              />
            </div>
          )}
        </div>

        {/* Accommodation Panel */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            2. Accommodation & Stay
          </h3>

          <div className="form-row" style={{ marginBottom: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Check-In Date <span className="req">*</span></label>
              <input 
                type="date" 
                className="form-control" 
                value={checkInDate}
                onChange={e => setCheckInDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Check-Out Date <span className="req">*</span></label>
              <input 
                type="date" 
                className="form-control" 
                value={checkOutDate}
                onChange={e => setCheckOutDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Dynamic Homestay Property Selector */}
          <div className="form-group">
            <label>Homestay Property</label>
            <select 
              className="form-control" 
              value={property} 
              onChange={e => setProperty(e.target.value)}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Select Rooms <span className="req">*</span></label>
            {roomsList.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-rose)' }}>No rooms configured. Add rooms in Settings.</p>
            ) : (
              <div className="room-selection-grid">
                {roomsList.map(room => (
                  <div 
                    key={room}
                    onClick={() => handleRoomToggle(room)}
                    className={`room-toggle ${selectedRooms.includes(room) ? 'selected' : ''}`}
                  >
                    {room}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Guest Count (Steppers) */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            3. Occupancy Details
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>Number of Adults</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ages 18+ (Min 1)</p>
              </div>
              <div className="stepper-container">
                <button type="button" className="stepper-btn" onClick={() => setNumberAdults(Math.max(1, numberAdults - 1))}>-</button>
                <span className="stepper-val">{numberAdults}</span>
                <button type="button" className="stepper-btn" onClick={() => setNumberAdults(numberAdults + 1)}>+</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>Children (5+ yrs)</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Counted for Pax & tariff</p>
              </div>
              <div className="stepper-container">
                <button type="button" className="stepper-btn" onClick={() => setNumberChildren5Plus(Math.max(0, numberChildren5Plus - 1))}>-</button>
                <span className="stepper-val">{numberChildren5Plus}</span>
                <button type="button" className="stepper-btn" onClick={() => setNumberChildren5Plus(numberChildren5Plus + 1)}>+</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>Children (≤5 yrs)</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Complimentary (Free)</p>
              </div>
              <div className="stepper-container">
                <button type="button" className="stepper-btn" onClick={() => setNumberChildrenUnder5(Math.max(0, numberChildrenUnder5 - 1))}>-</button>
                <span className="stepper-val">{numberChildrenUnder5}</span>
                <button type="button" className="stepper-btn" onClick={() => setNumberChildrenUnder5(numberChildrenUnder5 + 1)}>+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Panel */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            4. Tariff & Finance
          </h3>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Per Adult Tariff (₹) <span className="req">*</span></label>
              <input 
                type="number" 
                className="form-control" 
                value={perAdultTariff}
                onChange={e => setPerAdultTariff(e.target.value)}
                placeholder="Rate per adult"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Per Child Tariff (₹)</label>
              <input 
                type="number" 
                className="form-control" 
                value={perChildTariff}
                onChange={e => setPerChildTariff(e.target.value)}
                placeholder="Rate per child"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
            <label>Advance Amount Paid (₹) <span className="req">*</span></label>
            <input 
              type="number" 
              className="form-control" 
              value={advanceAmount}
              onChange={e => setAdvanceAmount(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Preferences and Requests */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            5. Services & Preferences
          </h3>

          <div className="form-group">
            <label>Food Preference</label>
            <select 
              className="form-control"
              value={foodPreference}
              onChange={e => setFoodPreference(e.target.value)}
            >
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Both">Both (Mix)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Dietary Restrictions / Special Food Notes</label>
            <textarea 
              className="form-control" 
              rows={2} 
              value={dietaryRestrictions}
              onChange={e => setDietaryRestrictions(e.target.value)}
              placeholder="Allergies, no onions/garlic, etc."
            />
          </div>

          <div className="form-group">
            <label>Communication / Transport Mode</label>
            <select 
              className="form-control"
              value={communicationTransport}
              onChange={e => setCommunicationTransport(e.target.value)}
            >
              <option value="Self Drive">Self Drive</option>
              <option value="Arranged Driver">Arranged Driver</option>
              <option value="Bike">Bike</option>
              <option value="To Be Arranged">To Be Arranged</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Special Requests</label>
            <textarea 
              className="form-control" 
              rows={2} 
              value={specialRequest}
              onChange={e => setSpecialRequest(e.target.value)}
              placeholder="Accessibility needs, quiet room, room decoration..."
            />
          </div>
        </div>

        {/* Status & Settlement (US Version 1.1 Swapped Interdependency layout) */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
            6. Status & Settlement
          </h3>

          {/* Position 1: Guest Status */}
          <div className="form-group">
            <label>Guest Status</label>
            <select 
              className="form-control"
              value={guestStatus}
              onChange={e => setGuestStatus(e.target.value)}
            >
              <option value="Pending">Pending</option>
              <option value="Completed Stay">Completed Stay</option>
              <option value="No Show">No Show</option>
            </select>
          </div>

          {/* Position 2: Settlement Cleared (Disabled by default, enabled ONLY on Completed Stay) */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Settlement Cleared</label>
            <select 
              className="form-control"
              value={settlementCleared}
              disabled={guestStatus !== 'Completed Stay'}
              onChange={e => setSettlementCleared(e.target.value)}
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
            {guestStatus !== 'Completed Stay' && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Settlement Cleared can only be modified once status is Completed Stay.
              </p>
            )}
          </div>
        </div>

        {/* Live Calculation Output Card (US-02) */}
        {checkInDate && checkOutDate && (
          <div className="glass-panel" style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.02)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Live Calculation Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Nights:</span>
                <span>{computed.totalNights} Days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Pax (A + C):</span>
                <span>{computed.totalPax} Guests</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lodging (Room) Total:</span>
                <span>₹{computed.lodgingTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fooding F&B (₹400/person/night):</span>
                <span>₹{computed.foodingTotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '0.95rem', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                <span>Final Booking Value:</span>
                <span style={{ color: 'var(--text-primary)' }}>₹{computed.finalTariff}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: computed.pendingAmount < 0 ? 'var(--accent-rose)' : '#b45309' }}>
                <span>{computed.pendingAmount < 0 ? 'Over-Paid (Refund):' : 'Pending Amount due:'}</span>
                <span>₹{Math.abs(computed.pendingAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Validation overlap error (Hard blocking) */}
        {validationError && (
          <div style={{ 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            backgroundColor: 'rgba(225, 29, 72, 0.1)', 
            color: '#be123c', 
            border: '1px solid rgba(225, 29, 72, 0.2)',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{validationError}</span>
          </div>
        )}

        {submitError && (
          <p style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', fontWeight: '600' }}>
            ⚠️ {submitError}
          </p>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting || !!validationError} 
          className="btn btn-primary" 
          style={{ padding: '14px', marginBottom: '10px', opacity: (isSubmitting || !!validationError) ? 0.5 : 1 }}
        >
          <Save size={20} /> {isSubmitting ? 'Saving Booking...' : 'Save and Lock Booking'}
        </button>

      </form>
    </div>
  );
}
