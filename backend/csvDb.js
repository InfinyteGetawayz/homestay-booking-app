const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const CSV_FILE = path.join(DATA_DIR, 'bookings.csv');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Columns definition in order
const COLUMNS = [
  'bookingId', 'guestName', 'mobileNumber', 'bookingDate', 'typeOfBooking',
  'perAdultTariff', 'perChildTariff', 'numberAdults', 'numberChildren5Plus', 'numberChildrenUnder5',
  'checkInDate', 'checkOutDate', 'advanceAmount', 'roomSelection', 'foodPreference',
  'dietaryRestrictions', 'specialRequest', 'communicationTransport', 'b2bAgencyName',
  'settlement', 'paymentStatus', 'mutedReminders', 'createdAt',
  'totalNights', 'totalPax', 'totalAdultTariff', 'totalChildTariff', 'finalTariff',
  'pendingAmount', 'foodingTotal', 'lodgingTotal'
];

// Robust RFC 4180 CSV Parser
function parseCSV(text) {
  const result = [];
  let row = [''];
  let inQuotes = false;

  if (!text) return result;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      result.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    result.push(row);
  }
  return result;
}

// Convert Array to CSV Row string
function toCSVRow(arr) {
  return arr.map(val => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    }
    return str;
  }).join(',') + '\n';
}

// Write the headers if file doesn't exist
if (!fs.existsSync(CSV_FILE)) {
  const headerRow = toCSVRow(COLUMNS);
  fs.writeFileSync(CSV_FILE, headerRow, 'utf8');
}

// Create backup file
function createBackup() {
  if (!fs.existsSync(CSV_FILE)) return;
  
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '')
    .split('.')[0];
  
  const backupFileName = `bookings_${timestamp}.csv`;
  const backupPath = path.join(BACKUPS_DIR, backupFileName);
  
  fs.copyFileSync(CSV_FILE, backupPath);

  // Maintain max 50 backups
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('bookings_') && f.endsWith('.csv'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time); // newest first

    if (files.length > 50) {
      for (let i = 50; i < files.length; i++) {
        fs.unlinkSync(path.join(BACKUPS_DIR, files[i].name));
      }
    }
  } catch (err) {
    console.error('Backup rotation failed:', err);
  }
}

// Load all bookings
function getBookings() {
  try {
    const text = fs.readFileSync(CSV_FILE, 'utf8');
    const rows = parseCSV(text);
    if (rows.length === 0) return [];
    
    const headers = rows[0].map(h => h.trim());
    const bookings = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < headers.length) continue; // skip incomplete rows
      
      const booking = {};
      headers.forEach((header, idx) => {
        let val = row[idx];
        // Parse types
        if (['perAdultTariff', 'perChildTariff', 'numberAdults', 'numberChildren5Plus', 
             'numberChildrenUnder5', 'advanceAmount', 'totalNights', 'totalPax', 
             'totalAdultTariff', 'totalChildTariff', 'finalTariff', 'pendingAmount', 
             'foodingTotal', 'lodgingTotal'].includes(header)) {
          booking[header] = val === '' ? 0 : Number(val);
        } else if (header === 'mutedReminders') {
          booking[header] = val === 'true';
        } else {
          booking[header] = val;
        }
      });
      bookings.push(booking);
    }
    return bookings;
  } catch (err) {
    console.error('Failed to read database:', err);
    return [];
  }
}

// Write the CSV content atomically to avoid partial or conflicting writes
function writeCsvAtomically(content) {
  const tempPath = `${CSV_FILE}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, CSV_FILE);
}

// Save all bookings (with automatic backup)
function saveBookings(bookings) {
  createBackup();
  let content = toCSVRow(COLUMNS);
  
  bookings.forEach(b => {
    const row = COLUMNS.map(col => {
      let val = b[col];
      if (col === 'mutedReminders') {
        return val ? 'true' : 'false';
      }
      return val === undefined ? '' : val;
    });
    content += toCSVRow(row);
  });
  
  writeCsvAtomically(content);
}

// Generate sequential booking ID
// e.g. KGH01, KOL01 based on dynamic property code
function generateBookingId(prefix) {
  const bookings = getBookings();
  const propBookings = bookings.filter(b => b.bookingId && b.bookingId.startsWith(prefix));
  
  let maxNum = 0;
  propBookings.forEach(b => {
    const numPart = b.bookingId.substring(prefix.length);
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(2, '0')}`;
}

// Compute the 10 outputs from inputs
function computeBookingFields(data) {
  // Input Parsing
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  const diffTime = checkOut.getTime() - checkIn.getTime();
  const totalNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const numberAdults = parseInt(data.numberAdults, 10) || 1;
  const numberChildren5Plus = parseInt(data.numberChildren5Plus, 10) || 0;
  const numberChildrenUnder5 = parseInt(data.numberChildrenUnder5, 10) || 0;

  const totalPax = numberAdults + numberChildren5Plus;

  const perAdultTariff = parseFloat(data.perAdultTariff) || 0;
  const perChildTariff = parseFloat(data.perChildTariff) || 0;
  const advanceAmount = parseFloat(data.advanceAmount) || 0;

  const totalAdultTariff = numberAdults * perAdultTariff * totalNights;
  const totalChildTariff = numberChildren5Plus * perChildTariff * totalNights;
  const finalTariff = totalAdultTariff + totalChildTariff;

  const pendingAmount = finalTariff - advanceAmount;

  // Fooding rate is fixed at 400 per person per night
  const foodingTotal = 400 * totalPax * totalNights;
  const lodgingTotal = finalTariff - foodingTotal;

  return {
    totalNights,
    totalPax,
    totalAdultTariff,
    totalChildTariff,
    finalTariff,
    pendingAmount,
    foodingTotal,
    lodgingTotal
  };
}

// Double booking overlap validation engine
function checkRoomOverlaps(checkInStr, checkOutStr, roomsStr, ignoreBookingId = null) {
  const checkIn = new Date(checkInStr);
  const checkOut = new Date(checkOutStr);
  
  const selectedRooms = roomsStr.split(',').map(r => r.trim());
  const bookings = getBookings();

  for (const b of bookings) {
    if (b.paymentStatus === 'No Show') continue;
    if (ignoreBookingId && b.bookingId === ignoreBookingId) continue;

    const existingIn = new Date(b.checkInDate);
    const existingOut = new Date(b.checkOutDate);

    // Target Intersect = (Selected Check-In < Existing Check-Out) AND (Selected Check-Out > Existing Check-In)
    const datesOverlap = checkIn < existingOut && checkOut > existingIn;

    if (datesOverlap) {
      const existingRooms = b.roomSelection.split(',').map(r => r.trim());
      // Check room intersection
      const conflictingRoom = selectedRooms.find(r => existingRooms.includes(r));
      if (conflictingRoom) {
        return {
          conflictingRoom,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate
        };
      }
    }
  }
  return null;
}

module.exports = {
  getBookings,
  saveBookings,
  generateBookingId,
  computeBookingFields,
  checkRoomOverlaps,
  createBackup,
  CSV_FILE,
  BACKUPS_DIR
};
