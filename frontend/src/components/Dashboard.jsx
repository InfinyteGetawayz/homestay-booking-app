import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, AlertCircle, TrendingUp, DollarSign, CheckCircle2, User, Home, Calendar } from 'lucide-react';

// Ordinal date helper, e.g. "19th June 2026"
function getOrdinalNum(n) {
  return n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
}

function formatOrdinalDate(dateStr) {
  if (!dateStr) return '';
  // Avoid local timezone shifts when parsing YYYY-MM-DD
  const parts = dateStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  
  return `${getOrdinalNum(day)} ${month} ${year}`;
}

import { API_BASE } from '../apiBase';

export default function Dashboard({ bookings = [], properties = [], token, onSelectBooking, onRefresh, onUpdateBooking }) {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'ledger'
  const [ledgerSubTab, setLedgerSubTab] = useState('pending'); // 'pending' | 'paid'

  // Search/Filters for bookings
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProperty, setFilterProperty] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterBookingType, setFilterBookingType] = useState('ALL');
  const [checkInStart, setCheckInStart] = useState('');
  const [checkInEnd, setCheckInEnd] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  // Get current date string in local timezone YYYY-MM-DD
  const todayStr = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  // Filter Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // 1. Search Query (name or mobile)
      const matchesSearch = 
        String(b.guestName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(b.mobileNumber || '').includes(searchQuery);

      // 2. Property Filter
      const prefix = b.bookingId ? b.bookingId.substring(0, 3) : 'KGH';
      const matchesProperty = filterProperty === 'ALL' || prefix === filterProperty;

      // 3. Status Filter
      const matchesStatus = filterStatus === 'ALL' || b.paymentStatus === filterStatus;

      // 4. Booking Type Filter
      const matchesType = filterBookingType === 'ALL' || b.typeOfBooking === filterBookingType;

      // 5. Date Range Filter (Check-in range)
      let matchesDates = true;
      if (checkInStart) {
        matchesDates = matchesDates && b.checkInDate >= checkInStart;
      }
      if (checkInEnd) {
        matchesDates = matchesDates && b.checkInDate <= checkInEnd;
      }

      return matchesSearch && matchesProperty && matchesStatus && matchesType && matchesDates;
    });
  }, [bookings, searchQuery, filterProperty, filterStatus, filterBookingType, checkInStart, checkInEnd]);

  // Today's Check-ins
  const todaysCheckIns = useMemo(() => {
    return bookings.filter(b => b.checkInDate === todayStr && b.paymentStatus !== 'No Show');
  }, [bookings, todayStr]);

  // Today's Check-outs
  const todaysCheckOuts = useMemo(() => {
    return bookings.filter(b => b.checkOutDate === todayStr && b.paymentStatus !== 'No Show');
  }, [bookings, todayStr]);

  // Next 7 Days Bookings
  const next7DaysBookings = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    return bookings.filter(b => 
      b.checkInDate > todayStr && 
      b.checkInDate <= nextWeekStr &&
      b.paymentStatus !== 'No Show'
    ).sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  }, [bookings, todayStr]);

  // Metrics
  const metrics = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter(b => b.paymentStatus === 'Completed Stay' || b.paymentStatus === 'Completed').length;
    const pending = bookings.filter(b => b.paymentStatus === 'Pending').length;
    const noShow = bookings.filter(b => b.paymentStatus === 'No Show').length;

    // Monthly revenue (sum finalTariff for check-in in the current month)
    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const monthlyRev = bookings
      .filter(b => String(b.checkInDate || '').startsWith(currentMonthPrefix) && b.paymentStatus !== 'No Show')
      .reduce((sum, b) => sum + (b.finalTariff || 0), 0);

    return { total, completed, pending, noShow, monthlyRev };
  }, [bookings]);

  // Worker Ledger filter
  // Scope: Completed Stays (Guest Status == 'Completed Stay' or 'Completed')
  const completedBookings = useMemo(() => {
    return bookings.filter(b => b.paymentStatus === 'Completed Stay' || b.paymentStatus === 'Completed');
  }, [bookings]);

  const pendingLaborDues = useMemo(() => {
    return completedBookings.filter(b => b.settlement === 'No');
  }, [completedBookings]);

  const paidLaborLogs = useMemo(() => {
    return completedBookings.filter(b => b.settlement === 'Yes');
  }, [completedBookings]);

  const handleSettleLabor = async (bookingId) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settlement: 'Yes' })
      });
      const data = await res.json();
      if (res.ok) {
        onUpdateBooking(data);
      } else {
        alert(data.error || 'Failed to settle labor dues.');
      }
    } catch (e) {
      alert('Network error settling labor dues.');
    }
  };

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* 1. KEY METRICS HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Welcome back,</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Infinyte Getawayz</h2>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <RefreshCw size={22} className={isRefreshing ? 'spin-anim' : ''} />
        </button>
      </div>

      {/* Tab Selectors */}
      <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '4px', borderRadius: 'var(--radius-md)' }}>
        <button 
          onClick={() => setActiveTab('bookings')}
          style={{ 
            flex: 1, 
            padding: '10px 0', 
            fontSize: '0.85rem', 
            fontWeight: '600', 
            border: 'none', 
            borderRadius: 'var(--radius-sm)', 
            cursor: 'pointer',
            background: activeTab === 'bookings' ? '#ffffff' : 'transparent',
            color: activeTab === 'bookings' ? '#1a1a1a' : '#6b7280',
            boxShadow: activeTab === 'bookings' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
          }}
        >
          Bookings Overview
        </button>
        <button 
          onClick={() => setActiveTab('ledger')}
          style={{ 
            flex: 1, 
            padding: '10px 0', 
            fontSize: '0.85rem', 
            fontWeight: '600', 
            border: 'none', 
            borderRadius: 'var(--radius-sm)', 
            cursor: 'pointer',
            background: activeTab === 'ledger' ? '#ffffff' : 'transparent',
            color: activeTab === 'ledger' ? '#1a1a1a' : '#6b7280',
            boxShadow: activeTab === 'ledger' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none'
          }}
        >
          Staff Labor Payouts
        </button>
      </div>

      {/* OVERVIEW VIEW */}
      {activeTab === 'bookings' && (
        <>
          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Monthly Revenue</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={18} /> ₹{metrics.monthlyRev}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Check-ins this month</span>
            </div>
            <div className="glass-panel" style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Pending</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary-gold)' }}>{metrics.pending}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Completed</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-teal)' }}>{metrics.completed}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No Shows: {metrics.noShow} | Total: {metrics.total}</span>
              </div>
            </div>
          </div>

          {/* Today's Highlights */}
          {(todaysCheckIns.length > 0 || todaysCheckOuts.length > 0) && (
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.02)', borderColor: 'var(--border-color)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} /> Today's Highlights ({todayStr})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todaysCheckIns.map(b => (
                  <div 
                    key={b.bookingId} 
                    onClick={() => onSelectBooking(b)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid rgba(13, 148, 136, 0.2)' }}
                  >
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>➡️ Check-In: {b.guestName}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Rooms: {b.roomSelection} | Pax: {b.totalPax}</p>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f766e' }}>₹{b.pendingAmount} due</span>
                  </div>
                ))}

                {todaysCheckOuts.map(b => (
                  <div 
                    key={b.bookingId} 
                    onClick={() => onSelectBooking(b)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(225, 29, 72, 0.08)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid rgba(225, 29, 72, 0.2)' }}
                  >
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>⬅️ Check-Out: {b.guestName}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Rooms: {b.roomSelection} | Settlement: {b.settlement}</p>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: b.settlement === 'Yes' ? '#0f766e' : '#be123c' }}>
                      {b.settlement === 'Yes' ? 'Settled' : 'Unsettled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtering and Search */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search guest or mobile..." 
                  className="form-control"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '38px', borderRadius: 'var(--radius-md)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Dynamic properties dropdown filter */}
                <select 
                  value={filterProperty} 
                  onChange={e => setFilterProperty(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value="ALL">All Properties</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed Stay">Completed Stay</option>
                  <option value="No Show">No Show</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  value={filterBookingType} 
                  onChange={e => setFilterBookingType(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="B2C">B2C (Direct)</option>
                  <option value="B2B">B2B (Agency)</option>
                  <option value="REL">REL (Relatives)</option>
                </select>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
                  <input 
                    type="date"
                    className="form-control"
                    value={checkInStart}
                    onChange={e => setCheckInStart(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '6px' }}
                  />
                  <span style={{ fontSize: '0.7rem' }}>to</span>
                  <input 
                    type="date"
                    className="form-control"
                    value={checkInEnd}
                    onChange={e => setCheckInEnd(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '6px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Bookings List */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-secondary)' }}>
              Bookings ({filteredBookings.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredBookings.length === 0 ? (
                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No bookings match the filters.
                </div>
              ) : (
                filteredBookings.map(b => {
                  const prefix = b.bookingId ? b.bookingId.substring(0, 3) : 'KGH';
                  return (
                    <div 
                      key={b.bookingId} 
                      onClick={() => onSelectBooking(b)}
                      className="glass-panel"
                      style={{ padding: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: 'var(--radius-sm)', 
                          backgroundColor: '#f3f4f6',
                          color: '#1a1a1a',
                          border: '1px solid var(--border-color)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.85rem'
                        }}>
                          {prefix}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>{b.guestName}</h4>
                          
                          {/* Visual Accent Badge with Ordinal Date Formatting (US Version 1.1) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span 
                              className="badge" 
                              style={{ 
                                background: '#f3f4f6', 
                                color: '#1a1a1a', 
                                border: '1px solid var(--border-color)', 
                                fontWeight: '600',
                                fontSize: '0.65rem',
                                padding: '2px 8px'
                              }}
                            >
                              {formatOrdinalDate(b.checkInDate)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Rooms: {b.roomSelection}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className={`badge ${
                          b.paymentStatus === 'Completed Stay' || b.paymentStatus === 'Completed' ? 'badge-completed' :
                          b.paymentStatus === 'Pending' ? 'badge-pending' : 'badge-noshow'
                        }`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                          {b.paymentStatus}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                          ₹{b.finalTariff}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming in 7 Days */}
          {next7DaysBookings.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-primary)' }}>
                Upcoming Check-ins (Next 7 days)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {next7DaysBookings.map(b => (
                  <div 
                    key={b.bookingId} 
                    onClick={() => onSelectBooking(b)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <div>
                      <span style={{ fontWeight: '600' }}>{b.guestName}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>({formatOrdinalDate(b.checkInDate)})</span>
                    </div>
                    <span style={{ fontWeight: '600' }}>Rooms: {b.roomSelection}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* LEDGER / WORKER LABOR PAYOUTS VIEW (US Version 1.1 New View) */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Sub-tab view */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <button
              onClick={() => setLedgerSubTab('pending')}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 12px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                color: ledgerSubTab === 'pending' ? 'var(--accent-rose)' : 'var(--text-muted)',
                borderBottom: ledgerSubTab === 'pending' ? '2px solid var(--accent-rose)' : 'none'
              }}
            >
              Pending Labor Dues ({pendingLaborDues.length})
            </button>
            <button
              onClick={() => setLedgerSubTab('paid')}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 12px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                color: ledgerSubTab === 'paid' ? 'var(--accent-teal)' : 'var(--text-muted)',
                borderBottom: ledgerSubTab === 'paid' ? '2px solid var(--accent-teal)' : 'none'
              }}
            >
              Paid Logs ({paidLaborLogs.length})
            </button>
          </div>

          {/* Dynamic List Rendering */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ledgerSubTab === 'pending' ? (
              pendingLaborDues.length === 0 ? (
                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  🎉 No pending labor dues! All staff F&B reimbursements are settled.
                </div>
              ) : (
                pendingLaborDues.map(b => (
                  <div key={b.bookingId} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{b.guestName}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {b.bookingId} | Checkout: {formatOrdinalDate(b.checkOutDate)}</span>
                      </div>
                      <span className="badge badge-noshow" style={{ fontSize: '0.65rem' }}>Pending payout</span>
                    </div>

                    <div style={{ background: '#f9fafb', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                      <div>
                        <p style={{ color: 'var(--text-muted)' }}>Rooms Booked</p>
                        <p style={{ fontWeight: '600' }}>{b.roomSelection}</p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-muted)' }}>Stay Details</p>
                        <p style={{ fontWeight: '600' }}>{b.totalPax} Pax | {b.totalNights} Nights</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Owed Fooding Amount (₹400/Pax/N)</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-rose)' }}>₹{b.foodingTotal}</p>
                      </div>
                      
                      <button 
                        onClick={() => handleSettleLabor(b.bookingId)}
                        className="btn btn-teal" 
                        style={{ width: 'auto', padding: '8px 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                      >
                        <CheckCircle2 size={16} /> Mark Paid
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              paidLaborLogs.length === 0 ? (
                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Archive is empty.
                </div>
              ) : (
                paidLaborLogs.map(b => (
                  <div key={b.bookingId} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{b.guestName}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {b.bookingId} | Checkout: {formatOrdinalDate(b.checkOutDate)}</span>
                      </div>
                      <span className="badge badge-completed" style={{ fontSize: '0.65rem' }}>Paid & Cleared</span>
                    </div>

                    <div style={{ background: '#f9fafb', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                      <div>
                        <p style={{ color: 'var(--text-muted)' }}>Rooms Booked</p>
                        <p style={{ fontWeight: '600' }}>{b.roomSelection}</p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-muted)' }}>Stay Details</p>
                        <p style={{ fontWeight: '600' }}>{b.totalPax} Pax | {b.totalNights} Nights</p>
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fooding Payout Amount Reimbursement</p>
                      <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-teal)' }}>₹{b.foodingTotal}</p>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

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
