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
  'checkInDate', 'checkOutDate', 'advanceAmount', 'propertyId', 'roomSelection', 'foodPreference',
  'foodAdultTariff', 'foodChildTariff',
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
        "propertyId" VARCHAR(50),
        "roomSelection" TEXT NOT NULL,
        "foodAdultTariff" NUMERIC(10,2) DEFAULT 400,
        "foodChildTariff" NUMERIC(10,2) DEFAULT 400,
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
        "logo" TEXT,
        "foodAdultTariff" NUMERIC(10,2) DEFAULT 400,
        "foodChildTariff" NUMERIC(10,2) DEFAULT 400,
        "businessYearEndDate" DATE,
        "configurationHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
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
        "propertyId" VARCHAR(50),
        "expenseType" VARCHAR(20) NOT NULL DEFAULT 'Opex',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "propertyId" VARCHAR(50);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "foodAdultTariff" NUMERIC(10,2) DEFAULT 400;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "foodChildTariff" NUMERIC(10,2) DEFAULT 400;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS "logo" TEXT;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS "foodAdultTariff" NUMERIC(10,2) DEFAULT 400;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS "foodChildTariff" NUMERIC(10,2) DEFAULT 400;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS "businessYearEndDate" DATE;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS "configurationHistory" JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "propertyId" VARCHAR(50);
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS "expenseType" VARCHAR(20) NOT NULL DEFAULT 'Opex';
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
    throw err;
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
    propertyId: row.propertyId || '',
    roomSelection: row.roomSelection,
    foodPreference: row.foodPreference,
    foodAdultTariff: parseFloat(row.foodAdultTariff) || 0,
    foodChildTariff: parseFloat(row.foodChildTariff) || 0,
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
        "checkInDate", "checkOutDate", "advanceAmount", "propertyId", "roomSelection", "foodPreference",
        "foodAdultTariff", "foodChildTariff",
        "dietaryRestrictions", "specialRequest", "communicationTransport", "b2bAgencyName",
        "settlement", "paymentStatus", "mutedReminders", "createdAt",
        "totalNights", "totalPax", "totalAdultTariff", "totalChildTariff", "finalTariff",
        "pendingAmount", "foodingTotal", "lodgingTotal"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
      ) RETURNING *
    `, [
      booking.bookingId, booking.guestName, booking.mobileNumber, booking.bookingDate, booking.typeOfBooking,
      booking.perAdultTariff, booking.perChildTariff, booking.numberAdults, booking.numberChildren5Plus, booking.numberChildrenUnder5,
      booking.checkInDate, booking.checkOutDate, booking.advanceAmount, booking.propertyId, booking.roomSelection, booking.foodPreference,
      booking.foodAdultTariff, booking.foodChildTariff,
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
        "pendingAmount" = $27, "foodingTotal" = $28, "lodgingTotal" = $29,
        "propertyId" = $30, "foodAdultTariff" = $31, "foodChildTariff" = $32
      WHERE "bookingId" = $33
      RETURNING *
    `, [
      booking.guestName, booking.mobileNumber, booking.bookingDate, booking.typeOfBooking,
      booking.perAdultTariff, booking.perChildTariff, booking.numberAdults, booking.numberChildren5Plus, booking.numberChildrenUnder5,
      booking.checkInDate, booking.checkOutDate, booking.advanceAmount, booking.roomSelection, booking.foodPreference,
      booking.dietaryRestrictions, booking.specialRequest, booking.communicationTransport, booking.b2bAgencyName,
      booking.settlement, booking.paymentStatus, booking.mutedReminders,
      booking.totalNights, booking.totalPax, booking.totalAdultTariff, booking.totalChildTariff, booking.finalTariff,
      booking.pendingAmount, booking.foodingTotal, booking.lodgingTotal,
      booking.propertyId, booking.foodAdultTariff, booking.foodChildTariff, bookingId
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
async function checkRoomOverlaps(checkInStr, checkOutStr, roomsStr, ignoreBookingId = null, propertyId = null) {
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

    if (propertyId) {
      params.push(propertyId);
      query += ` AND "propertyId" = $${params.length}`;
    }
    if (ignoreBookingId) {
      params.push(ignoreBookingId);
      query += ` AND "bookingId" != $${params.length}`;
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

  const foodAdultTariff = data.foodAdultTariff == null ? 400 : (parseFloat(data.foodAdultTariff) || 0);
  const foodChildTariff = data.foodChildTariff == null ? 400 : (parseFloat(data.foodChildTariff) || 0);
  let foodingTotal = (numberAdults * foodAdultTariff + numberChildren5Plus * foodChildTariff) * totalNights;
  let lodgingTotal = finalTariff - foodingTotal;
  if (data.paymentStatus === 'No Show') {
    foodingTotal = 0;
    lodgingTotal = advanceAmount;
  }

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
      rooms: row.rooms,
      logo: row.logo || null,
      foodAdultTariff: Number(row.foodAdultTariff ?? 400),
      foodChildTariff: Number(row.foodChildTariff ?? 400),
      businessYearEndDate: row.businessYearEndDate || '',
      configurationHistory: row.configurationHistory || []
    }));
  } catch (err) {
    console.error('Failed to read properties:', err);
    throw err;
  }
}

function getPropertyConfiguration(property, date) {
  const history = [...(property?.configurationHistory || [])]
    .filter(configuration => configuration.effectiveFrom)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  const configuration = history.filter(item => !date || item.effectiveFrom <= date).at(-1);
  return configuration || {
    rooms: property?.rooms || [],
    foodAdultTariff: property?.foodAdultTariff ?? 400,
    foodChildTariff: property?.foodChildTariff ?? 400
  };
}

// Insert property
async function insertProperty(property) {
  try {
    const result = await pool.query(`
      INSERT INTO properties ("propertyId", "name", "rooms", "logo", "foodAdultTariff", "foodChildTariff", "businessYearEndDate", "configurationHistory")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [property.id, property.name, property.rooms, property.logo || null,
      property.foodAdultTariff ?? 400, property.foodChildTariff ?? 400,
      property.businessYearEndDate || null, JSON.stringify(property.configurationHistory || [])]);

    const row = result.rows[0];
    return {
      id: row.propertyId,
      name: row.name,
      rooms: row.rooms,
      logo: row.logo || null,
      foodAdultTariff: Number(row.foodAdultTariff ?? 400),
      foodChildTariff: Number(row.foodChildTariff ?? 400),
      businessYearEndDate: row.businessYearEndDate || '',
      configurationHistory: row.configurationHistory || []
    };
  } catch (err) {
    console.error('Failed to insert property:', err);
    throw err;
  }
}

async function updatePropertyLogo(propertyId, logo) {
  const result = await pool.query(`
    UPDATE properties SET "logo" = $1 WHERE "propertyId" = $2 RETURNING *
  `, [logo, propertyId]);
  const row = result.rows[0];
  return row ? {
    id: row.propertyId, name: row.name, rooms: row.rooms, logo: row.logo || null,
    foodAdultTariff: Number(row.foodAdultTariff ?? 400),
    foodChildTariff: Number(row.foodChildTariff ?? 400),
    businessYearEndDate: row.businessYearEndDate || '',
    configurationHistory: row.configurationHistory || []
  } : null;
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

async function updatePropertyConfiguration(propertyId, configuration) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query('SELECT * FROM properties WHERE "propertyId" = $1 FOR UPDATE', [propertyId]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }

    const effectiveFrom = configuration.effectiveFrom;
    let history = current.configurationHistory || [];
    if (history.length === 0) {
      history = [{
        effectiveFrom: '1900-01-01',
        rooms: current.rooms,
        foodAdultTariff: Number(current.foodAdultTariff ?? 400),
        foodChildTariff: Number(current.foodChildTariff ?? 400)
      }];
    }

    const nextConfiguration = {
      effectiveFrom,
      rooms: configuration.rooms,
      foodAdultTariff: Number(configuration.foodAdultTariff),
      foodChildTariff: Number(configuration.foodChildTariff)
    };
    const existingIndex = history.findIndex(item => item.effectiveFrom === effectiveFrom);
    if (existingIndex >= 0) history[existingIndex] = nextConfiguration;
    else history.push(nextConfiguration);
    history.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));

    const result = await client.query(`
      UPDATE properties SET "rooms" = $1, "foodAdultTariff" = $2, "foodChildTariff" = $3,
        "configurationHistory" = $4::jsonb
      WHERE "propertyId" = $5 RETURNING *
    `, [configuration.rooms, nextConfiguration.foodAdultTariff, nextConfiguration.foodChildTariff,
      JSON.stringify(history), propertyId]);
    await client.query('COMMIT');
    const row = result.rows[0];
    return {
      id: row.propertyId, name: row.name, rooms: row.rooms, logo: row.logo || null,
      foodAdultTariff: Number(row.foodAdultTariff ?? 400),
      foodChildTariff: Number(row.foodChildTariff ?? 400),
      businessYearEndDate: row.businessYearEndDate || '',
      configurationHistory: row.configurationHistory || []
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateBusinessYearEndDate(propertyId, businessYearEndDate) {
  const result = await pool.query(`
    UPDATE properties SET "businessYearEndDate" = $1
    WHERE "propertyId" = $2 RETURNING *
  `, [businessYearEndDate || null, propertyId]);
  return result.rows[0] || null;
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
      propertyId: row.propertyId || '',
      expenseType: row.expenseType || 'Opex',
      createdAt: row.createdAt
    }));
  } catch (err) {
    console.error('Failed to read expenses:', err);
    throw err;
  }
}

// Insert expense
async function insertExpense(expense) {
  try {
    const result = await pool.query(`
      INSERT INTO expenses (id, "description", "expenseDate", "amount", "propertyId", "expenseType")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [expense.id, expense.description, expense.expenseDate, expense.amount,
      expense.propertyId || null, expense.expenseType || 'Opex']);

    const row = result.rows[0];
    return {
      id: row.id,
      description: row.description,
      expenseDate: row.expenseDate,
      amount: parseFloat(row.amount),
      propertyId: row.propertyId || '',
      expenseType: row.expenseType || 'Opex',
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
    throw err;
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
  getPropertyConfiguration,
  insertProperty,
  updatePropertyLogo,
  updatePropertyRooms,
  updatePropertyConfiguration,
  updateBusinessYearEndDate,
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
