import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarScreen({ bookings = [], properties = [] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { name: 'January', val: 0 },
    { name: 'February', val: 1 },
    { name: 'March', val: 2 },
    { name: 'April', val: 3 },
    { name: 'May', val: 4 },
    { name: 'June', val: 5 },
    { name: 'July', val: 6 },
    { name: 'August', val: 7 },
    { name: 'September', val: 8 },
    { name: 'October', val: 9 },
    { name: 'November', val: 10 },
    { name: 'December', val: 11 }
  ];

  // Helper to get number of days in a month
  const getDaysInMonth = (monthIdx, year) => {
    return new Date(year, monthIdx + 1, 0).getDate();
  };

  // Helper to format date as YYYY-MM-DD
  const formatDateStr = (year, monthIdx, dayNum) => {
    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Check if a room is occupied on a specific date
  // A room is occupied if: date >= checkIn and date < checkOut (exclusive of check-out day)
  const isRoomOccupied = useMemo(() => {
    // Memoize booking dates map for fast lookups
    const occupiedMap = {};
    bookings.forEach(b => {
      if (b.paymentStatus === 'No Show') return;
      const start = new Date(b.checkInDate);
      const end = new Date(b.checkOutDate);
      const rooms = b.roomSelection.split(',').map(r => r.trim());

      // Loop dates
      const curr = new Date(start);
      while (curr < end) {
        const dateStr = curr.toISOString().split('T')[0];
        if (!occupiedMap[dateStr]) occupiedMap[dateStr] = {};
        rooms.forEach(room => {
          occupiedMap[dateStr][room] = true;
        });
        curr.setDate(curr.getDate() + 1);
      }
    });
    return (roomName, dateStr) => !!(occupiedMap[dateStr] && occupiedMap[dateStr][roomName]);
  }, [bookings]);

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* HEADER & YEAR CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={22} /> Occupancy Calendar
        </h2>
        
        {/* Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
          <button 
            onClick={() => setSelectedYear(selectedYear - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: '700', fontSize: '0.9rem', minWidth: '45px', textAlign: 'center' }}>{selectedYear}</span>
          <button 
            onClick={() => setSelectedYear(selectedYear + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No homestays enlisted. Configure properties in Settings.
        </div>
      ) : (
        /* HORIZONTAL SCROLL ALL 12 MONTHS MATRIX */
        <div className="month-scroll-container">
          {months.map(month => {
            const daysCount = getDaysInMonth(month.val, selectedYear);
            const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

            return (
              <div 
                key={month.name} 
                className="glass-panel" 
                style={{ 
                  padding: '14px', 
                  minWidth: '310px', 
                  flexShrink: 0, 
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Month Name */}
                <h3 style={{ fontSize: '1rem', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', textAlign: 'center', color: 'var(--text-primary)' }}>
                  {month.name} {selectedYear}
                </h3>

                {/* Calendar Grid Container */}
                <div style={{ overflowX: 'auto', maxHeight: '320px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid var(--border-color)', minWidth: '70px', position: 'sticky', left: 0, background: '#ffffff', zIndex: 10 }}>
                          Rooms
                        </th>
                        {daysArray.map(day => (
                          <th key={day} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '2px solid var(--border-color)', minWidth: '22px' }}>
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {properties.map(prop => (
                        <React.Fragment key={prop.id}>
                          {/* Property Header Row */}
                          <tr style={{ background: '#f3f4f6' }}>
                            <td 
                              colSpan={daysCount + 1} 
                              style={{ 
                                fontWeight: '700', 
                                padding: '4px 8px', 
                                fontSize: '0.7rem', 
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                position: 'sticky', 
                                left: 0,
                                background: '#f3f4f6'
                              }}
                            >
                              {prop.name}
                            </td>
                          </tr>

                          {/* Rooms Rows */}
                          {prop.rooms.map(room => (
                            <tr key={room} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              {/* Room label */}
                              <td 
                                style={{ 
                                  fontWeight: '600', 
                                  padding: '8px 8px', 
                                  position: 'sticky', 
                                  left: 0, 
                                  background: '#ffffff',
                                  borderRight: '1px solid var(--border-color)'
                                }}
                              >
                                {room}
                              </td>

                              {/* Days occupancy checkboxes */}
                              {daysArray.map(day => {
                                const dateStr = formatDateStr(selectedYear, month.val, day);
                                const occupied = isRoomOccupied(room, dateStr);

                                return (
                                  <td key={day} style={{ textAlign: 'center', padding: '4px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={occupied}
                                      disabled
                                      style={{ 
                                        width: '15px', 
                                        height: '15px', 
                                        cursor: 'default',
                                        accentColor: '#1a1a1a',
                                        backgroundColor: occupied ? '#1a1a1a' : 'transparent',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '3px'
                                      }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="glass-panel" style={{ padding: '12px', display: 'flex', gap: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={true} disabled style={{ width: '14px', height: '14px', accentColor: '#1a1a1a' }} />
          <span>Occupied (✓ Checkbox)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={false} disabled style={{ width: '14px', height: '14px', accentColor: '#1a1a1a' }} />
          <span>Available (⬜ Blank)</span>
        </div>
      </div>

    </div>
  );
}
