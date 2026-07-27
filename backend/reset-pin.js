const auth = require('./auth');

const newPin = process.argv[2];

if (!newPin || !/^\d{4,6}$/.test(newPin)) {
  console.error('Usage: node backend/reset-pin.js <4-6 digit PIN>');
  process.exit(1);
}

auth.setPin(newPin);
console.log(`PIN reset successfully to ${newPin}`);
