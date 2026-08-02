import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { API_BASE } from '../apiBase';

export default function Expenses({ token }) {
  const [items, setItems] = useState([]);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!description.trim() || !amount) {
      setMessage({ type: 'error', text: 'Please enter an expense name and amount.' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          description: description.trim(),
          expenseDate: expenseDate || '' ,
          amount: Number(amount)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setItems(prev => [data, ...prev]);
        setDescription('');
        setExpenseDate('');
        setAmount('');
        setMessage({ type: 'success', text: 'Expense added.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add expense.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error while adding expense.' });
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="main-content" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} /> Expenses
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Record day-to-day expenditures for the property.
        </p>

        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            className="form-control"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Item / purpose"
          />
          <input
            className="form-control"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
          <input
            className="form-control"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
          />
          <button className="btn btn-primary" type="submit" style={{ padding: '10px' }}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Add Expense
          </button>
        </form>

        {message.text && (
          <div style={{ marginTop: '10px', fontSize: '0.8rem', color: message.type === 'error' ? '#be123c' : '#0f766e' }}>
            {message.text}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '10px' }}>Expense Ledger</h3>
        {loading ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No expenses recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{item.description}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {item.expenseDate ? new Date(item.expenseDate + 'T00:00:00').toLocaleDateString() : 'No date'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: '#be123c' }}>₹{Number(item.amount || 0).toFixed(2)}</span>
                  <button onClick={() => handleDeleteExpense(item.id)} style={{ background: 'none', border: 'none', color: '#be123c', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
