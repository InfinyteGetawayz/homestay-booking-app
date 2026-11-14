import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBusinessYearTotals, calculatePropertyAccounts } from './financials.js';

const properties = [{ id: 'KGH', rooms: ['Room A'] }, { id: 'MBH', rooms: ['Room B'] }];
const bookings = [
  { propertyId: 'KGH', checkInDate: '2026-03-31', finalTariff: 500, lodgingTotal: 400, foodingTotal: 100 },
  { propertyId: 'KGH', checkInDate: '2026-04-01', paymentStatus: 'No Show', finalTariff: 1000, advanceAmount: 300, lodgingTotal: 1000, foodingTotal: 500 },
  { propertyId: 'KGH', checkInDate: '2026-04-02', paymentStatus: 'Completed Stay', finalTariff: 1200, lodgingTotal: 750, foodingTotal: 450 },
  { propertyId: 'MBH', checkInDate: '2026-04-02', finalTariff: 900, lodgingTotal: 600, foodingTotal: 300 }
];
const expenses = [
  { propertyId: 'KGH', expenseDate: '2026-04-02', expenseType: 'Opex', amount: 100 },
  { propertyId: 'KGH', expenseDate: '2026-04-03', expenseType: 'Capex', amount: 40 },
  { propertyId: 'MBH', expenseDate: '2026-04-03', expenseType: 'Opex', amount: 500 }
];

test('business year totals use the new start date and count No Show advance as lodging', () => {
  assert.deepEqual(calculateBusinessYearTotals(bookings, properties, 'KGH', '2026-04-01', '2027-03-31'), {
    lodging: 1050,
    fooding: 450,
    booking: 2200
  });
});

test('property accounts separate Capex from Opex and isolate homestay totals', () => {
  assert.deepEqual(calculatePropertyAccounts(bookings, expenses, properties, 'KGH', '2026-04-01', '2027-03-31'), {
    income: 1050,
    capex: 40,
    opex: 100,
    expenditure: 140,
    operatingProfit: 950,
    cashAfterCapex: 910
  });
});
