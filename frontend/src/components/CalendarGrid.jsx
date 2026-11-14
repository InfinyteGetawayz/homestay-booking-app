import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getBookingPropertyId } from '../utils/property';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarGrid({ bookings = [], properties = [] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');

  useEffect(() => {
    if (!properties.some(property => property.id === propertyId)) {
      setPropertyId(properties[0]?.id || '');
    }
  }, [properties, propertyId]);

  const property = properties.find(item => item.id === propertyId);
  const rooms = useMemo(() => [...new Set([
    ...(property?.rooms || []),
    ...(property?.configurationHistory || []).flatMap(configuration => configuration.rooms || [])
  ])], [property]);

  const occupiedDates = useMemo(() => {
    const occupied = new Set();
    bookings.forEach(booking => {
      if (booking.paymentStatus === 'No Show' || getBookingPropertyId(booking, properties) !== propertyId) return;
      const start = booking.checkInDate;
      const end = booking.checkOutDate;
      if (!start || !end || end <= start) return;
      const bookingRooms = String(booking.roomSelection || '').split(',').map(room => room.trim());
      let date = new Date(`${start}T00:00:00Z`);
      const checkout = new Date(`${end}T00:00:00Z`);
      while (date < checkout) {
        const dateString = date.toISOString().slice(0, 10);
        bookingRooms.forEach(room => occupied.add(`${dateString}|${room}`));
        date.setUTCDate(date.getUTCDate() + 1);
      }
    });
    return occupied;
  }, [bookings, properties, propertyId]);

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} /> Occupancy Calendar
        </h2>
        <div className="calendar-year-control">
          <button type="button" aria-label="Previous year" onClick={() => setSelectedYear(year => year - 1)}><ChevronLeft size={17} /></button>
          <span>{selectedYear}</span>
          <button type="button" aria-label="Next year" onClick={() => setSelectedYear(year => year + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="calendar-property">Homestay</label>
        <select id="calendar-property" className="form-control" value={propertyId} onChange={event => setPropertyId(event.target.value)}>
          {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      {!property ? (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No homestays are configured.</div>
      ) : rooms.length === 0 ? (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No rooms are configured for {property.name}.</div>
      ) : months.map((month, monthIndex) => {
        const days = new Date(selectedYear, monthIndex + 1, 0).getDate();
        return (
          <section key={month} className="glass-panel" style={{ padding: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>{month} {selectedYear}</h3>
            <div className="calendar-table-scroll">
              <table className="occupancy-table">
                <thead>
                  <tr>
                    <th className="occupancy-date">Date</th>
                    {rooms.map(room => <th key={room}>{room}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: days }, (_, index) => {
                    const date = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
                    return (
                      <tr key={date}>
                        <th className="occupancy-date">{date.slice(-2)}</th>
                        {rooms.map(room => {
                          const isOccupied = occupiedDates.has(`${date}|${room}`);
                          return <td key={room}><span className={`occupancy-mark ${isOccupied ? 'occupied' : ''}`} aria-label={isOccupied ? `${room} occupied` : `${room} available`} /></td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="calendar-legend"><span className="occupancy-mark occupied" /> Occupied <span className="occupancy-mark" /> Available</div>
    </div>
  );
}
