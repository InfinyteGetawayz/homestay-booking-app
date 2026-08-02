const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');
const csvDb = require('./csvDb');
const pushEngine = require('./pushEngine');
const expenses = require('./expenses');

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
const PROPERTIES_FILE = path.join(DATA_DIR, 'properties.json');

function getProperties() {
  if (!fs.existsSync(PROPERTIES_FILE)) {
    // Seed defaults
    const defaults = [
      { id: 'KGH', name: 'Kanchan Ghar Homestay', rooms: ['R1', 'R2', 'R3', 'L1'] },
      { id: 'MBH', name: 'Mungpoo Bliss Homestay', rooms: ['FR', 'FL', 'BL', 'BR'] }
    ];
    try {
      fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(defaults, null, 2), 'utf8');
    } catch (e) {}
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(PROPERTIES_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAtomicJson(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function saveProperties(props) {
  try {
    writeAtomicJson(PROPERTIES_FILE, props);
  } catch (e) {
    console.error('Failed to save properties:', e);
  }
}

let propertyOperation = Promise.resolve();
function queuePropertyOperation(operation) {
  propertyOperation = propertyOperation.then(operation, err => {
    console.error('Property operation queue error:', err);
    return operation();
  });
  return propertyOperation;
}

let bookingOperation = Promise.resolve();
function queueBookingOperation(operation) {
  bookingOperation = bookingOperation.then(operation, err => {
    console.error('Booking operation queue error:', err);
    return operation();
  });
  return bookingOperation;
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend build
app.use(express.static(path.join(__dirname, 'public')));

// Start Notification Scheduler
pushEngine.startScheduler();

// --- AUTH ENDPOINTS ---

app.get('/api/auth-status', (req, res) => {
  res.json({ isSetup: auth.hasPinSet() });
});

app.post('/api/setup-pin', (req, res) => {
  if (auth.hasPinSet()) {
    return res.status(400).json({ error: 'PIN is already set. Use change PIN instead.' });
  }
  const { pin } = req.body;
  if (!pin || pin.length < 4 || pin.length > 6 || isNaN(Number(pin))) {
    return res.status(400).json({ error: 'PIN must be a 4 to 6 digit number.' });
  }
  auth.setPin(pin);
  res.json({ success: true, message: 'PIN configured successfully!' });
});

app.post('/api/login', (req, res) => {
  const { pin } = req.body;
  if (!auth.hasPinSet()) {
    return res.status(400).json({ error: 'PIN is not set. Please set it first.' });
  }
  if (auth.verifyPin(pin)) {
    const token = auth.generateToken();
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid PIN. Access Denied.' });
  }
});

app.post('/api/change-pin', auth.authMiddleware, (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!auth.verifyPin(currentPin)) {
    return res.status(400).json({ error: 'Current PIN is incorrect.' });
  }
  if (!newPin || newPin.length < 4 || newPin.length > 6 || isNaN(Number(newPin))) {
    return res.status(400).json({ error: 'New PIN must be a 4 to 6 digit number.' });
  }
  auth.setPin(newPin);
  res.json({ success: true, message: 'PIN updated successfully!' });
});

// --- PROPERTIES DYNAMIC ENDPOINTS ---

app.get('/api/properties', (req, res) => {
  res.json(getProperties());
});

app.post('/api/properties', auth.authMiddleware, async (req, res) => {
  const { id, name, rooms } = req.body;
  if (!id || !name || !rooms || !Array.isArray(rooms)) {
    return res.status(400).json({ error: 'Invalid property configuration.' });
  }

  await queuePropertyOperation(async () => {
    const props = getProperties();
    if (props.some(p => p.id === id)) {
      throw { status: 400, error: `Property with ID ${id} already exists.` };
    }
    props.push({ id, name, rooms });
    saveProperties(props);
    res.status(201).json({ success: true, properties: props });
  }).catch(err => {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error('Property create failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to save property.' });
    }
  });
});

app.delete('/api/properties/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;

  await queuePropertyOperation(async () => {
    let props = getProperties();
    const exists = props.some(p => p.id === id);
    if (!exists) {
      throw { status: 404, error: 'Property not found.' };
    }
    props = props.filter(p => p.id !== id);
    saveProperties(props);
    res.json({ success: true, properties: props });
  }).catch(err => {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error('Property delete failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to delete property.' });
    }
  });
});

app.post('/api/properties/:id/rooms', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { rooms } = req.body;
  if (!rooms || !Array.isArray(rooms)) {
    return res.status(400).json({ error: 'Rooms array is required.' });
  }

  await queuePropertyOperation(async () => {
    const props = getProperties();
    const idx = props.findIndex(p => p.id === id);
    if (idx === -1) {
      throw { status: 404, error: 'Property not found.' };
    }
    props[idx].rooms = rooms;
    saveProperties(props);
    res.json({ success: true, properties: props });
  }).catch(err => {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error('Property update failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to update property rooms.' });
    }
  });
});

// --- SETTINGS ENDPOINTS ---

app.get('/api/settings', auth.authMiddleware, (req, res) => {
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  let config = { globalMuteReminders: false };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config.globalMuteReminders = !!parsed.globalMuteReminders;
    } catch (e) {}
  }
  res.json(config);
});

app.post('/api/settings', auth.authMiddleware, (req, res) => {
  const { globalMuteReminders } = req.body;
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  config.globalMuteReminders = !!globalMuteReminders;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, settings: config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// --- BOOKINGS ENDPOINTS ---

app.get('/api/bookings', auth.authMiddleware, (req, res) => {
  res.json(csvDb.getBookings());
});

app.get('/api/expenses', auth.authMiddleware, (req, res) => {
  res.json(expenses.getExpenses());
});

app.post('/api/expenses', auth.authMiddleware, (req, res) => {
  try {
    const item = expenses.addExpense(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add expense.' });
  }
});

app.delete('/api/expenses/:id', auth.authMiddleware, (req, res) => {
  const { id } = req.params;
  expenses.deleteExpense(id);
  res.json({ success: true });
});

app.post('/api/bookings', auth.authMiddleware, async (req, res) => {
  const bookingData = req.body;
  
  // Validation
  if (!bookingData.guestName || !bookingData.mobileNumber || !bookingData.typeOfBooking || 
      !bookingData.checkInDate || !bookingData.checkOutDate || !bookingData.roomSelection) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }
  if (bookingData.typeOfBooking === 'B2B' && !bookingData.b2bAgencyName) {
    return res.status(400).json({ error: 'B2B bookings require an Agency Name.' });
  }

  // Overlapping booking checks
  const overlap = csvDb.checkRoomOverlaps(bookingData.checkInDate, bookingData.checkOutDate, bookingData.roomSelection);
  if (overlap) {
    return res.status(400).json({ 
      error: `Booking Conflict: Room ${overlap.conflictingRoom} is already reserved from ${overlap.checkInDate} to ${overlap.checkOutDate}. Please select an alternative room or adjust dates.` 
    });
  }

  const bookings = csvDb.getBookings();

  // Find prefix/property matching selected rooms dynamically
  const props = getProperties();
  const selectedRoomsList = bookingData.roomSelection.split(',').map(r => r.trim());
  const matchedProp = props.find(p => p.rooms.some(r => selectedRoomsList.includes(r))) || props[0];
  const prefix = matchedProp ? matchedProp.id : 'KGH';

  const bookingId = csvDb.generateBookingId(prefix);
  
  // Compute calculated fields
  const computed = csvDb.computeBookingFields(bookingData);

  const newBooking = {
    bookingId,
    guestName: bookingData.guestName,
    mobileNumber: bookingData.mobileNumber,
    bookingDate: bookingData.bookingDate || new Date().toISOString().split('T')[0],
    typeOfBooking: bookingData.typeOfBooking,
    perAdultTariff: parseFloat(bookingData.perAdultTariff) || 0,
    perChildTariff: parseFloat(bookingData.perChildTariff) || 0,
    numberAdults: parseInt(bookingData.numberAdults) || 1,
    numberChildren5Plus: parseInt(bookingData.numberChildren5Plus) || 0,
    numberChildrenUnder5: parseInt(bookingData.numberChildrenUnder5) || 0,
    checkInDate: bookingData.checkInDate,
    checkOutDate: bookingData.checkOutDate,
    advanceAmount: parseFloat(bookingData.advanceAmount) || 0,
    roomSelection: bookingData.roomSelection,
    foodPreference: bookingData.foodPreference || 'Veg',
    dietaryRestrictions: bookingData.dietaryRestrictions || '',
    specialRequest: bookingData.specialRequest || '',
    communicationTransport: bookingData.communicationTransport || 'To Be Arranged',
    b2bAgencyName: bookingData.typeOfBooking === 'B2B' ? bookingData.b2bAgencyName : '',
    settlement: bookingData.settlement || 'No',
    paymentStatus: bookingData.paymentStatus || 'Pending',
    mutedReminders: !!bookingData.mutedReminders,
    createdAt: new Date().toISOString(),
    ...computed
  };

  await queueBookingOperation(async () => {
    bookings.push(newBooking);
    csvDb.saveBookings(bookings);
  }).catch(err => {
    console.error('Booking create failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create booking.' });
    }
    throw err;
  });

  // Trigger push alert checks for < 3 days check-in
  pushEngine.checkAndTriggerImmediate(newBooking);

  res.status(201).json(newBooking);
});

app.put('/api/bookings/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;
  const bookingData = req.body;
  await queueBookingOperation(async () => {
    const bookings = csvDb.getBookings();
    const idx = bookings.findIndex(b => b.bookingId === id);

    if (idx === -1) {
      throw { status: 404, error: 'Booking not found.' };
    }

    // Update validation
    if (bookingData.typeOfBooking === 'B2B' && !bookingData.b2bAgencyName) {
      throw { status: 400, error: 'B2B bookings require an Agency Name.' };
    }

    // Overlapping booking checks (ignoring this booking's own ID)
    const checkInToCheck = bookingData.checkInDate || bookings[idx].checkInDate;
    const checkOutToCheck = bookingData.checkOutDate || bookings[idx].checkOutDate;
    const roomsToCheck = bookingData.roomSelection || bookings[idx].roomSelection;

    const overlap = csvDb.checkRoomOverlaps(checkInToCheck, checkOutToCheck, roomsToCheck, id);
    if (overlap) {
      throw {
        status: 400,
        error: `Booking Conflict: Room ${overlap.conflictingRoom} is already reserved from ${overlap.checkInDate} to ${overlap.checkOutDate}. Please select an alternative room or adjust dates.`
      };
    }

    // Compute calculated fields using updated data
    const updatedInputs = { ...bookings[idx], ...bookingData };
    const computed = csvDb.computeBookingFields(updatedInputs);

    bookings[idx] = {
      ...updatedInputs,
      ...computed,
      bookingId: id
    };

    csvDb.saveBookings(bookings);

    // Re-check reminders
    pushEngine.checkAndTriggerImmediate(bookings[idx]);

    res.json(bookings[idx]);
  }).catch(err => {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error('Booking update failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to update booking.' });
    }
  });
});

app.delete('/api/bookings/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;

  await queueBookingOperation(async () => {
    let bookings = csvDb.getBookings();
    const exists = bookings.some(b => b.bookingId === id);

    if (!exists) {
      throw { status: 404, error: 'Booking not found.' };
    }

    bookings = bookings.filter(b => b.bookingId !== id);
    csvDb.saveBookings(bookings);
    res.json({ success: true, message: 'Booking deleted successfully.' });
  }).catch(err => {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.error });
    }
    console.error('Booking delete failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to delete booking.' });
    }
  });
});

// --- NOTIFICATION PUSH REGISTER ENDPOINTS ---

app.get('/api/vapid-key', (req, res) => {
  res.json({ publicKey: pushEngine.getPublicKey() });
});

app.post('/api/subscribe', auth.authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid subscription required.' });
  }
  pushEngine.subscribe(subscription);
  res.json({ success: true, message: 'Subscribed successfully for notifications.' });
});

app.post('/api/unsubscribe', auth.authMiddleware, (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Valid endpoint required.' });
  }
  pushEngine.unsubscribe(endpoint);
  res.json({ success: true, message: 'Unsubscribed successfully.' });
});

// --- BACKUP & DOWNLOAD ENDPOINTS ---

app.get('/api/export-csv', auth.authMiddleware, (req, res) => {
  if (fs.existsSync(csvDb.CSV_FILE)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
    fs.createReadStream(csvDb.CSV_FILE).pipe(res);
  } else {
    res.status(404).json({ error: 'CSV file not found.' });
  }
});

app.get('/api/backups', auth.authMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(csvDb.BACKUPS_DIR)
      .filter(f => f.startsWith('bookings_') && f.endsWith('.csv'))
      .map(f => {
        const filePath = path.join(csvDb.BACKUPS_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve backups.' });
  }
});

app.get('/api/backups/download/:filename', auth.authMiddleware, (req, res) => {
  const { filename } = req.params;
  // Prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(csvDb.BACKUPS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${safeFilename}`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'Backup not found.' });
  }
});

app.post('/api/backups/restore/:filename', auth.authMiddleware, (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(csvDb.BACKUPS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    // Backup the current file before restoring
    csvDb.createBackup();
    fs.copyFileSync(filePath, csvDb.CSV_FILE);
    res.json({ success: true, message: `Successfully restored backup: ${safeFilename}` });
  } else {
    res.status(404).json({ error: 'Backup not found.' });
  }
});

// Basic API root / health-check endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Homestay Booking API',
    endpoints: [
      '/api/auth-status',
      '/api/login',
      '/api/bookings',
      '/api/properties',
      '/api/settings'
    ]
  });
});

// For all other requests, serve index.html (SPA routing support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
