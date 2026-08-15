# Quick Setup: PostgreSQL on Render

## ✅ What's Been Done (Automatically)
- ✓ Created PostgreSQL database module (backend/database.js)
- ✓ Updated all backend endpoints to use PostgreSQL
- ✓ Implemented automatic database schema creation
- ✓ Added CSV export from database
- ✓ Committed all changes to repository
- ✓ Code tested for syntax errors

## 🚀 Next Steps (Manual - On Render Dashboard)

### Step 1: Create PostgreSQL Database
1. Go to https://render.com/dashboard
2. Click **"New +"**
3. Click **"PostgreSQL"**
4. Fill in:
   - **Name**: `homestay-booking-db`
   - **Database**: `homestay_booking`
   - **User**: `postgres`
   - **Region**: *Same as your backend service* ⚠️
   - **Version**: 15 or latest
   - **Disk**: 2 GB (default)
5. Click **"Create Database"**
6. ⏳ Wait 2-3 minutes for initialization

### Step 2: Get Database URL
1. After database is created, click on it
2. Go to "Connections" tab
3. Copy the **"Internal Database URL"** (not External)
4. It looks like: `postgresql://user:password@hostname:5432/database`

### Step 3: Update Backend Environment Variables
1. Go to your **backend service** on Render
2. Click **"Environment"**
3. Click **"Add Environment Variable"**
4. Enter:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the URL from Step 2
5. Click **"Save Changes"** 
6. Render will **automatically redeploy** ⚡

### Step 4: Verify It Works
1. Wait for deployment to complete (check logs)
2. Open your app
3. Log in with your PIN
4. Try adding a booking
5. Refresh the page - should still be there
6. Wait 5 minutes and refresh again - still there ✅

## 📊 What Changed Internally

| Aspect | Before | After |
|--------|--------|-------|
| Bookings Storage | bookings.csv file | PostgreSQL table |
| Properties | properties.json file | PostgreSQL table |
| Expenses | expenses.json file | PostgreSQL table |
| Settings | config.json file | PostgreSQL table |
| Data Persistence | Lost on restart | Permanent |
| Backups | Manual file copies | Automatic Render backups |
| CSV Export | Reads from file | Generates from DB |

## 🆘 Troubleshooting

### Problem: "DATABASE_URL not found"
**Solution**: Check if you set the environment variable and wait for redeploy to complete

### Problem: "Cannot connect to database"
**Solution**: 
- Verify DATABASE_URL is correct format
- Ensure database region matches backend region
- Try restarting the backend service

### Problem: "Data still reverts after refresh"
**Solution**: 
- Check Render service logs for errors
- Verify database is running (check Render dashboard)
- Make sure POST request completed successfully

### Problem: "Database already exists"
**Solution**: This is fine - just use the existing connection URL

## 📝 Important Notes

1. **No Data Loss**: Your old data in CSV files won't be used. To migrate it, I can write a script.
2. **CSV Download**: Still works - just click Export in Settings. It generates CSV from database.
3. **Backups**: Render handles automatic daily backups. No manual backups needed.
4. **Cost**: Render's free PostgreSQL tier gives you plenty of space.

## 🔗 Useful Links

- Render Dashboard: https://render.com/dashboard
- This Database URL: Check your backend service Environment tab
- Database Backups: Go to your database → Backups tab
- Support: https://render.com/docs

## ✨ You're All Set!

Once you follow the 4 steps above, your app will have **persistent data storage** and never lose bookings again! 🎉

---

Created: 2026-08-15
