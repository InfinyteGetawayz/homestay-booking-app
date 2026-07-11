const fs = require('fs');
const path = require('path');
const webPush = require('web-push');
const csvDb = require('./csvDb');

const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
const SUBS_FILE = path.join(__dirname, 'data', 'push_subscriptions.json');

// Initialize web-push VAPID keys
let vapidKeys = {};
function initVapid() {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to parse config in push init:', e);
    }
  }

  if (config.vapidKeys && config.vapidKeys.publicKey && config.vapidKeys.privateKey) {
    vapidKeys = config.vapidKeys;
  } else {
    // Generate new keys once
    vapidKeys = webPush.generateVAPIDKeys();
    config.vapidKeys = vapidKeys;
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save VAPID keys to config:', e);
    }
  }

  webPush.setVapidDetails(
    'mailto:infinitegetaways82@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

// Get subscription list
function getSubscriptions() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Save subscription list
function saveSubscriptions(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save subscriptions:', e);
  }
}

// Subscribe user browser
function subscribe(subscription) {
  const subs = getSubscriptions();
  // Avoid duplicates
  const exists = subs.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    saveSubscriptions(subs);
  }
  return true;
}

// Unsubscribe user browser
function unsubscribe(endpoint) {
  let subs = getSubscriptions();
  subs = subs.filter(s => s.endpoint !== endpoint);
  saveSubscriptions(subs);
  return true;
}

// Broadcast notification to all active subscribers
function sendNotificationToAll(payload) {
  const subs = getSubscriptions();
  const deadSubs = [];

  const promises = subs.map(sub => {
    return webPush.sendNotification(sub, JSON.stringify(payload))
      .catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or defunct
          deadSubs.push(sub.endpoint);
        } else {
          console.error('Error sending push notification:', err);
        }
      });
  });

  return Promise.all(promises).then(() => {
    if (deadSubs.length > 0) {
      let activeSubs = getSubscriptions();
      activeSubs = activeSubs.filter(s => !deadSubs.includes(s.endpoint));
      saveSubscriptions(activeSubs);
    }
  });
}

// Helper: Calculate days between check-in and booking or current date
function getDaysDifference(checkInDateStr, relativeDate = new Date()) {
  const checkIn = new Date(checkInDateStr);
  // Normalize dates to midnight local time for full day differences
  const d1 = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
  const d2 = new Date(relativeDate.getFullYear(), relativeDate.getMonth(), relativeDate.getDate());
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Check and trigger reminders for a specific booking (e.g. immediately upon adding with < 3 days)
function checkAndTriggerImmediate(booking) {
  // Suppress if No Show, Completed, or manually muted
  if (booking.paymentStatus === 'No Show' || booking.mutedReminders) return;
  
  // Suppress global settings check
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  if (config.globalMuteReminders) return;

  const daysDiff = getDaysDifference(booking.checkInDate, new Date());
  
  // Fire immediately if booking added with < 3 days to check-in
  if (daysDiff >= 0 && daysDiff < 3) {
    const payload = {
      title: 'Booking Alert',
      body: `🔔 Reminder: ${booking.guestName} checks in on ${booking.checkInDate}. Rooms: ${booking.roomSelection}. Pending: ₹${booking.pendingAmount}.`,
      bookingId: booking.bookingId,
      badge: 1
    };
    sendNotificationToAll(payload);
  }
}

// Scheduled scan for daily notifications (runs at 09:00 AM)
function runDailyNotificationScan() {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }
  if (config.globalMuteReminders) {
    console.log('Daily reminder scan skipped: global mute active.');
    return;
  }

  console.log('Running daily notification scan...');
  const bookings = csvDb.getBookings();
  const today = new Date();

  bookings.forEach(booking => {
    // Suppress if No Show, Completed, or manually muted
    if (booking.paymentStatus === 'No Show' || booking.mutedReminders) return;

    const daysDiff = getDaysDifference(booking.checkInDate, today);

    // Trigger exactly 3 calendar days before Check-In date
    if (daysDiff === 3) {
      const payload = {
        title: 'Upcoming Check-in Reminder',
        body: `🔔 Reminder: ${booking.guestName} checks in on ${booking.checkInDate}. Rooms: ${booking.roomSelection}. Pending: ₹${booking.pendingAmount}.`,
        bookingId: booking.bookingId,
        badge: 1
      };
      sendNotificationToAll(payload);
    }
  });
}

// Daily check logic (checks every 15 minutes, runs daily scan at 09:00 AM)
let lastCheckDate = '';
function startScheduler() {
  console.log('Push notification scheduler started.');
  initVapid();

  setInterval(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Check if it's 9:00 AM or later, and we haven't run the scan today
    if (hour >= 9 && lastCheckDate !== dateStr) {
      lastCheckDate = dateStr;
      runDailyNotificationScan();
    }
  }, 15 * 60 * 1000); // every 15 minutes
  
  // Run once on startup (if past 9 AM and not run yet)
  const now = new Date();
  if (now.getHours() >= 9) {
    lastCheckDate = now.toISOString().split('T')[0];
    // Run after a short delay to let server initialize
    setTimeout(runDailyNotificationScan, 10000);
  }
}

module.exports = {
  startScheduler,
  subscribe,
  unsubscribe,
  checkAndTriggerImmediate,
  getPublicKey: () => vapidKeys.publicKey
};
