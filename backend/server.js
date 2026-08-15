const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');
const db = require('./database');
const pushEngine = require('./pushEngine');
const expenses = require('./expenses');

// Initialize database on startup
let dbInitialized = false;
(async () => {
  try {
    await db.initializeDatabase();
    dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
})();

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
const backendPublicDir = path.join(__dirname, 'public');
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
const staticRoot = fs.existsSync(backendPublicDir)
  ? backendPublicDir
  : (fs.existsSync(frontendDistDir) ? frontendDistDir : null);

app.use(cors());
app.use(express.json());

// Serve static frontend build from the packaged backend folder or the frontend dist folder
if (staticRoot) {
  app.use(express.static(staticRoot));
}

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

app.get('/api/properties', async (req, res) => {
  try {
    const properties = await db.getProperties();
    res.json(properties);
  } catch (err) {
    console.error('Failed to get properties:', err);
    res.status(500).json({ error: 'Failed to get properties.' });
  }
});

app.post('/api/properties', auth.authMiddleware, async (req, res) => {
  const { id, name, rooms } = req.body;
  if (!id || !name || !rooms || !Array.isArray(rooms)) {
    return res.status(400).json({ error: 'Invalid property configuration.' });
  }

  await queuePropertyOperation(async () => {
    try {
      const props = await db.getProperties();
      if (props.some(p => p.id === id)) {
        if (!res.headersSent) {
          res.status(400).json({ error: `Property with ID ${id} already exists.` });
        }
        return;
      }
      await db.insertProperty({ id, name, rooms });
      const updatedProps = await db.getProperties();
      if (!res.headersSent) {
        res.status(201).json({ success: true, properties: updatedProps });
      }
    } catch (err) {
      console.error('Property create failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to save property.' });
      }
    }
  });
});

app.delete('/api/properties/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;

  await queuePropertyOperation(async () => {
    try {
      const props = await db.getProperties();
      const exists = props.some(p => p.id === id);
      if (!exists) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'Property not found.' });
        }
        return;
      }
      await db.deleteProperty(id);
      const updatedProps = await db.getProperties();
      if (!res.headersSent) {
        res.json({ success: true, properties: updatedProps });
      }
    } catch (err) {
      console.error('Property delete failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to delete property.' });
      }
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
    try {
      const props = await db.getProperties();
      const idx = props.findIndex(p => p.id === id);
      if (idx === -1) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'Property not found.' });
        }
        return;
      }
      await db.updatePropertyRooms(id, rooms);
      const updatedProps = await db.getProperties();
      if (!res.headersSent) {
        res.json({ success: true, properties: updatedProps });
      }
    } catch (err) {
      console.error('Property update failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to update property rooms.' });
      }
    }
  });
});

// --- SETTINGS ENDPOINTS ---

app.get('/api/settings', auth.authMiddleware, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    console.error('Failed to get settings:', err);
    res.status(500).json({ error: 'Failed to get settings.' });
  }
});

app.post('/api/settings', auth.authMiddleware, async (req, res) => {
  const { globalMuteReminders } = req.body;
  try {
    const settings = await db.updateSettings({ globalMuteReminders: !!globalMuteReminders });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// --- BOOKINGS ENDPOINTS ---

app.get('/api/bookings', auth.authMiddleware, async (req, res) => {
  try {
    const bookings = await db.getBookings();
    res.json(bookings);
  } catch (err) {
    console.error('Failed to get bookings:', err);
    res.status(500).json({ error: 'Failed to get bookings.' });
  }
});

app.get('/api/expenses', auth.authMiddleware, async (req, res) => {
  try {
    const expensesList = await db.getExpenses();
    res.json(expensesList);
  } catch (err) {
    console.error('Failed to get expenses:', err);
    res.status(500).json({ error: 'Failed to get expenses.' });
  }
});

app.post('/api/expenses', auth.authMiddleware, async (req, res) => {
  try {
    const item = await expenses.addExpense(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add expense.' });
  }
});

app.delete('/api/expenses/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await expenses.deleteExpense(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
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

  await queueBookingOperation(async () => {
    try {
      // Overlapping booking checks
      const overlap = await db.checkRoomOverlaps(bookingData.checkInDate, bookingData.checkOutDate, bookingData.roomSelection);
      if (overlap) {
        if (!res.headersSent) {
          res.status(400).json({ 
            error: `Booking Conflict: Room ${overlap.conflictingRoom} is already reserved from ${overlap.checkInDate} to ${overlap.checkOutDate}. Please select an alternative room or adjust dates.` 
          });
        }
        return;
      }

      // Find prefix/property matching selected rooms dynamically
      const props = await db.getProperties();
      const selectedRoomsList = bookingData.roomSelection.split(',').map(r => r.trim());
      const matchedProp = props.find(p => p.rooms.some(r => selectedRoomsList.includes(r))) || props[0];
      const prefix = matchedProp ? matchedProp.id : 'KGH';

      const bookingId = await db.generateBookingId(prefix);
      
      // Compute calculated fields
      const computed = db.computeBookingFields(bookingData);

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

      const created = await db.insertBooking(newBooking);
      
      // Trigger push alert checks for < 3 days check-in
      pushEngine.checkAndTriggerImmediate(created);

      if (!res.headersSent) {
        res.status(201).json(created);
      }
    } catch (err) {
      console.error('Booking create failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create booking.' });
      }
    }
  });
});

app.put('/api/bookings/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;
  const bookingData = req.body;

  await queueBookingOperation(async () => {
    try {
      const bookings = await db.getBookings();
      const existing = bookings.find(b => b.bookingId === id);

      if (!existing) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'Booking not found.' });
        }
        return;
      }

      // Update validation
      if (bookingData.typeOfBooking === 'B2B' && !bookingData.b2bAgencyName) {
        if (!res.headersSent) {
          res.status(400).json({ error: 'B2B bookings require an Agency Name.' });
        }
        return;
      }

      // Overlapping booking checks (ignoring this booking's own ID)
      const checkInToCheck = bookingData.checkInDate || existing.checkInDate;
      const checkOutToCheck = bookingData.checkOutDate || existing.checkOutDate;
      const roomsToCheck = bookingData.roomSelection || existing.roomSelection;

      const overlap = await db.checkRoomOverlaps(checkInToCheck, checkOutToCheck, roomsToCheck, id);
      if (overlap) {
        if (!res.headersSent) {
          res.status(400).json({
            error: `Booking Conflict: Room ${overlap.conflictingRoom} is already reserved from ${overlap.checkInDate} to ${overlap.checkOutDate}. Please select an alternative room or adjust dates.`
          });
        }
        return;
      }

      // Compute calculated fields using updated data
      const updatedInputs = { ...existing, ...bookingData };
      const computed = db.computeBookingFields(updatedInputs);

      const updatedBooking = {
        ...updatedInputs,
        ...computed,
        bookingId: id
      };

      const result = await db.updateBooking(id, updatedBooking);

      // Re-check reminders
      pushEngine.checkAndTriggerImmediate(result);

      if (!res.headersSent) {
        res.json(result);
      }
    } catch (err) {
      console.error('Booking update failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to update booking.' });
      }
    }
  });
});

app.delete('/api/bookings/:id', auth.authMiddleware, async (req, res) => {
  const { id } = req.params;

  await queueBookingOperation(async () => {
    try {
      const bookings = await db.getBookings();
      const exists = bookings.some(b => b.bookingId === id);

      if (!exists) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'Booking not found.' });
        }
        return;
      }

      await db.deleteBooking(id);
      if (!res.headersSent) {
        res.json({ success: true, message: 'Booking deleted successfully.' });
      }
    } catch (err) {
      console.error('Booking delete failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to delete booking.' });
      }
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

app.get('/api/export-csv', auth.authMiddleware, async (req, res) => {
  try {
    const csvContent = await db.generateCSVContent();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error('Failed to export CSV:', err);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

app.get('/api/backups', auth.authMiddleware, (req, res) => {
  // Backups are handled at database level via PostgreSQL backups
  // Return empty array since we're using database backups instead of file backups
  res.json([]);
});

app.get('/api/backups/download/:filename', auth.authMiddleware, (req, res) => {
  res.status(404).json({ error: 'Backups are managed at the database level.' });
});

app.post('/api/backups/restore/:filename', auth.authMiddleware, (req, res) => {
  res.status(404).json({ error: 'Backups are managed at the database level.' });
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
  const indexPath = staticRoot ? path.join(staticRoot, 'index.html') : path.join(backendPublicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found.');
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  server.close(async () => {
    await db.closePool();
    process.exit(0);
  });
});
