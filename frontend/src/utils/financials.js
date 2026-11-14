import { getBookingPropertyId } from './property.js';

const isInPeriod = (date, startDate, endDate) => Boolean(date)
  && (!startDate || date >= startDate)
  && (!endDate || date <= endDate);

export function calculateBusinessYearTotals(bookings, properties, propertyId, startDate, endDate) {
  const periodBookings = bookings.filter(booking =>
    getBookingPropertyId(booking, properties) === propertyId
    && isInPeriod(booking.checkInDate, startDate, endDate)
  );

  return {
    lodging: periodBookings.reduce((sum, booking) => sum + Number(
      booking.paymentStatus === 'No Show' ? booking.advanceAmount || 0 : booking.lodgingTotal || 0
    ), 0),
    fooding: periodBookings.reduce((sum, booking) => sum + Number(
      booking.paymentStatus === 'No Show' ? 0 : booking.foodingTotal || 0
    ), 0),
    booking: periodBookings.reduce((sum, booking) => sum + Number(booking.finalTariff || 0), 0)
  };
}

export function calculatePropertyAccounts(bookings, expenses, properties, propertyId, startDate, endDate) {
  const income = bookings
    .filter(booking => getBookingPropertyId(booking, properties) === propertyId
      && isInPeriod(booking.checkInDate, startDate, endDate))
    .reduce((sum, booking) => sum + Number(
      booking.paymentStatus === 'No Show' ? booking.advanceAmount || 0 : booking.lodgingTotal || 0
    ), 0);
  const periodExpenses = expenses.filter(item => item.propertyId === propertyId
    && isInPeriod(item.expenseDate, startDate, endDate));
  const capex = periodExpenses
    .filter(item => item.expenseType === 'Capex')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const opex = periodExpenses
    .filter(item => item.expenseType !== 'Capex')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    income,
    capex,
    opex,
    expenditure: capex + opex,
    operatingProfit: income - opex,
    cashAfterCapex: income - opex - capex
  };
}
