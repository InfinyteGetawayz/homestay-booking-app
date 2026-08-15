const crypto = require('crypto');
const db = require('./database');

async function addExpense(input) {
  const item = {
    id: `EXP-${crypto.randomBytes(4).toString('hex')}`,
    description: String(input.description || '').trim(),
    expenseDate: input.expenseDate || '',
    amount: Number(input.amount || 0),
    createdAt: new Date().toISOString()
  };

  if (!item.description || Number.isNaN(item.amount)) {
    throw new Error('Invalid expense payload');
  }

  return await db.insertExpense(item);
}

async function deleteExpense(id) {
  return await db.deleteExpenseById(id);
}

module.exports = {
  addExpense,
  deleteExpense
};
