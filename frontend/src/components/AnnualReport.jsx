import React, { useMemo, useState } from 'react';
import { Banknote, CalendarRange } from 'lucide-react';
import { getBookingPropertyId, getBusinessYearStart } from '../utils/property';
import { calculateBusinessYearTotals } from '../utils/financials';

const localDateString = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const currency = amount => `₹${Number(amount || 0).toFixed(2)}`;

export default function AnnualReport({ bookings = [], properties = [] }) {
  const [selectedPropertyId, setSelectedPropertyId] = useState('ALL');
  const today = localDateString(new Date());

  const reports = useMemo(() => properties.map(property => {
    const propertyBookings = bookings.filter(booking =>
      getBookingPropertyId(booking, properties) === property.id
    );
    const startDate = getBusinessYearStart(property.businessYearEndDate)
      || propertyBookings.map(booking => booking.checkInDate).filter(Boolean).sort()[0]
      || today;
    return { property, startDate, endDate: today,
      ...calculateBusinessYearTotals(bookings, properties, property.id, startDate, today) };
  }), [bookings, properties, today]);

  const visibleReports = selectedPropertyId === 'ALL'
    ? reports
    : reports.filter(report => report.property.id === selectedPropertyId);

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Banknote size={20} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Business Year Totals</h2>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="annual-property">Homestay</label>
        <select id="annual-property" className="form-control" value={selectedPropertyId} onChange={event => setSelectedPropertyId(event.target.value)}>
          <option value="ALL">All homestays</option>
          {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </div>

      {visibleReports.length === 0 ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--text-secondary)' }}>No homestays are configured.</div>
      ) : visibleReports.map(({ property, startDate, endDate, lodging, fooding, booking }) => (
        <section key={property.id} className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CalendarRange size={17} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{property.name}</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '12px' }}>
            {property.businessYearEndDate
              ? `Business year: ${startDate} to ${endDate}`
              : `From first booking: ${startDate} to ${endDate}. Set the year-end date in Settings to begin a new period.`}
          </p>
          <dl className="annual-report-grid">
            <div><dt>Total Lodging Amount</dt><dd>{currency(lodging)}</dd></div>
            <div><dt>Total Fooding Amount</dt><dd>{currency(fooding)}</dd></div>
            <div><dt>Total Booking Amount</dt><dd>{currency(booking)}</dd></div>
          </dl>
        </section>
      ))}
    </div>
  );
}
