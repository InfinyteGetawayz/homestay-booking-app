import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { getBusinessYearStart } from '../utils/property';
import { calculatePropertyAccounts } from '../utils/financials';

const localDateString = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Accounts({ token, bookings = [], properties = [] }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('ALL');

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

  const today = localDateString(new Date());
  const summaries = useMemo(() => properties.map(property => {
    const startDate = getBusinessYearStart(property.businessYearEndDate);
    return { property, startDate,
      ...calculatePropertyAccounts(bookings, expenses, properties, property.id, startDate, today) };
  }), [bookings, expenses, properties, today]);

  const visibleSummaries = selectedPropertyId === 'ALL'
    ? summaries
    : summaries.filter(summary => summary.property.id === selectedPropertyId);
  const visibleExpenses = expenses.filter(item => selectedPropertyId === 'ALL' || item.propertyId === selectedPropertyId);
  const unassignedExpenses = expenses.filter(item => !item.propertyId);
  const unassignedCapex = unassignedExpenses.filter(item => item.expenseType === 'Capex').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const unassignedOpex = unassignedExpenses.filter(item => item.expenseType !== 'Capex').reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} /> Accounts
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Income excludes fooding. Operating profit subtracts Opex; Capex is shown separately and included in cash after Capex.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="accounts-property">Homestay</label>
          <select id="accounts-property" className="form-control" value={selectedPropertyId} onChange={event => setSelectedPropertyId(event.target.value)}>
            <option value="ALL">All homestays</option>
            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
      </div>

      {visibleSummaries.map(({ property, startDate, income, capex, opex, expenditure, operatingProfit, cashAfterCapex }) => (
        <section key={property.id} className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '4px' }}>{property.name}</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {startDate ? `Business year from ${startDate}` : 'All recorded dates'}
          </p>
          <dl className="accounts-grid">
            <div><dt>Income</dt><dd className="income">₹{income.toFixed(2)}</dd></div>
            <div><dt>Opex</dt><dd>₹{opex.toFixed(2)}</dd></div>
            <div><dt>Capex</dt><dd>₹{capex.toFixed(2)}</dd></div>
            <div><dt>Total Expenditure</dt><dd>₹{expenditure.toFixed(2)}</dd></div>
            <div><dt>Operating Profit / Loss</dt><dd className={operatingProfit >= 0 ? 'income' : 'loss'}>₹{operatingProfit.toFixed(2)}</dd></div>
            <div><dt>Cash After Capex</dt><dd className={cashAfterCapex >= 0 ? 'income' : 'loss'}>₹{cashAfterCapex.toFixed(2)}</dd></div>
          </dl>
        </section>
      ))}

      {selectedPropertyId === 'ALL' && unassignedExpenses.length > 0 && (
        <section className="glass-panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '4px' }}>Unassigned legacy expenses</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            These older records have no homestay saved and are not included in property totals.
          </p>
          <dl className="accounts-grid">
            <div><dt>Opex</dt><dd>₹{unassignedOpex.toFixed(2)}</dd></div>
            <div><dt>Capex</dt><dd>₹{unassignedCapex.toFixed(2)}</dd></div>
          </dl>
        </section>
      )}

      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px' }}>Expense Summary</h3>
        {loading ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : visibleExpenses.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No expenses recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleExpenses.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{item.description}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {properties.find(property => property.id === item.propertyId)?.name || 'Unassigned'} · {item.expenseType || 'Opex'}
                  </div>
                </div>
                <div style={{ color: '#be123c', fontWeight: '700' }}>₹{Number(item.amount || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
