const { Pool } = require('pg');

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Booking columns definition (same as CSV)
const COLUMNS = [
  'bookingId', 'guestName', 'mobileNumber', 'bookingDate', 'typeOfBooking',
  'perAdultTariff', 'perChildTariff', 'numberAdults', 'numberChildren5Plus', 'numberChildrenUnder5',
  'checkInDate', 'checkOutDate', 'advanceAmount', 'roomSelection', 'foodPreference',
  'dietaryRestrictions', 'specialRequest', 'communicationTransport', 'b2bAgencyName',
  'settlement', 'paymentStatus', 'mutedReminders', 'createdAt',
  'totalNights', 'totalPax', 'totalAdultTariff', 'totalChildTariff', 'finalTariff',
  'pendingAmount', 'foodingTotal', 'lodgingTotal'
];

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        "bookingId" VARCHAR(50) UNIQUE NOT NULL,
        "guestName" VARCHAR(255) NOT NULL,
        "mobileNumber" VARCHAR(20) NOT NULL,
        "bookingDate" DATE,
        "typeOfBooking" VARCHAR(50),
        "perAdultTariff" NUMERIC(10,2) DEFAULT 0,
        "perChildTariff" NUMERIC(10,2) DEFAULT 0,
        "numberAdults" INTEGER DEFAULT 0,
        "numberChildren5Plus" INTEGER DEFAULT 0,
        "numberChildrenUnder5" INTEGER DEFAULT 0,
        "checkInDate" DATE NOT NULL,
        "checkOutDate" DATE NOT NULL,
        "advanceAmount" NUMERIC(10,2) DEFAULT 0,
        "roomSelection" TEXT NOT NULL,
        "foodPreference" VARCHAR(100) DEFAULT 'Veg',
        "dietaryRestrictions" TEXT DEFAULT '',
        "specialRequest" TEXT DEFAULT '',
        "communicationTransport" VARCHAR(255) DEFAULT 'To Be Arranged',
        "b2bAgencyName" VARCHAR(255) DEFAULT '',
        "settlement" VARCHAR(50) DEFAULT 'No',
        "paymentStatus" VARCHAR(50) DEFAULT 'Pending',
        "mutedReminders" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "totalNights" INTEGER DEFAULT 0,
        "totalPax" INTEGER DEFAULT 0,
        "totalAdultTariff" NUMERIC(10,2) DEFAULT 0,
        "totalChildTariff" NUMERIC(10,2) DEFAULT 0,
        "finalTariff" NUMERIC(10,2) DEFAULT 0,
        "pendingAmount" NUMERIC(10,2) DEFAULT 0,
        "foodingTotal" NUMERIC(10,2) DEFAULT 0,
        "lodgingTotal" NUMERIC(10,2) DEFAULT 0
      );
    `);

    // Create properties table
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        "propertyId" VARCHAR(50) UNIQUE NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "rooms" TEXT[] NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(50) PRIMARY KEY,
        "description" TEXT NOT NULL,
        "expenseDate" DATE,
        "amount" NUMERIC(10,2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default properties if they don't exist
    const propertiesCheck = await client.query('SELECT COUNT(*) as count FROM properties');
    if (propertiesCheck.rows[0].count === 0) {
      await client.query(`
        INSERT INTO properties ("propertyId", "name", "rooms")
        VALUES 
          ('KGH', 'Kanchan Ghar Homestay', ARRAY['R1', 'R2', 'R3', 'L1']),
          ('MBH', 'Mungpoo Bliss Homestay', ARRAY['FR', 'FL', 'BL', 'BR'])
      `);
    }

    // Insert default config if it doesn't exist
    const configCheck = await client.query('SELECT COUNT(*) as count FROM config');
    if (configCheck.rows[0].count === 0) {
      await client.query(`
        INSERT INTO config (key, value) VALUES ('globalMuteReminders', 'false')
      `);
    }

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Get all bookings
async function getBookings() {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY "createdAt" DESC');
    return result.rows.map(row => convertDatabaseRowToBooking(row));
  } catch (err) {
    console.error('Failed to read bookings:', err);
    return [];
  }
}

// Convert database row to booking object (with numeric conversions)
function convertDatabaseRowToBooking(row) {
  return {
    bookingId: row.bookingId,
    guestName: row.guestName,
    mobileNumber: row.mobileNumber,
    bookingDate: row.bookingDate,
    typeOfBooking: row.typeOfBooking,
    perAdultTariff: parseFloat(row.perAdultTariff) || 0,
    perChildTariff: parseFloat(row.perChildTariff) || 0,
    numberAdults: parseInt(row.numberAdults) || 0,
    numberChildren5Plus: parseInt(row.numberChildren5Plus) || 0,
    numberChildrenUnder5: parseInt(row.numberChildrenUnder5) || 0,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    advanceAmount: parseFloat(row.advanceAmount) || 0,
    roomSelection: row.roomSelection,
    foodPreference: row.foodPreference,
    dietaryRestrictions: row.dietaryRestrictions,
    specialRequest: row.specialRequest,
    communicationTransport: row.communicationTransport,
    b2bAgencyName: row.b2bAgencyName,
    settlement: row.settlement,
    paymentStatus: row.paymentStatus,
    mutedReminders: row.mutedReminders,
    createdAt: row.createdAt,
    totalNights: parseInt(row.totalNights) || 0,
    totalPax: parseInt(row.totalPax) || 0,
    totalAdultTariff: parseFloat(row.totalAdultTariff) || 0,
    totalChildTariff: parseFloat(row.totalChildTariff) || 0,
    finalTariff: parseFloat(row.finalTariff) || 0,
    pendingAmount: parseFloat(row.pendingAmount) || 0,
    foodingTotal: parseFloat(row.foodingTotal) || 0,
    lodgingTotal: parseFloat(row.lodgingTotal) || 0
  };
}

// Insert a new booking
async function insertBooking(booking) {
  try {
    const result = await pool.query(`
      INSERT INTO bookings (
        "bookingId", "guestName", "mobileNumber", "bookingDate", "typeOfBooking",
        "perAdultTariff", "perChildTariff", "numberAdults", "numberChildren5Plus", "numberChildrenUnder5",
        "checkInDate", "checkOutDate", "advanceAmount", "roomSelection", "foodPreference",
        "dietaryRestrictions", "specialRequest", "communicationTransport", "b2bAgencyName",
        "settlement", "paymentStatus", "mutedReminders", "createdAt",
        "totalNights", "totalPax", "totalAdultTariff", "totalChildTariff", "finalTariff",
        "pendingAmount", "foodingTotal", "lodgingTotal"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      ) RETURNING *
    `, [
      booking.bookingId, booking.guestName, booking.mobileNumber, booking.bookingDate, booking.typeOfBooking,
      booking.perAdultTariff, booking.perChildTariff, booking.numberAdults, booking.numberChildren5Plus, booking.numberChildrenUnder5,
      booking.checkInDate, booking.checkOutDate, booking.advanceAmount, booking.roomSelection, booking.foodPreference,
      booking.dietaryRestrictions, booking.specialRequest, booking.communicationTransport, booking.b2bAgencyName,
      booking.settlement, booking.paymentStatus, booking.mutedReminders, booking.createdAt,
      booking.totalNights, booking.totalPax, booking.totalAdultTariff, booking.totalChildTariff, booking.finalTariff,
      booking.pendingAmount, booking.foodingTotal, booking.lodgingTotal
    ]);
    return convertDatabaseRowToBooking(result.rows[0]);
  } catch (err) {
    console.error('Failed to insert booking:', err);
    throw err;
  }
}

// Update a booking
async function updateBooking(bookingId, booking) {
  try {
    const result = await pool.query(`
      UPDATE bookings SET
        "guestName" = $1, "mobileNumber" = $2, "bookingDate" = $3, "typeOfBooking" = $4,
        "perAdultTariff" = $5, "perChildTariff" = $6, "numberAdults" = $7, "numberChildren5Plus" = $8, "numberChildrenUnder5" = $9,
        "checkInDate" = $10, "checkOutDate" = $11, "advanceAmount" = $12, "roomSelection" = $13, "foodPreference" = $14,
        "dietaryRestrictions" = $15, "specialRequest" = $16, "communicationTransport" = $17, "b2bAgencyName" = $18,
        "settlement" = $19, "paymentStatus" = $20, "mutedReminders" = $21,
        "totalNights" = $22, "totalPax" = $23, "totalAdultTariff" = $24, "totalChildTariff" = $25, "finalTariff" = $26,
        "pendingAmount" = $27, "foodingTotal" = $28, "lodgingTotal" = $29
      WHERE "bookingId" = $30
      RETURNING *
    `, [
      booking.guestName, booking.mobileNumber, booking.bookingDate, booking.typeOfBooking,
      booking.perAdultTariff, booking.perChildTariff, booking.numberAdults, booking.numberChildren5Plus, booking.numberChildrenUnder5,
      booking.checkInDate, booking.checkOutDate, booking.advanceAmount, booking.roomSelection, booking.foodPreference,
      booking.dietaryRestrictions, booking.specialRequest, booking.communicationTransport, booking.b2bAgencyName,
      booking.settlement, booking.paymentStatus, booking.mutedReminders,
      booking.totalNights, booking.totalPax, booking.totalAdultTariff, booking.totalChildTariff, booking.finalTariff,
      booking.pendingAmount, booking.foodingTotal, booking.lodgingTotal, bookingId
    ]);
    return result.rows.length > 0 ? convertDatabaseRowToBooking(result.rows[0]) : null;
  } catch (err) {
    console.error('Failed to update booking:', err);
    throw err;
  }
}

// Delete a booking
async function deleteBooking(bookingId) {
  try {
    await pool.query('DELETE FROM bookings WHERE "bookingId" = $1', [bookingId]);
  } catch (err) {
    console.error('Failed to delete booking:', err);
    throw err;
  }
}

// Check for room overlaps
async function checkRoomOverlaps(checkInStr, checkOutStr, roomsStr, ignoreBookingId = null) {
  try {
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    const selectedRooms = roomsStr.split(',').map(r => r.trim());

    let query = `
      SELECT * FROM bookings 
      WHERE "paymentStatus" != 'No Show'
      AND "checkInDate" < $1
      AND "checkOutDate" > $2
    `;
    const params = [checkOutStr, checkInStr];

    if (ignoreBookingId) {
      query += ` AND "bookingId" != $3`;
      params.push(ignoreBookingId);
    }

    const result = await pool.query(query, params);

    for (const row of result.rows) {
      const booking = convertDatabaseRowToBooking(row);
      const existingRooms = booking.roomSelection.split(',').map(r => r.trim());
      const conflictingRoom = selectedRooms.find(r => existingRooms.includes(r));

      if (conflictingRoom) {
        return {
          conflictingRoom,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to check room overlaps:', err);
    return null;
  }
}

// Generate booking ID
async function generateBookingId(prefix) {
  try {
    const result = await pool.query(
      'SELECT "bookingId" FROM bookings WHERE "bookingId" LIKE $1 ORDER BY "bookingId" DESC LIMIT 1',
      [prefix + '%']
    );

    let maxNum = 0;
    if (result.rows.length > 0) {
      const lastBookingId = result.rows[0].bookingId;
      const numPart = lastBookingId.substring(prefix.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num)) {
        maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(2, '0')}`;
  } catch (err) {
    console.error('Failed to generate booking ID:', err);
    return `${prefix}01`;
  }
}

// Compute booking fields (same logic as before)
function computeBookingFields(data) {
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

// Get all properties
async function getProperties() {
  try {
    const result = await pool.query('SELECT * FROM properties ORDER BY "createdAt" ASC');
    return result.rows.map(row => ({
      id: row.propertyId,
      name: row.name,
      rooms: row.rooms
    }));
  } catch (err) {
    console.error('Failed to read properties:', err);
    return [];
  }
}

// Insert property
async function insertProperty(property) {
  try {
    const result = await pool.query(`
      INSERT INTO properties ("propertyId", "name", "rooms")
      VALUES ($1, $2, $3)
      RETURNING *
    `, [property.id, property.name, property.rooms]);

    const row = result.rows[0];
    return {
      id: row.propertyId,
      name: row.name,
      rooms: row.rooms
    };
  } catch (err) {
    console.error('Failed to insert property:', err);
    throw err;
  }
}

// Update property rooms
async function updatePropertyRooms(propertyId, rooms) {
  try {
    const result = await pool.query(`
      UPDATE properties SET "rooms" = $1 WHERE "propertyId" = $2
      RETURNING *
    `, [rooms, propertyId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.propertyId,
      name: row.name,
      rooms: row.rooms
    };
  } catch (err) {
    console.error('Failed to update property rooms:', err);
    throw err;
  }
}

// Delete property
async function deleteProperty(propertyId) {
  try {
    await pool.query('DELETE FROM properties WHERE "propertyId" = $1', [propertyId]);
  } catch (err) {
    console.error('Failed to delete property:', err);
    throw err;
  }
}

// Get expenses
async function getExpenses() {
  try {
    const result = await pool.query('SELECT * FROM expenses ORDER BY "createdAt" DESC');
    return result.rows.map(row => ({
      id: row.id,
      description: row.description,
      expenseDate: row.expenseDate,
      amount: parseFloat(row.amount),
      createdAt: row.createdAt
    }));
  } catch (err) {
    console.error('Failed to read expenses:', err);
    return [];
  }
}

// Insert expense
async function insertExpense(expense) {
  try {
    const result = await pool.query(`
      INSERT INTO expenses (id, "description", "expenseDate", "amount")
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [expense.id, expense.description, expense.expenseDate, expense.amount]);

    const row = result.rows[0];
    return {
      id: row.id,
      description: row.description,
      expenseDate: row.expenseDate,
      amount: parseFloat(row.amount),
      createdAt: row.createdAt
    };
  } catch (err) {
    console.error('Failed to insert expense:', err);
    throw err;
  }
}

// Delete expense
async function deleteExpenseById(expenseId) {
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [expenseId]);
  } catch (err) {
    console.error('Failed to delete expense:', err);
    throw err;
  }
}

// Get settings
async function getSettings() {
  try {
    const result = await pool.query('SELECT * FROM config WHERE key = $1', ['globalMuteReminders']);
    if (result.rows.length === 0) {
      return { globalMuteReminders: false };
    }
    return {
      globalMuteReminders: result.rows[0].value === 'true'
    };
  } catch (err) {
    console.error('Failed to read settings:', err);
    return { globalMuteReminders: false };
  }
}

// Update settings
async function updateSettings(settings) {
  try {
    await pool.query(`
      UPDATE config SET value = $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE key = 'globalMuteReminders'
    `, [String(settings.globalMuteReminders)]);

    return settings;
  } catch (err) {
    console.error('Failed to update settings:', err);
    throw err;
  }
}

// Generate CSV content from bookings
async function generateCSVContent() {
  const bookings = await getBookings();
  let content = COLUMNS.join(',') + '\n';

  for (const booking of bookings) {
    const row = COLUMNS.map(col => {
      let val = booking[col];
      if (val === null || val === undefined) return '""';
      
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    });
    content += row.join(',') + '\n';
  }

  return content;
}

// Close database connection
async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  initializeDatabase,
  getBookings,
  insertBooking,
  updateBooking,
  deleteBooking,
  checkRoomOverlaps,
  generateBookingId,
  computeBookingFields,
  getProperties,
  insertProperty,
  updatePropertyRooms,
  deleteProperty,
  getExpenses,
  insertExpense,
  deleteExpenseById,
  getSettings,
  updateSettings,
  generateCSVContent,
  closePool,
  COLUMNS
};
