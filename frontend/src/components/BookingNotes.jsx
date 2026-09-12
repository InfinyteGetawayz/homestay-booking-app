import React, { useMemo, useState } from 'react';
import { ClipboardList, Copy } from 'lucide-react';

const formatDate = value => {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

const buildNotes = (bookings, month) => bookings
  .filter(booking => String(booking.checkInDate || '').startsWith(month))
  .sort((a, b) => String(a.checkInDate).localeCompare(String(b.checkInDate)))
  .map(booking => [
    `Guest : **${booking.guestName || '-'}**`,
    `Mobile : **${booking.mobileNumber || '-'}**`,
    `Check In Date : **${formatDate(booking.checkInDate)}**`,
    `Check Out Date : **${formatDate(booking.checkOutDate)}**`,
    `Number of Adults : **${booking.numberAdults ?? 0}**`,
    `Number of Childrens : **${booking.numberChildren5Plus ?? 0}**`,
    `Number of Infants : **${booking.numberChildrenUnder5 ?? 0}**`,
    `Rooms : **${booking.roomSelection || '-'}**`,
    `Meal Type : **${booking.foodPreference || '-'}**`,
    `Special Requests : **${booking.specialRequest || '-'}**`,
    `Car : **${booking.communicationTransport || '-'}**`,
  ].join('\n')).join('\n\n');

export default function BookingNotes({ bookings = [] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [copied, setCopied] = useState(false);
  const notes = useMemo(() => buildNotes(bookings, month), [bookings, month]);

  const copyNotes = async () => {
    await navigator.clipboard.writeText(notes || 'No bookings found for this month.');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-panel" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={20} /> Monthly Booking Notes
        </h2>
        <div className="form-group" style={{ marginTop: '14px' }}>
          <label>Booking Month</label>
          <input type="month" className="form-control" value={month} onChange={event => setMonth(event.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" onClick={copyNotes} style={{ marginTop: '10px' }}>
          <Copy size={17} /> {copied ? 'Copied' : 'Copy Booking Notes'}
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '16px' }}>
        <textarea
          readOnly
          value={notes || 'No bookings found for this month.'}
          className="form-control"
          style={{ minHeight: '420px', lineHeight: 1.6, whiteSpace: 'pre-wrap', userSelect: 'text' }}
          aria-label="Monthly booking notes"
        />
      </div>
    </div>
  );
}
