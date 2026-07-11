import React, { useState, useEffect } from 'react';
import { generateBookingPDF, shareBookingPDFViaWhatsApp } from '../utils/pdfGenerator';
import { ArrowLeft, FileText, Share2, Trash2, User, Phone, Calendar, Home, MessageSquare, Briefcase } from 'lucide-react';

export default function BookingDetails({ booking, token, onBack, onUpdateBooking, onDeleteBooking }) {
  const [settlement, setSettlement] = useState(booking.settlement || 'No');
  const [paymentStatus, setPaymentStatus] = useState(booking.paymentStatus || 'Pending');
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync state if booking changes
  useEffect(() => {
    setSettlement(booking.settlement || 'No');
    setPaymentStatus(booking.paymentStatus || 'Pending');
  }, [booking]);

  // Interdependency constraint: if status is changed to non-completed, force settlement to "No"
  const handleStatusChange = async (newStatus) => {
    let nextSettlement = settlement;
    if (newStatus !== 'Completed Stay' && newStatus !== 'Completed') {
      nextSettlement = 'No';
    }
    await handleUpdateStatus(nextSettlement, newStatus);
  };

  const handleUpdateStatus = async (newSettlement, newStatus) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/bookings/${booking.bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settlement: newSettlement,
          paymentStatus: newStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        onUpdateBooking(data);
        setSettlement(newSettlement);
        setPaymentStatus(newStatus);
      } else {
        alert(data.error || 'Failed to update booking status.');
      }
    } catch (err) {
      alert('Network error updating status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGeneratePDF = () => {
    const doc = generateBookingPDF(booking);
    doc.save(`Confirmation_${booking.bookingId}_${booking.guestName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete booking ${booking.bookingId} for ${booking.guestName}? This cannot be undone.`)) {
      onDeleteBooking(booking.bookingId);
    }
  };

  // Dynamic property lookup
  const cachedProperties = JSON.parse(localStorage.getItem('properties_cache') || '[]');
  const prefix = booking.bookingId ? booking.bookingId.substring(0, 3) : 'KGH';
  const matchedProp = cachedProperties.find(p => p.id === prefix);
  const homestayName = matchedProp ? matchedProp.name : (prefix === 'KGH' ? 'Kanchan Ghar' : 'Mungpoo Bliss');

  const isCompleted = paymentStatus === 'Completed Stay' || paymentStatus === 'Completed';

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Booking Detail</h2>
      </div>

      {/* Main Card */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Top Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {homestayName}
            </span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '2px' }}>{booking.guestName}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {booking.bookingId}</span>
          </div>
          <span className={`badge ${
            isCompleted ? 'badge-completed' :
            paymentStatus === 'Pending' ? 'badge-pending' : 'badge-noshow'
          }`}>
            {paymentStatus}
          </span>
        </div>

        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

        {/* Guest Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <Phone size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mobile Number</p>
              <p style={{ fontWeight: '500' }}>+91 {booking.mobileNumber}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dates & Duration</p>
              <p style={{ fontWeight: '500' }}>
                {booking.checkInDate} to {booking.checkOutDate} ({booking.totalNights} {booking.totalNights === 1 ? 'Night' : 'Nights'})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <Home size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rooms Selected</p>
              <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{booking.roomSelection}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <User size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Guests (Pax)</p>
              <p style={{ fontWeight: '500' }}>
                {booking.totalPax} Pax ({booking.numberAdults} Adults, {booking.numberChildren5Plus} Children {booking.numberChildrenUnder5 > 0 ? `, ${booking.numberChildrenUnder5} Under-5 Free` : ''})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <Briefcase size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Booking Type</p>
              <p style={{ fontWeight: '500' }}>
                {booking.typeOfBooking} {booking.typeOfBooking === 'B2B' ? `(${booking.b2bAgencyName})` : ''}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <MessageSquare size={18} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Preferences & Special Requests</p>
              <p style={{ fontSize: '0.85rem' }}>
                <strong>Food:</strong> {booking.foodPreference} {booking.dietaryRestrictions ? `[${booking.dietaryRestrictions}]` : ''}
              </p>
              {booking.specialRequest && (
                <p style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                  <strong>Special request:</strong> "{booking.specialRequest}"
                </p>
              )}
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

        {/* Tariff Summary */}
        <div style={{ background: 'rgba(0, 0, 0, 0.02)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Adult Lodging ({booking.numberAdults} x ₹{booking.perAdultTariff})</span>
            <span>₹{booking.totalAdultTariff}</span>
          </div>
          {booking.numberChildren5Plus > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Child Lodging ({booking.numberChildren5Plus} x ₹{booking.perChildTariff})</span>
              <span>₹{booking.totalChildTariff}</span>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Estimated Fooding (₹400 / Pax / Night)</span>
            <span>₹{booking.foodingTotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700' }}>
            <span>Total Tariff</span>
            <span style={{ color: 'var(--text-primary)' }}>₹{booking.finalTariff}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span>Advance Amount Paid</span>
            <span>- ₹{booking.advanceAmount}</span>
          </div>

          {/* Pending Amount Box */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '8px', 
            padding: '10px 12px', 
            borderRadius: 'var(--radius-sm)',
            backgroundColor: booking.pendingAmount < 0 ? 'rgba(225, 29, 72, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${booking.pendingAmount < 0 ? 'rgba(225, 29, 72, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
          }}>
            <span style={{ fontWeight: '700', fontSize: '0.85rem', color: booking.pendingAmount < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
              {booking.pendingAmount < 0 ? 'OVER-ADVANCE AMOUNT' : 'PENDING AMOUNT'}
            </span>
            <span style={{ fontWeight: '700', fontSize: '1.2rem', color: booking.pendingAmount < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
              ₹{Math.abs(booking.pendingAmount)}
            </span>
          </div>
        </div>

        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

        {/* Update Settlement & Status Panel (US Version 1.1 UI Swapped positioning) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Update Post-Checkout Status
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Position 1: Guest Status sits on top */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Guest Status</label>
              <select 
                className="form-control"
                value={paymentStatus}
                disabled={isUpdating}
                onChange={e => handleStatusChange(e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Completed Stay">Completed Stay</option>
                <option value="No Show">No Show</option>
              </select>
            </div>

            {/* Position 2: Settlement Cleared sits directly beneath it */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Settlement Cleared</label>
              <select 
                className="form-control"
                value={settlement}
                disabled={isUpdating || !isCompleted}
                onChange={e => handleUpdateStatus(e.target.value, paymentStatus)}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              {!isCompleted && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Settlement Cleared is locked/disabled unless Guest Status is Completed.
                </p>
              )}
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          
          <div className="form-row">
            <button onClick={handleGeneratePDF} className="btn btn-secondary">
              <FileText size={18} /> Receipt PDF
            </button>
            
            <button onClick={() => shareBookingPDFViaWhatsApp(booking)} className="btn btn-teal">
              <Share2 size={18} /> WhatsApp Share
            </button>
          </div>

          <button onClick={handleDelete} className="btn btn-rose" style={{ padding: '12px' }}>
            <Trash2 size={18} /> Delete Booking
          </button>
          
        </div>

      </div>
    </div>
  );
}
