export function getBookingPropertyId(booking, properties = []) {
  if (booking?.propertyId) return booking.propertyId;

  const bookingId = String(booking?.bookingId || '').toUpperCase();
  const idMatch = properties.find(property => bookingId.startsWith(String(property.id || '').toUpperCase()));
  if (idMatch) return idMatch.id;

  const bookedRooms = String(booking?.roomSelection || '')
    .split(',')
    .map(room => room.trim())
    .filter(Boolean);
  const roomMatch = properties.find(property => {
    const knownRooms = [
      ...(property.rooms || []),
      ...(property.configurationHistory || []).flatMap(configuration => configuration.rooms || [])
    ];
    return bookedRooms.some(room => knownRooms.includes(room));
  });

  return roomMatch?.id || '';
}

export function getPropertyConfiguration(property, date) {
  const history = [...(property?.configurationHistory || [])]
    .filter(configuration => configuration.effectiveFrom)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  const configuration = history
    .filter(item => !date || item.effectiveFrom <= date)
    .at(-1);

  return configuration || {
    effectiveFrom: '',
    rooms: property?.rooms || [],
    foodAdultTariff: property?.foodAdultTariff ?? 400,
    foodChildTariff: property?.foodChildTariff ?? 200
  };
}

export function getBusinessYearStart(endDate) {
  if (!endDate) return '';
  const [year, month, day] = endDate.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return nextDay.toISOString().slice(0, 10);
}
