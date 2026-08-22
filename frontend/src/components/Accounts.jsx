import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { API_BASE } from '../apiBase';

export default function Accounts({ token, bookings = [] }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setExpenses(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const income = bookings.reduce((sum, booking) => sum + (
      booking.paymentStatus === 'No Show'
        ? Number(booking.finalTariff || 0)
        : Number(booking.lodgingTotal || 0)
    ), 0);
    const expenditure = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const profit = income - expenditure;
    return { income, expenditure, profit };
  }, [bookings, expenses]);

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} /> Accounts
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Income is derived from bookings, excluding fooding amounts. Expenses come from the expense ledger.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(13, 148, 136, 0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Income</div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f766e' }}>₹{summary.income.toFixed(2)}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(225, 29, 72, 0.08)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Expenditure</div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#be123c' }}>₹{summary.expenditure.toFixed(2)}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.12)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Profit / Loss</div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: summary.profit >= 0 ? '#0f766e' : '#be123c' }}>
              ₹{summary.profit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px' }}>Expense Summary</h3>
        {loading ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : expenses.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No expenses recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: '600' }}>{item.description}</div>
                <div style={{ color: '#be123c', fontWeight: '700' }}>₹{Number(item.amount || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
