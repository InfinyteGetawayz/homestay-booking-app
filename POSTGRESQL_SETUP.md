# PostgreSQL Migration Setup Guide

## Overview
This application has been migrated from file-based storage (CSV/JSON) to PostgreSQL for persistent, reliable data storage.

## Prerequisites
- Render account (https://render.com)
- Existing Render backend service

## Step-by-Step Setup on Render

### 1. Create PostgreSQL Database on Render

1. Log in to your Render Dashboard
2. Click "New +"
3. Select "PostgreSQL"
4. Configure:
   - **Name**: `homestay-booking-db` (or any name you prefer)
   - **Database**: `homestay_booking`
   - **User**: `postgres` (default)
   - **Region**: Same as your backend service (important for performance)
   - **PostgreSQL Version**: 15 or latest
   - **Disk Size**: 2 GB (should be enough for bookings)

5. Click "Create Database"
6. Wait for the database to initialize (2-3 minutes)
7. Once ready, copy the **Internal Database URL** (not the External one)

### 2. Update Backend Environment Variables

1. Go to your backend service on Render
2. Click "Environment"
3. Add new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL from step 1
   - Example format: `postgresql://user:password@hostname:5432/database_name`

4. (Optional but recommended) Add:
   - **Key**: `NODE_ENV`
   - **Value**: `production`

5. Click "Save Changes"

### 3. Deploy the Updated Backend

1. The changes should trigger an automatic redeploy
2. Check the deployment logs to ensure no errors
3. The database tables will be created automatically on first run

### 4. Verify Migration

1. Open your app in browser and log in
2. Test creating a new booking
3. Refresh the page - booking should persist
4. Wait a few minutes and check again
5. Data should still be there (no longer reverts)

## CSV Export

The CSV export feature still works:
- Go to Settings → Export as CSV
- The CSV is generated from PostgreSQL data on-the-fly
- No need for manual backups - database handles it

## Database Backups

Render automatically backs up your PostgreSQL database:
- Daily automated backups
- You can manually trigger backups in Render dashboard
- Backups are retained for 7 days by default

To restore from a backup:
1. Go to your database in Render dashboard
2. Click "Backups"
3. Select a backup point
4. Click "Restore"

## Troubleshooting

### "DATABASE_URL not found" Error
- Make sure you set the DATABASE_URL environment variable in Render
- Restart the service: Settings → Restart Instance

### "Connection refused" or "Cannot connect to database"
- Check that the DATABASE_URL is correct
- Ensure database region matches backend region
- Wait 5-10 minutes after creating the database

### Connection Timeout
- This usually means DATABASE_URL format is wrong
- Should be: `postgresql://user:password@host:port/dbname`
- Don't use URL encoding for the password (except special characters)

### Data Not Persisting
- Check server logs for errors
- Make sure the booking POST/PUT requests return success
- Check Render database logs for query errors

## Local Development

To test locally before deploying:

1. Install PostgreSQL locally
2. Create a database:
   ```bash
   createdb homestay_booking
   ```

3. Set environment variable:
   ```bash
   export DATABASE_URL=postgresql://postgres:password@localhost:5432/homestay_booking
   ```

4. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

5. Start the server:
   ```bash
   npm start
   ```

The database schema will be created automatically on startup.

## Migration from Old CSV Data

If you have existing data in CSV files:

1. Export current data as CSV from the old app
2. Create a migration script to import the CSV into PostgreSQL
3. Run the script before deploying

Note: The current implementation starts fresh. If you need to migrate old data, contact support.

## File Structure Changes

Old structure (file-based):
- `backend/data/bookings.csv` - Removed
- `backend/data/properties.json` - Removed
- `backend/data/expenses.json` - Removed
- `backend/data/config.json` - Removed

New structure (database-based):
- `backend/database.js` - PostgreSQL connection and queries
- No file storage needed
- All data stored in Render PostgreSQL

## API Changes

No API changes - all endpoints work the same way. The backend now stores data in PostgreSQL instead of files.

## Support

If you encounter issues:
1. Check Render service logs
2. Verify DATABASE_URL is set correctly
3. Ensure PostgreSQL database is running
4. Check PostgreSQL logs in Render dashboard

---

Last Updated: 2026-08-15
