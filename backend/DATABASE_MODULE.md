# Database Module Documentation

## Overview
The `database.js` module handles all PostgreSQL operations for the Homestay Booking App. It replaces the old CSV/JSON file-based storage system.

## Architecture

### Connection
- Uses `pg` (node-postgres) library
- Connection pooling for performance
- SSL enabled in production (Render)
- Graceful error handling

### Schema
The module auto-creates these tables on startup:

#### 1. `bookings` Table
Stores all guest bookings with calculated fields.

**Columns**:
- `bookingId` (VARCHAR, UNIQUE) - e.g., "KGH01", "MBH02"
- `guestName`, `mobileNumber` - Guest details
- `bookingDate` - When booking was made
- `typeOfBooking` - "B2B", "Individual", etc.
- `checkInDate`, `checkOutDate` - Stay dates
- `numberAdults`, `numberChildren5Plus`, `numberChildrenUnder5` - Guest count
- `perAdultTariff`, `perChildTariff` - Rates
- `roomSelection` - Comma-separated room list
- `foodPreference`, `dietaryRestrictions`, `specialRequest` - Preferences
- `advanceAmount` - Down payment
- `paymentStatus`, `settlement` - Payment tracking
- `totalNights`, `totalPax`, `totalAdultTariff`, `totalChildTariff`, `finalTariff`, `pendingAmount`, `foodingTotal`, `lodgingTotal` - Calculated fields
- `mutedReminders` - Boolean flag
- `createdAt` - Timestamp

#### 2. `properties` Table
Stores property definitions (homestays).

**Columns**:
- `propertyId` (VARCHAR, UNIQUE) - e.g., "KGH", "MBH"
- `name` - Full property name
- `rooms` (TEXT[]) - Array of room IDs: `['R1', 'R2', 'R3', 'L1']`
- `createdAt` - Timestamp

#### 3. `expenses` Table
Stores expense records for tracking costs.

**Columns**:
- `id` (VARCHAR, PRIMARY KEY) - e.g., "EXP-abc12345"
- `description` - Expense details
- `expenseDate` - Date of expense
- `amount` - Numeric amount
- `createdAt` - Timestamp

#### 4. `config` Table
Stores application settings.

**Columns**:
- `key` (VARCHAR, PRIMARY KEY) - Setting name
- `value` - Setting value
- `createdAt`, `updatedAt` - Timestamps

## API Reference

### Booking Operations

#### `getBookings()`
```javascript
const bookings = await db.getBookings();
// Returns: Array of booking objects
```

#### `insertBooking(booking)`
```javascript
const newBooking = await db.insertBooking({
  bookingId: 'KGH01',
  guestName: 'John Doe',
  // ... other fields
});
```

#### `updateBooking(bookingId, booking)`
```javascript
const updated = await db.updateBooking('KGH01', {
  guestName: 'Jane Doe',
  // ... changed fields
});
```

#### `deleteBooking(bookingId)`
```javascript
await db.deleteBooking('KGH01');
```

#### `checkRoomOverlaps(checkInDate, checkOutDate, roomsString, ignoreBookingId)`
Validates room availability before booking.
```javascript
const overlap = await db.checkRoomOverlaps(
  '2026-08-20',
  '2026-08-25',
  'R1,R2',
  null
);
if (overlap) {
  // Room conflict detected
  console.log(`${overlap.conflictingRoom} is booked ${overlap.checkInDate} to ${overlap.checkOutDate}`);
}
```

#### `generateBookingId(prefix)`
Creates sequential IDs for bookings.
```javascript
const id = await db.generateBookingId('KGH');
// Returns: 'KGH01', 'KGH02', etc.
```

#### `computeBookingFields(data)`
Calculates derived fields (synchronous).
```javascript
const computed = db.computeBookingFields({
  numberAdults: 2,
  numberChildren5Plus: 1,
  perAdultTariff: 2000,
  perChildTariff: 1000,
  checkInDate: '2026-08-20',
  checkOutDate: '2026-08-25'
});
// Returns: { totalNights: 5, totalPax: 3, finalTariff: 25000, ... }
```

### Property Operations

#### `getProperties()`
```javascript
const properties = await db.getProperties();
// Returns: Array of property objects
```

#### `insertProperty(property)`
```javascript
const prop = await db.insertProperty({
  id: 'NEW',
  name: 'New Property',
  rooms: ['R1', 'R2']
});
```

#### `updatePropertyRooms(propertyId, rooms)`
```javascript
const updated = await db.updatePropertyRooms('KGH', ['R1', 'R2', 'R3', 'L1', 'L2']);
```

#### `deleteProperty(propertyId)`
```javascript
await db.deleteProperty('KGH');
```

### Expense Operations

#### `getExpenses()`
```javascript
const expenses = await db.getExpenses();
// Returns: Array of expense objects
```

#### `insertExpense(expense)`
```javascript
const exp = await db.insertExpense({
  id: 'EXP-abc123',
  description: 'Groceries',
  expenseDate: '2026-08-15',
  amount: 5000
});
```

#### `deleteExpenseById(expenseId)`
```javascript
await db.deleteExpenseById('EXP-abc123');
```

### Settings Operations

#### `getSettings()`
```javascript
const settings = await db.getSettings();
// Returns: { globalMuteReminders: false }
```

#### `updateSettings(settings)`
```javascript
const updated = await db.updateSettings({ 
  globalMuteReminders: true 
});
```

### CSV Export

#### `generateCSVContent()`
Generates CSV file content from all bookings.
```javascript
const csvContent = await db.generateCSVContent();
// Returns: String with CSV format
```

### Database Management

#### `initializeDatabase()`
Creates schema tables. Called automatically on server startup.
```javascript
await db.initializeDatabase();
```

#### `closePool()`
Closes database connection. Called on graceful shutdown.
```javascript
await db.closePool();
```

## Error Handling

All functions include try-catch with logging:
```javascript
try {
  const booking = await db.getBookings();
} catch (err) {
  console.error('Failed to read bookings:', err);
  // Returns default value or throws
}
```

## Connection String Format

```
postgresql://username:password@hostname:port/database_name
```

Example (Render):
```
postgresql://user:p@ssw0rd@dpg-abc123.render.com:5432/homestay_booking
```

## Performance Considerations

1. **Connection Pooling**: Default 10-30 connections (pg library default)
2. **Indexes**: Consider adding on `bookingId`, `propertyId`, `checkInDate` for large datasets
3. **Query Optimization**: All queries use parameterized statements (SQL injection safe)
4. **Async**: All operations are async - never blocks event loop

## Security

- **SQL Injection**: Protected via parameterized queries ($1, $2, etc.)
- **SSL**: Enabled in production
- **Environment Variables**: DATABASE_URL from Render environment
- **Input Validation**: Basic type checking in endpoints (server.js)

## Database Maintenance

### Backup
- Render handles automatic daily backups
- Accessible via Render dashboard: Database → Backups

### Restore
- Via Render dashboard: Select backup point → Restore
- Restores to a new database instance

### Monitoring
- Check logs: `docker logs <container>`
- View slow queries: PostgreSQL logs in Render
- Database size: Render dashboard shows usage

## Troubleshooting

### Connection Issues
```
Error: "Cannot find module 'pg'"
Solution: npm install pg
```

```
Error: "ENOTFOUND dpg-xxx.render.com"
Solution: Database URL format is wrong or database doesn't exist
```

### Query Errors
```
Error: "relation "bookings" does not exist"
Solution: Call db.initializeDatabase() on startup
```

### Performance Issues
```
Slow queries: Check if indexes are needed
High memory: Connection pool might be leaking
```

## Future Enhancements

1. **Connection Pooling Tuning**: Adjust pool size based on load
2. **Query Caching**: Redis for frequently accessed properties
3. **Migrations**: Formal migration system (e.g., Knex.js)
4. **Replication**: Multi-region Render databases for HA
5. **Monitoring**: Integrate with Render database monitoring

## Migration from CSV

If migrating existing CSV data:
1. Parse CSV file
2. Transform data to booking objects
3. Use `db.insertBooking()` in a loop
4. Handle duplicates by checking `bookingId`

Example:
```javascript
const csv = require('csv-parse/sync');
const fs = require('fs');
const csvContent = fs.readFileSync('bookings.csv', 'utf8');
const records = csv.parse(csvContent, { columns: true });

for (const record of records) {
  await db.insertBooking(transformRecord(record));
}
```

## Testing

For local testing with PostgreSQL:
```bash
# Install PostgreSQL locally
createdb homestay_booking

# Set environment variable
export DATABASE_URL=postgresql://postgres@localhost/homestay_booking

# Run application
npm start
```

The schema will initialize automatically.

---

Last Updated: 2026-08-15
Module Version: 1.0.0 (PostgreSQL Edition)
