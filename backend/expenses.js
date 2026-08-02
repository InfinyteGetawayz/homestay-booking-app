const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function resolveDataDir() {
  if (!process.env.DATA_DIR) {
    return path.join(__dirname, 'data');
  }

  return path.isAbsolute(process.env.DATA_DIR)
    ? process.env.DATA_DIR
    : path.resolve(__dirname, process.env.DATA_DIR);
}

const DATA_DIR = resolveDataDir();
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXPENSES_FILE = path.join(DATA_DIR, 'expenses.json');

function writeAtomicJson(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function getExpenses() {
  if (!fs.existsSync(EXPENSES_FILE)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(EXPENSES_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read expenses:', err);
    return [];
  }
}

function saveExpenses(expenses) {
  try {
    writeAtomicJson(EXPENSES_FILE, expenses);
  } catch (err) {
    console.error('Failed to save expenses:', err);
  }
}

function addExpense(input) {
  const expenses = getExpenses();
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

  expenses.push(item);
  saveExpenses(expenses);
  return item;
}

function deleteExpense(id) {
  const expenses = getExpenses().filter(item => item.id !== id);
  saveExpenses(expenses);
  return expenses;
}

module.exports = {
  getExpenses,
  addExpense,
  deleteExpense,
  EXPENSES_FILE
};
