const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
const JWT_SECRET = process.env.JWT_SECRET || 'infinite-getaways-secret-key-1234';

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { pinHash: null };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read config file:', err);
    return { pinHash: null };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write config file:', err);
  }
}

function hasPinSet() {
  const config = loadConfig();
  return !!config.pinHash;
}

function setPin(newPin) {
  const salt = bcrypt.genSaltSync(10);
  const pinHash = bcrypt.hashSync(newPin, salt);
  const config = loadConfig();
  config.pinHash = pinHash;
  saveConfig(config);
  return true;
}

function verifyPin(pin) {
  const config = loadConfig();
  if (!config.pinHash) return false;
  return bcrypt.compareSync(pin, config.pinHash);
}

function generateToken() {
  // Token valid for 30 days as requested (stays logged in on mobile)
  return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Bearer token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = {
  hasPinSet,
  setPin,
  verifyPin,
  generateToken,
  authMiddleware
};
