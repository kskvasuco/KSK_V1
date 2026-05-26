require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const compression = require('compression');

// Models
const User = require('./models/User');
const Staff = require('./models/Staff');
const Product = require('./models/Product');
const Order = require('./models/Order'); // Using the new Order model
const Delivery = require('./models/Delivery'); // New Delivery model
const Counter = require('./models/Counter');
const Cart = require('./models/Cart');
const PaymentSetting = require('./models/PaymentSetting');
const AppController = require('./models/AppController');
const LedgerTransaction = require('./models/LedgerTransaction');
const LedgerCloseBalance = require('./models/LedgerCloseBalance');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const cors = require('cors');
const authRoutes = require('./routes/auth');
const {
  tokenMiddleware,
  requireAdminOrStaff,
  requireAdmin,
  requireUserAuth,
} = require('./middleware/auth');


const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io real-time sync ──────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Socket.io] Client disconnected:', socket.id);
  });
});
// ─────────────────────────────────────────────────────────────────────────

let adminClients = [];
let userClients = new Map();

// OTP storage for admin password reset (in-memory)
const adminResetOTPs = new Map();

// Email helper using Resend (HTTP-based, works on all cloud platforms)
async function sendAdminEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured in environment variables.');
  }
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const { data, error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) throw new Error(error.message);
  return data;
}

console.log('Email service: Resend API', process.env.RESEND_API_KEY ? '(Key Present)' : '(Key MISSING)');





// Helper to notify all connected admin/staff clients via SSE
function notifyAdmins(type = 'order_updated') {
  adminClients.forEach(client => {
    try {
      client.write(`data: ${type}\n\n`);
    } catch (err) {
      console.error("Error notifying admin client:", err);
    }
  });
}

// Helper to notify a specific user client via SSE
function notifyUser(user, type = 'order_status_updated') {
  if (!user) return;
  const userId = user._id ? user._id.toString() : user.toString();
  const client = userClients.get(userId);
  if (client) {
    try {
      client.write(`data: ${type}\n\n`);
    } catch (err) {
      console.error(`Error notifying user client ${userId}:`, err);
    }
  }
}

const PORT = process.env.PORT || 5500;

// In-memory caches
let publicProductsCache = { data: null, timestamp: null };
let adminProductsCache = { data: null, timestamp: null };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for products
const locationsCache = null; // Will be set once, locations are static

// Enable gzip compression for all responses
app.use(compression());

// CORS for React Native / Expo web clients
app.use(cors({
  origin: true,
  credentials: true,
}));

// Debug logging for API requests
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json({ limit: '2mb' })); // Increased limit for base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

const MongoStore = require('connect-mongo');

app.set('trust proxy', 1); // Trust first proxy (like Render's load balancer) for secure cookies
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard-cat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
  }
}));

// JWT Bearer → session hydration for mobile/app clients
app.use(tokenMiddleware);

// Centralized auth (login, me, logout)
app.use('/api/auth', authRoutes);

// Serve React build in production, fallback to public for legacy files
const fs = require('fs');
const clientDistPath = path.join(__dirname, 'client', 'dist');
const hasReactBuild = fs.existsSync(clientDistPath);

// Always serve public folder for admin.html, staff.html, and their assets
app.use(express.static(path.join(__dirname, 'public')));
console.log('Serving public folder for admin/staff panels');

// Also serve React build if it exists (will take precedence for matching files)
if (hasReactBuild) {
  app.use(express.static(clientDistPath));
  console.log('Serving React build from client/dist');
}

async function ensureStaff() {
  const count = await Staff.countDocuments();
  if (count === 0) {
    console.log('No staff found. Creating 5 default staff members...');
    const staffMembers = [
      { name: 'Staff One', username: 'staff1', password: 'password1' },
      { name: 'Staff Two', username: 'staff2', password: 'password2' },
      { name: 'Staff Three', username: 'staff3', password: 'password3' },
      { name: 'Staff Four', username: 'staff4', password: 'password4' },
      { name: 'Staff Five', username: 'staff5', password: 'password5' },
    ];
    await Staff.insertMany(staffMembers);
    console.log('Default staff members created.');
  }
}

const isServerless = process.env.VERCEL || process.env.ZEIT_NOW;
const mongoOptions = {
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true, // Enable retry writes for better reliability
  w: 'majority' // Write concern for data consistency
};

if (isServerless) {
  // Optimized connection pool for Vercel serverless environment
  mongoOptions.maxPoolSize = 3;
  mongoOptions.minPoolSize = 1;
  mongoOptions.maxIdleTimeMS = 10000;
  mongoOptions.serverSelectionTimeoutMS = 5000;
  mongoOptions.socketTimeoutMS = 30000;
} else {
  // Robust connection pool for long-running servers and local development
  mongoOptions.maxPoolSize = 50; // Larger pool for concurrent requests
  mongoOptions.serverSelectionTimeoutMS = 30000; // Standard 30s timeout for stability
  mongoOptions.socketTimeoutMS = 45000; // Standard socket timeout
}

mongoose.connect(process.env.MONGO_URI, mongoOptions).then(() => {
  console.log(`MongoDB connected with ${isServerless ? 'serverless-optimized' : 'robust persistent'} pooling`);
  ensureProducts().catch(console.error);
  ensureStaff().catch(console.error);
  backfillLedgerOnStartup().catch(console.error);
}).catch(err => console.error('MongoDB error:', err));

// Preload product list if not present
async function ensureProducts() {
  const count = await Product.countDocuments();
  if (count === 0) {
    const products = [
      { name: 'Product A', description: 'Description A', price: 100, sku: 'P-A', unit: 'kg', isVisible: true, displayOrder: 0 },
      { name: 'Product B', description: 'Description B', price: 120, sku: 'P-B', unit: 'pcs', isVisible: true, displayOrder: 1 },
      { name: 'Product C', description: 'Description C', price: 150, sku: 'P-C', unit: 'L', isVisible: true, displayOrder: 2 },
    ];
    await Product.insertMany(products);
    console.log('Inserted default products');
  } else {
    // Fix displayOrder for existing products
    await fixProductDisplayOrder();
  }
}

// Ensure all products have proper sequential displayOrder values
async function fixProductDisplayOrder() {
  // Get all products sorted by current displayOrder then _id
  const products = await Product.find().sort({ displayOrder: 1, _id: 1 }).select('_id displayOrder').lean();

  // Update each product with sequential displayOrder if needed
  const bulkOps = [];
  products.forEach((product, index) => {
    if (product.displayOrder !== index) {
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { displayOrder: index } }
        }
      });
    }
  });

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
    console.log(`Fixed displayOrder for ${bulkOps.length} products`);
  }
}

// Helper to automatically mark an order as 'Delivered' (Completed) if fully dispatched and paid.
async function checkAndMarkOrderCompleted(order, session, shouldSave = true) {
  try {
    if (!order) return false;
    
    // Skip if cancelled
    if (order.status === 'Cancelled') return false;

    // 1. Check if fully dispatched
    // Tolerance of 0.001 for floating point comparisons
    const allDispatched = order.items.every(item => 
      (item.quantityDelivered || 0) >= (item.quantityOrdered || 0) - 0.001
    );

    // 2. Check if fully paid
    // Total Amount = sum of (quantityOrdered * price) + charges - discounts - advances - payments
    // If it's a custom item and quantity is 0 (flat fee), treat it as 1 for total calculation to match frontend
    const itemsTotal = order.items.reduce((sum, item) => {
      const qty = (item.isCustom && (item.quantityOrdered === 0 || item.quantityOrdered === null)) ? 1 : (item.quantityOrdered || 0);
      return sum + (qty * (item.price || 0));
    }, 0);
    
    let adjustmentsTotal = 0;
    if (order.adjustments && order.adjustments.length > 0) {
      order.adjustments.forEach(adj => {
        if (adj.type === 'charge') adjustmentsTotal += adj.amount;
        else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment' || adj.type === 'less') {
          adjustmentsTotal -= adj.amount;
        }
      });
    }

    const balance = itemsTotal + adjustmentsTotal;
    
    // If fully dispatched and balance is zero or less, mark as Completed
    // 0.01 tolerance for potential currency rounding issues
    if (allDispatched && balance <= 0.01) {
      if (order.status !== 'Completed') {
        console.log(`[AUTO-COMPLETE] Marking Order ${order.customOrderId || order._id} as Completed (Balance: ${balance.toFixed(2)}).`);
        order.status = 'Completed';
        order.deliveredAt = new Date();
        if (shouldSave) await order.save({ session });
        
        // Notify relevant parties
        if (typeof notifyAdmins === 'function') notifyAdmins('order_updated');
        if (order.user && typeof notifyUser === 'function') notifyUser(order.user);
      }
      return true;
    } else if (order.status === 'Completed' && (balance > 0.01 || !allDispatched)) {
      // Revert to Delivered if it was Completed but balance is no longer zero, or no longer fully dispatched.
      console.log(`[AUTO-REVERT] Order ${order.customOrderId || order._id}: Balance is now ${balance.toFixed(2)}, Reverting 'Completed' to 'Delivered'.`);
      order.status = 'Delivered';
      if (shouldSave) await order.save({ session });
      
      // Notify relevant parties
      if (typeof notifyAdmins === 'function') notifyAdmins('order_updated');
      if (order.user && typeof notifyUser === 'function') notifyUser(order.user);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error("Error in checkAndMarkOrderCompleted:", err);
    return false;
  }
}


// Auth middleware imported from middleware/auth.js

// Notification helpers consolidated at top of file

// --- Order ID Generation ---
const MONTH_CODES = ['JA', 'FE', 'MR', 'AP', 'MA', 'JU', 'JL', 'AU', 'SE', 'OC', 'NO', 'DE'];
async function getNextOrderId() {
  const now = new Date();
  // Financial year starts April 1st
  const financialYearStartYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const financialYearStartDate = new Date(financialYearStartYear, 3, 1); // Month is 0-indexed, 3 is April

  // Use findOneAndUpdate with an aggregation pipeline for conditional reset/increment
  const updatedCounter = await Counter.findOneAndUpdate(
    { _id: 'orderId' }, // Find the counter document
    [ // Use an aggregation pipeline for the update
      {
        $set: { // Conditionally set seq and lastReset
          seq: {
            $cond: {
              if: { // Condition: If lastReset is before the current financial year start OR doesn't exist
                $or: [
                  { $lt: ["$lastReset", financialYearStartDate] },
                  { $eq: ["$lastReset", undefined] } // Handle initial creation
                ]
              },
              then: 1, // Reset seq to 1
              else: { $add: ["$seq", 1] } // Increment seq by 1
            }
          },
          lastReset: {
            $cond: {
              if: { // Same condition as above
                $or: [
                  { $lt: ["$lastReset", financialYearStartDate] },
                  { $eq: ["$lastReset", undefined] }
                ]
              },
              then: financialYearStartDate, // Update lastReset
              else: "$lastReset" // Keep existing lastReset
            }
          }
        }
      }
    ],
    {
      upsert: true, // Create the document if it doesn't exist
      new: true, // Return the updated document
      setDefaultsOnInsert: true // Apply schema defaults if inserting
    }
  );

  // Format the ID using the sequence number returned AFTER the update
  return `${MONTH_CODES[now.getMonth()]}${String(updatedCounter.seq).padStart(5, '0')}${now.getFullYear().toString().slice(-2)}`;
}

async function getNextDispatchId() {
  const now = new Date();
  const months = ['JA', 'FB', 'MR', 'AR', 'MY', 'JN', 'JL', 'AG', 'SP', 'OT', 'NV', 'DC'];
  const month = months[now.getMonth()];
  const year = now.getFullYear().toString().slice(-2);
  
  // Financial year reset logic (same as order ID)
  const financialYearStartYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const financialYearStartDate = new Date(financialYearStartYear, 3, 1);

  const updatedCounter = await Counter.findOneAndUpdate(
    { _id: 'dispatchId' },
    [
      {
        $set: {
          seq: {
            $cond: {
              if: { $or: [{ $lt: ["$lastReset", financialYearStartDate] }, { $eq: ["$lastReset", undefined] }] },
              then: 1,
              else: { $add: ["$seq", 1] }
            }
          },
          lastReset: {
            $cond: {
              if: { $or: [{ $lt: ["$lastReset", financialYearStartDate] }, { $eq: ["$lastReset", undefined] }] },
              then: financialYearStartDate,
              else: "$lastReset"
            }
          }
        }
      }
    ],
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return `D${year}${month}${String(updatedCounter.seq).padStart(5, '0')}`;
}

function formatDeliveryIdsForDescription(deliveryIds) {
  if (!deliveryIds || deliveryIds.length === 0) return '';
  const ids = Array.isArray(deliveryIds) ? deliveryIds : deliveryIds.split(',');
  if (ids.length > 1) {
    return `Batch of ${ids.length}`;
  } else if (ids.length === 1) {
    // Use a consistent way to get a short ID representation
    return `Delivery ${ids[0].toString().slice(-6)}`; // Last 6 chars
  }
  return '';
}


// =========== STAFF ROUTES ===========
app.post('/api/staff/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const staff = await Staff.findOne({ username }).select('_id username password name').lean();
    if (!staff) return res.status(401).json({ error: 'Invalid credentials' });

    // WARNING: Plain text password comparison - NOT SECURE FOR PRODUCTION
    const isMatch = (password === staff.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.staffId = staff._id;
    req.session.isStaff = true;

    res.json({ ok: true, message: 'Staff logged in' });
  } catch (err) {
    console.error("Staff login error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/staff/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie('connect.sid'); // Optional: Clear session cookie
    res.json({ ok: true });
  });
});


app.get('/api/staff/check', (req, res) => {
  if (req.session && req.session.isStaff) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// =========== LOCATION ROUTES ===========
const ALLOWED_LOCATIONS = {
  "Erode": ["Erode", "Modakkurichi", "Kodumudi", "Perundurai", "Bhavani", "Anthiyur", "Gobichettipalayam", "Sathyamangalam", "Nambiyur", "Thalavadi"],
  "Coimbatore": ["Coimbatore (North)", "Coimbatore (South)", "Mettupalayam", "Pollachi", "Valparai", "Sulur", "Annur", "Kinathukadavu", "Madukkarai", "Perur", "Anaimalai"],
  "Thirupur": ["Tiruppur (North)", "Tiruppur (South)", "Avinashi", "Palladam", "Dharapuram", "Kangayam", "Madathukulam", "Udumalaipettai", "Uthukuli"],
  "Namakal": ["Namakkal", "Rasipuram", "Tiruchengode", "Paramathi-Velur", "Kolli Hills", "Sendamangalam", "Kumarapalayam", "Mohanur"],
  "Salam": ["Salem", "Salem (West)", "Salem (South)", "Attur", "Edappadi", "Gangavalli", "Mettur", "Omalur", "Sankagiri", "Valapady", "Yercaud"]
};
app.get('/api/locations', (req, res) => res.json(ALLOWED_LOCATIONS));

// =========== CART ROUTES ===========

// Get User's Cart
app.get('/api/cart', requireUserAuth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.session.userId }).lean();
    if (!cart) {
      return res.json([]); // Return empty array if no cart exists
    }
    res.json(cart.items);
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Server error fetching cart" });
  }
});

// Add Item to Cart
app.post('/api/cart/add', requireUserAuth, async (req, res) => {
  try {
    const { productId, productName, quantity, unit, description } = req.body;
    const userId = req.session.userId;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if product already exists in cart
    const itemIndex = cart.items.findIndex(p => p.productId.toString() === productId);

    if (itemIndex > -1) {
      // Update quantity if exists
      cart.items[itemIndex].quantity += parseFloat(quantity);
    } else {
      // Push new item
      cart.items.push({ productId, productName, quantity, unit, description });
    }

    cart.updatedAt = new Date();
    await cart.save();
    res.json({ ok: true, message: 'Item saved to cart', items: cart.items });

  } catch (err) {
    console.error("Error adding to cart:", err);
    res.status(500).json({ error: "Server error adding to cart" });
  }
});

// Clear entire Cart (MUST be before /:productId to avoid matching 'clear' as productId)
app.delete('/api/cart/clear', requireUserAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await Cart.findOneAndDelete({ user: userId });
    res.json({ ok: true, message: 'Cart cleared' });
  } catch (err) {
    console.error("Error clearing cart:", err);
    res.status(500).json({ error: "Server error clearing cart" });
  }
});

// Remove Item from Cart
app.delete('/api/cart/:productId', requireUserAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { productId: productId } } }
    );

    res.json({ ok: true, message: 'Item removed' });
  } catch (err) {
    console.error("Error removing from cart:", err);
    res.status(500).json({ error: "Server error removing item" });
  }
});

// Update Item Quantity in Cart
app.put('/api/cart/update', requireUserAuth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.userId;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid productId and quantity are required' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(p => p.productId.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    cart.items[itemIndex].quantity = parseFloat(quantity);
    cart.updatedAt = new Date();
    await cart.save();

    res.json({ ok: true, message: 'Quantity updated', items: cart.items });
  } catch (err) {
    console.error("Error updating cart quantity:", err);
    res.status(500).json({ error: "Server error updating quantity" });
  }
});


// =========== USER-FACING ROUTES ===========

// User Login/Register
app.post('/api/user/login-or-register', async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ error: 'Mobile number is required in both fields.' });
    }
    if (password !== mobile) {
      return res.status(400).json({ error: 'Entries must match.' });
    }

    let user = await User.findOne({ mobile }).select('_id mobile name').lean();

    if (!user) {
      user = new User({ mobile });
      await user.save();
    }

    req.session.userId = user._id;
    res.json({ ok: true, message: 'Logged in successfully', user: { id: user._id, name: user.name, mobile: user.mobile } });

  } catch (err) {
    console.error("Login/Register error:", err);
    res.status(500).json({ error: 'Server error during login/registration.' });
  }
});

// Get User Profile
app.get('/api/user/profile', requireUserAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-__v').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// Update User Profile
app.put('/api/user/profile', requireUserAuth, async (req, res) => {
  // console.log("Received PUT /api/user/profile"); // LOG REMOVED
  try {
    // Destructure all expected fields, providing defaults
    const {
      name = '',
      email = '',
      district = '',
      taluk = '',
      address = '', // Ensure address is destructured
      pincode = '',
      altMobile = ''
    } = req.body;

    // console.log("Received Profile Data:", req.body); // LOG REMOVED

    // Validation (keep existing validation)
    if (email && !/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email format.' });
    if (pincode && !/^\d{6}$/.test(pincode)) return res.status(400).json({ error: 'Invalid pincode format (must be 6 digits).' });
    if (altMobile && !/^\d{10}$/.test(altMobile)) return res.status(400).json({ error: 'Invalid alternative mobile format (must be 10 digits).' });
    if (district && taluk && (!ALLOWED_LOCATIONS[district] || !ALLOWED_LOCATIONS[district].includes(taluk))) return res.status(400).json({ error: 'Invalid district or taluk selection.' });
    if (district && !taluk) return res.status(400).json({ error: 'Please select a Taluk for the chosen District.' });

    // Explicitly build the update object
    const updateData = {
      name,
      email,
      district,
      taluk,
      address, // Explicitly include address here
      pincode,
      altMobile
    };

    // console.log("Updating user with data:", updateData); // LOG REMOVED

    const updatedUser = await User.findByIdAndUpdate(
      req.session.userId,
      updateData, // Use the explicitly built object
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updatedUser) {
      // console.warn("User not found during profile update for ID:", req.session.userId); // LOG REMOVED (Optional: keep if helpful)
      return res.status(404).json({ error: 'User not found.' });
    }

    // console.log("Profile updated successfully for user:", updatedUser.mobile); // LOG REMOVED
    res.json({ ok: true, message: 'Profile updated successfully.' });

  } catch (err) {
    // Keep this essential error log
    console.error("Error updating profile:", err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(el => el.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

// Get Public Products (with caching)
app.get('/api/public/products', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (publicProductsCache.data && publicProductsCache.timestamp && (now - publicProductsCache.timestamp) < CACHE_TTL) {
      return res.json(publicProductsCache.data);
    }

    // Fetch fresh data from database, sorted by displayOrder
    const products = await Product.find({ isVisible: true }).select('-__v').sort({ displayOrder: 1, _id: 1 }).lean();

    // Update cache
    publicProductsCache = {
      data: products,
      timestamp: now
    };

    res.json(products);
  } catch (err) {
    console.error("Error fetching public products:", err);
    res.status(500).json({ error: 'Server error fetching products.' });
  }
});

// Check product quantities in active orders (for limit validation)
app.get('/api/user/active-order-quantities', requireUserAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Find all active orders for this user (Ordered and Paused status)
    const activeOrders = await Order.find({
      user: userId,
      status: { $in: ['Ordered', 'Paused'] }
    }).select('items').lean();

    // Calculate total quantities per product
    const productQuantities = {};

    for (const order of activeOrders) {
      for (const item of order.items) {
        if (!item.product) continue;
        const productId = item.product.toString();
        const quantity = item.quantityOrdered || 0;

        if (productQuantities[productId]) {
          productQuantities[productId] += quantity;
        } else {
          productQuantities[productId] = quantity;
        }
      }
    }

    res.json(productQuantities);
  } catch (err) {
    console.error("Error fetching active order quantities:", err);
    res.status(500).json({ error: 'Server error fetching order quantities.' });
  }
});

// Place a new order
app.post('/api/bulk-order', requireUserAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).select('_id mobile name').lean();
    if (!user) {
      // console.error("User not found for ID:", userId); // LOG REMOVED
      return res.status(401).json({ error: 'User not found.' });
    }
    // console.log("User found:", user.mobile); // LOG REMOVED

    const { items } = req.body;
    // console.log("Received items:", JSON.stringify(items, null, 2)); // LOG REMOVED

    if (!items || !Array.isArray(items) || items.length === 0) {
      // console.warn("Cart is empty or invalid."); // LOG REMOVED
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const productIds = items.map(item => item.productId);
    // console.log("Fetching products for IDs:", productIds); // LOG REMOVED

    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    // console.log("Found products:", products.length); // LOG REMOVED

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const orderItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (!product) {
        // console.warn(`Product not found or not visible for ID: ${item.productId}`); // LOG REMOVED
        return null;
      }
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        // console.warn(`Invalid quantity (${item.quantity}) for product ID: ${item.productId}`); // LOG REMOVED
        return null;
      }
      return {
        product: product._id,
        name: product.name,
        price: product.price,
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: 0,
      };
    }).filter(item => item !== null);

    // console.log("Valid order items generated:", orderItems.length); // LOG REMOVED

    if (orderItems.length === 0) {
      // console.warn("No valid products found in the cart after validation."); // LOG REMOVED
      return res.status(400).json({ error: 'No valid products or quantities found in cart.' });
    }

    const existingOrder = await Order.findOne({
      user: userId,
      status: { $in: ['Ordered', 'Paused'] }
    }).select('_id user items status pauseReason');

    if (existingOrder) {
      // console.log("Existing Pending/Paused order found. Merging items..."); // LOG REMOVED
      const existingItemMap = new Map(
        existingOrder.items
          .filter(item => item.product)
          .map(item => [item.product.toString(), item])
      );

      for (const newItem of orderItems) {
        if (!newItem.product) continue;
        const existingItem = existingItemMap.get(newItem.product.toString());
        if (existingItem) {
          // console.log(`Adding quantity ${newItem.quantityOrdered} to existing item ${existingItem.name}`); // LOG REMOVED
          existingItem.quantityOrdered += newItem.quantityOrdered;
        } else {
          // console.log(`Adding new item ${newItem.name} to order.`); // LOG REMOVED
          existingOrder.items.push(newItem);
        }
      }

      existingOrder.status = 'Ordered';
      existingOrder.pauseReason = undefined;

      await existingOrder.save();
      // console.log("Existing order updated successfully."); // LOG REMOVED

      notifyAdmins('order_updated');
      res.json({ ok: true, message: 'Order items added to your pending order!' });

    } else {
      // console.log("No existing Pending/Paused order found. Creating new order..."); // LOG REMOVED
      const newOrderId = await getNextOrderId();
      // console.log("Generated new Order ID:", newOrderId); // LOG REMOVED

      const newOrder = new Order({
        user: userId,
        items: orderItems,
        customOrderId: newOrderId,
        status: 'Ordered',
      });

      await newOrder.save();
      // console.log("New order created successfully."); // LOG REMOVED

      notifyAdmins('new_order');
      // Clear the DB cart since the order is now placed
      await Cart.findOneAndDelete({ user: userId });
      res.status(201).json({ ok: true, message: 'Order placed successfully!' });
    }

  } catch (err) {
    // Keep this error log - it's important for debugging actual failures
    console.error("!!! Error in /api/bulk-order:", err.stack || err);
    res.status(500).json({ error: 'Server error placing order. Please check server logs.' });
  }
});

// Get User's Orders
app.get('/api/myorders', requireUserAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.session.userId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean(); // Use lean for performance

    // Transform order format for frontend compatibility (if needed by myorders.js)
    const transformedOrders = orders.map(order => {
      const newItems = (order.items && Array.isArray(order.items)) ? order.items.map(item => {
        return {
          product: item.name, // Frontend expects 'product' for name
          quantity: item.quantityOrdered, // Frontend expects 'quantity'
          // Pass other fields too
          name: item.name,
          price: item.price,
          description: item.description,
          unit: item.unit,
          quantityOrdered: item.quantityOrdered,
          quantityDelivered: item.quantityDelivered,
          productId: item.product // Pass the actual ID
        };
      }) : [];

      return {
        ...order, // Spread original order fields
        items: newItems // Replace items with transformed array
      };
    });

    res.json(transformedOrders);
  } catch (err) {
    console.error("Error fetching my-orders:", err);
    res.status(500).json({ error: "Server error fetching orders." });
  }
});

// Edit a 'Ordered' or 'Paused' order (by User)
app.put('/api/myorders/edit', requireUserAuth, async (req, res) => {
  try {
    const { orderId, updatedItems } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ error: 'Order not found or permission denied.' });

    if (order.status !== 'Ordered' && order.status !== 'Paused') {
      return res.status(403).json({ error: 'This order can no longer be edited.' });
    }
    if (!updatedItems || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      return res.status(400).json({ error: 'Cannot save an empty order.' });
    }

    const productIds = updatedItems.map(item => item.productId);
    // Fetch only necessary fields, ensure product is visible
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const newOrderItems = updatedItems.map(item => {
      const product = productMap.get(item.productId);
      if (!product) return null; // Product not found or not visible
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity) || quantity <= 0) return null; // Invalid quantity
      // User can only edit quantity, price comes from DB
      return {
        product: product._id,
        name: product.name,
        price: product.price, // Keep original/current DB price
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: 0, // Reset delivered qty on edit
      };
    }).filter(item => item !== null); // Filter out invalid items


    if (newOrderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in the updated cart.' });
    }

    order.items = newOrderItems;
    order.status = 'Ordered'; // Always reset to pending on user edit
    order.pauseReason = undefined; // Clear reason
    await order.save();

    notifyAdmins('order_updated');
    res.json({ ok: true, message: 'Order updated successfully.' });

  } catch (err) {
    console.error("Error editing order:", err);
    res.status(500).json({ error: 'Server error editing order.' });
  }
});

// Delete a 'Ordered' or 'Paused' order (by User)
// This is called when the user removes all items from the cart during an edit.
app.delete('/api/myorders/cancel/:orderId', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ error: 'Order not found or permission denied.' });

    if (order.status !== 'Ordered' && order.status !== 'Paused') {
      return res.status(403).json({ error: 'This order can no longer be removed.' });
    }

    // Soft delete the order
    order.isDeleted = true;
    order.deletedAt = new Date();
    await order.save();

    notifyAdmins('order_updated'); // Notify admins of the change
    res.json({ ok: true, message: 'Order removed successfully.' });

  } catch (err) {
    console.error("Error removing order:", err);
    res.status(500).json({ error: 'Server error removing order.' });
  }
});

// Get delivery history for a user's specific order
app.get('/api/myorders/:orderId/history', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    // Check if the order belongs to the user
    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ error: 'Order not found or permission denied.' });

    const deliveries = await Delivery.find({ order: orderId })
      .sort({ deliveryDate: -1 })
      .populate('product', 'name description unit')
      .lean();
    res.json(deliveries);
  } catch (error) {
    console.error("Error fetching user delivery history:", error);
    res.status(500).json({ error: 'Failed to fetch delivery history.' });
  }
});

// =========== ADMIN ROUTES ===========

// Admin Login & Auth Check
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let ADMIN_USER = process.env.ADMIN_USER || 'admin';
    let ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';
    
    // Check for overrides in database
    const settings = await AppController.findOne();
    if (settings) {
      if (settings.adminLoginPassword) ADMIN_PASS = settings.adminLoginPassword;
      if (settings.adminUsername) ADMIN_USER = settings.adminUsername;
    }

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      req.session.isAdmin = true;
      const adminAuthVersion = Number.isInteger(settings?.adminAuthVersion) ? settings.adminAuthVersion : 1;
      req.session.adminAuthVersion = adminAuthVersion;
      return res.json({ ok: true, message: 'Admin logged in' });
    }
    return res.status(401).json({ error: 'Invalid admin credentials' });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin OTP Request
app.post('/api/admin/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    let settings = await AppController.findOne();
    if (!settings) {
      // Initialize if not exists
      settings = new AppController({ adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com' });
      await settings.save();
    }

    // Use pre-configured email from database or env
    const targetEmail = settings.adminEmail || process.env.ADMIN_EMAIL || 'admin@example.com';

    if (email.toLowerCase() !== targetEmail.toLowerCase()) {
      return res.status(400).json({ error: 'Email does not match our records.' });
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("Resend API Key Missing");
      return res.status(500).json({ error: 'Email service (Resend) is not configured.' });
    }


    // Generate 6-digit OTP

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 5 min expiration
    adminResetOTPs.set(targetEmail.toLowerCase(), {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    // Send Email via Resend
    await sendAdminEmail({
      to: targetEmail,
      subject: 'Admin Password Reset OTP - NUVAM KSK',
      text: `Your OTP for admin password reset is: ${otp}. It expires in 5 minutes.`,
      html: `<h3>Admin Password Reset - NUVAM KSK</h3><p>Your OTP is: <strong style="font-size:22px;letter-spacing:4px">${otp}</strong></p><p>It expires in 5 minutes. Do not share this with anyone.</p>`

    });

    res.json({ ok: true, message: 'OTP sent to registered email.' });
  } catch (err) {
    console.error("OTP Request Error:", err);
    res.status(500).json({ error: `Failed to send OTP: ${err.message}` });

  }
});


// Admin Password Reset
app.post('/api/admin/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const record = adminResetOTPs.get(email.toLowerCase());
    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (Date.now() > record.expires) {
      adminResetOTPs.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    // Update password in database
    let settings = await AppController.findOne();
    if (!settings) settings = new AppController();
    
    settings.adminLoginPassword = newPassword;
    await settings.save();

    // Clear OTP
    adminResetOTPs.delete(email.toLowerCase());

    res.json({ ok: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin Profile Password Reset (Actions Password)
app.post('/api/admin/reset-profile-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const record = adminResetOTPs.get(email.toLowerCase());
    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (Date.now() > record.expires) {
      adminResetOTPs.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    // Update profile password in database
    let settings = await AppController.findOne();
    if (!settings) settings = new AppController();
    
    settings.profilePassword = newPassword;
    await settings.save();

    // Clear OTP
    adminResetOTPs.delete(email.toLowerCase());

    res.json({ ok: true, message: 'Profile password updated successfully.' });
  } catch (err) {
    console.error("Reset Profile Password Error:", err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin Username Reset
app.post('/api/admin/reset-username', async (req, res) => {
  const { email, otp, newUsername } = req.body;
  if (!email || !otp || !newUsername) return res.status(400).json({ error: 'All fields are required.' });

  try {
    const record = adminResetOTPs.get(email.toLowerCase());
    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (Date.now() > record.expires) {
      adminResetOTPs.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    // Update username in database
    let settings = await AppController.findOne();
    if (!settings) settings = new AppController();
    
    settings.adminUsername = newUsername;
    await settings.save();

    // Clear OTP
    adminResetOTPs.delete(email.toLowerCase());

    res.json({ ok: true, message: 'Username updated successfully.' });
  } catch (err) {
    console.error("Reset Username Error:", err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});


app.post('/api/admin/verify-password', requireAdminOrStaff, async (req, res) => {
  try {
    const { password } = req.body;
    const settings = await AppController.findOne();
    
    // 1. Determine the Login Password (used as a secondary fallback)
    let ADMIN_PASS_FINAL = process.env.ADMIN_PASS || 'adminpass';
    if (settings && settings.adminLoginPassword) {
      ADMIN_PASS_FINAL = settings.adminLoginPassword;
    }

    // 2. Determine the Profile Password (the primary target for verification)
    let PROFILE_PASS_FINAL = process.env.PROFILE_PASSWORD || ADMIN_PASS_FINAL;
    if (settings && settings.profilePassword) {
      PROFILE_PASS_FINAL = settings.profilePassword;
    }

    // Verification: Success if it matches the current Profile Password OR the main Admin Password
    if (password === PROFILE_PASS_FINAL || password === ADMIN_PASS_FINAL) {
      return res.json({ ok: true, success: true });
    }
    return res.status(401).json({ error: 'Invalid password' });

  } catch (err) {
    console.error("verify-password error:", err);
    return res.status(500).json({ error: 'Server error verifying password' });
  }
});


app.get('/api/admin/check', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// Product Management (CRUD) - Accessible by Admin/Staff (with caching)
app.get('/api/products', requireAdminOrStaff, async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (adminProductsCache.data && adminProductsCache.timestamp && (now - adminProductsCache.timestamp) < CACHE_TTL) {
      return res.json(adminProductsCache.data);
    }

    // Fetch all products (including hidden ones for admin), sorted by displayOrder
    const products = await Product.find().select('-__v').sort({ displayOrder: 1, _id: 1 }).lean();

    // Update cache
    adminProductsCache = {
      data: products,
      timestamp: now
    };

    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: 'Server error fetching products.' });
  }
});

// Only Admin can create/update/delete/toggle visibility
app.post('/api/products', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const { name, description, price, sku, unit, imageData, quantityLimit } = req.body; // Added quantityLimit
    if (!name || price == null || price < 0) { // Check price properly
      return res.status(400).json({ error: 'Name and a non-negative price are required.' });
    }

    // Find max displayOrder and add 1 so new product appears at the end
    const maxOrderProduct = await Product.findOne().sort({ displayOrder: -1 }).select('displayOrder').lean();
    const newDisplayOrder = maxOrderProduct ? (maxOrderProduct.displayOrder || 0) + 1 : 0;

    const product = new Product({ name, description, price, sku, unit, imageData, quantityLimit: quantityLimit || 0, isVisible: true, displayOrder: newDisplayOrder });
    await product.save();

    // Invalidate cache
    publicProductsCache = { data: null, timestamp: null };
    adminProductsCache = { data: null, timestamp: null };

    res.status(201).json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error creating product.' });
  }
});

app.put('/api/products/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }
    const { name, description, price, sku, unit, imageData, quantityLimit } = req.body; // Added quantityLimit
    if (!name || price == null || price < 0) {
      return res.status(400).json({ error: 'Name and a non-negative price are required.' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id,
      { name, description, price, sku, unit, imageData, quantityLimit: quantityLimit || 0 },
      { new: true, runValidators: true }); // Return updated doc, run validation
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    // Invalidate cache
    publicProductsCache = { data: null, timestamp: null };
    adminProductsCache = { data: null, timestamp: null };

    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error updating product.' });
  }
});

app.delete('/api/products/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    // Invalidate cache
    publicProductsCache = { data: null, timestamp: null };
    adminProductsCache = { data: null, timestamp: null };

    res.json({ ok: true, message: 'Product deleted.' });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: 'Server error deleting product.' });
  }
});

app.patch('/api/products/:id/visibility', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID format.' });
    }
    const { isVisible } = req.body;
    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({ error: 'isVisible must be a boolean value.' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isVisible },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    // Invalidate cache
    publicProductsCache = { data: null, timestamp: null };
    adminProductsCache = { data: null, timestamp: null };

    res.json({ ok: true, isVisible: product.isVisible, message: `Product is now ${product.isVisible ? 'visible' : 'hidden'}.` });
  } catch (err) {
    console.error("Error toggling visibility:", err);
    res.status(500).json({ error: 'Server error toggling visibility.' });
  }
});

// Reorder products (Admin only)
app.patch('/api/products/reorder', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const { orders } = req.body; // Array of { id, displayOrder }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Invalid order data.' });
    }

    // Validate all IDs first
    for (const item of orders) {
      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        return res.status(400).json({ error: `Invalid product ID: ${item.id}` });
      }
    }

    // Use bulk write for efficiency
    const bulkOps = orders.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { displayOrder: item.displayOrder } }
      }
    }));

    await Product.bulkWrite(bulkOps);

    // Invalidate cache
    publicProductsCache = { data: null, timestamp: null };
    adminProductsCache = { data: null, timestamp: null };

    res.json({ ok: true, message: 'Product order updated successfully.' });
  } catch (err) {
    console.error("Error reordering products:", err);
    res.status(500).json({ error: 'Server error reordering products.' });
  }
});

// User Management (Admin/Staff accessible)
app.get('/api/admin/users/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    const user = await User.findById(req.params.userId).select('-__v').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: 'Server error fetching user profile.' });
  }
});

app.put('/api/admin/users/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    const { name, email, district, taluk, pincode, altMobile, address, mobile, openingBalance, openingBalanceType } = req.body;

    // Check if mobile already exists for ANOTHER user
    if (mobile) {
      if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
      }
      const existingUser = await User.findOne({ mobile, _id: { $ne: req.params.userId } }).select('_id').lean();
      if (existingUser) {
        return res.status(400).json({ error: 'Another user with this mobile number already exists.' });
      }
    }

    // Validation
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode format.' });
    }
    if (altMobile && !/^\d{10}$/.test(altMobile)) {
      return res.status(400).json({ error: 'Invalid alternative mobile format (must be 10 digits).' });
    }
    if (address && address.length > 250) { // Increased to 250
      return res.status(400).json({ error: 'Address must be 250 characters or less.' });
    }
    if (name && name.length > 50) {
      return res.status(400).json({ error: 'Name must be 50 characters or less.' });
    }

    const updateData = { name, email, district, taluk, pincode, altMobile, address };
    if (mobile) updateData.mobile = mobile;
    if (openingBalance !== undefined) updateData.openingBalance = Number(openingBalance) || 0;
    if (openingBalanceType) updateData.openingBalanceType = openingBalanceType;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (updatedUser.isAddedToLedger) {
      await syncUserLedger(updatedUser._id);
    }
    res.json({ ok: true, user: updatedUser, message: 'User profile updated successfully.' });

  } catch (err) {
    console.error("Error updating user profile (admin):", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error updating user profile.' });
  }
});

// Create new user (Admin/Staff) - for walk-in customers or phone orders
app.post('/api/admin/create-user', requireAdminOrStaff, async (req, res) => {
  try {
    const { mobile, name, email, district, taluk, address, pincode, altMobile, isRateRequestEnabled, isAddedToLedger, ledgerType, openingBalance, openingBalanceType } = req.body;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ mobile }).select('_id').lean();
    if (existingUser) {
      return res.status(400).json({ error: 'User with this mobile number already exists.' });
    }

    // Validation for optional fields
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode format (must be 6 digits).' });
    }
    if (altMobile && !/^\d{10}$/.test(altMobile)) {
      return res.status(400).json({ error: 'Invalid alternative mobile format (must be 10 digits).' });
    }

    const newUser = new User({
      mobile,
      name: name || '',
      email: email || '',
      district: district || '',
      taluk: taluk || '',
      address: address || '',
      pincode: pincode || '',
      altMobile: altMobile || '',
      isRateRequestEnabled: isRateRequestEnabled !== undefined ? isRateRequestEnabled : true,
      isAddedToLedger: isAddedToLedger !== undefined ? isAddedToLedger : false,
      ledgerType: ledgerType || 'Customer',
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType: openingBalanceType || 'debit'
    });

    await newUser.save();
    if (newUser.isAddedToLedger) {
      await syncUserLedger(newUser._id);
    }
    res.status(201).json({ ok: true, user: newUser, message: 'User created successfully.' });

  } catch (err) {
    console.error("Error creating user (admin):", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error creating user.' });
  }
});

app.get('/api/admin/visited-users', requireAdminOrStaff, async (req, res) => {
  try {
    // Find users who have placed at least one order
    const usersWithOrdersResult = await Order.distinct('user');
    // Find users who are NOT in the list above
    // BUG FIX: Removed .select() to fetch the full user document
    const visitedUsers = await User.find({ _id: { $nin: usersWithOrdersResult } })
      .select('_id mobile name email district taluk isBlocked createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(visitedUsers);
  } catch (err) {
    console.error("Error fetching visited users:", err);
    res.status(500).json({ error: 'Server error fetching visited users.' });
  }
});

app.get('/api/admin/ordered-users', requireAdminOrStaff, async (req, res) => {
  try {
    const usersWithOrdersResult = await Order.distinct('user');
    const orderedUsers = await User.find({ _id: { $in: usersWithOrdersResult } })
      .select('_id mobile name email district taluk address pincode altMobile isBlocked createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(orderedUsers);
  } catch (err) {
    console.error("Error fetching ordered users:", err);
    res.status(500).json({ error: 'Server error fetching ordered users.' });
  }
});

// Get ALL users (both visited and ordered)
app.get('/api/admin/all-users', requireAdminOrStaff, async (req, res) => {
  try {
    const allUsers = await User.find({})
      .select('_id mobile name email district taluk address pincode altMobile isBlocked isAddedToLedger ledgerType createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(allUsers);
  } catch (err) {
    console.error("Error fetching all users:", err);
    res.status(500).json({ error: 'Server error fetching all users.' });
  }
});

// Block/Unblock user (Admin ONLY)
app.patch('/api/admin/users/:id/block', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const { isBlocked } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, isBlocked: user.isBlocked });
  } catch (err) {
    console.error("Error blocking user:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (Admin ONLY)
app.delete('/api/admin/users/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Cleanup: could delete user's orders, cart etc. but for now just the user.
    res.json({ ok: true, message: 'User deleted' });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: 'Server error' });
  }
});


// =========== ANALYTICS (ADMIN) ===========
app.get('/api/admin/analytics', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    // 1. Basic Counts
    const totalUsers = await User.countDocuments();
    const activeOrders = await Order.countDocuments({ isDeleted: { $ne: true }, status: { $nin: ['Delivered', 'Cancelled', 'Completed'] } });

    // 2. Status Distribution
    const statusCounts = await Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 3. Revenue and Sales Trend (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueData = await Order.aggregate([
      { $match: { 
          isDeleted: { $ne: true },
          $or: [
            { status: { $in: ['Confirmed', 'Delivered', 'Partially Delivered', 'Completed'] } },
            { status: { $regex: '^Dispatch' } }
          ],
          createdAt: { $gte: sixMonthsAgo }
      }},
      { $project: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' },
          orderTotal: {
            $add: [
              { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: { $multiply: [{ $ifNull: ['$$item.quantityOrdered', 0] }, { $ifNull: ['$$item.price', 0] }] } } } },
              { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } },
              { $multiply: [-1, { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'less']] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } }] }
            ]
          }
      }},
      { $group: {
          _id: { month: '$month', year: '$year' },
          revenue: { $sum: { $ifNull: ['$orderTotal', 0] } },
          orders: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 4. Top Products
    const topProducts = await Order.aggregate([
      { $match: { isDeleted: { $ne: true }, status: { $ne: 'Cancelled' } } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      { $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: { $ifNull: ['$items.quantityOrdered', 0] } },
          revenue: { $sum: { $multiply: [{ $ifNull: ['$items.quantityOrdered', 0] }, { $ifNull: ['$items.price', 0] }] } }
      }},
      { $sort: { totalQty: -1 } },
      { $limit: 6 }
    ]);

    // 5. Total Lifetime Revenue and Timeframes
    const lifetimeStats = await Order.aggregate([
        { $match: { 
          isDeleted: { $ne: true },
          $or: [
            { status: { $in: ['Confirmed', 'Delivered', 'Partially Delivered', 'Completed'] } },
            { status: { $regex: '^Dispatch' } }
          ]
        } },
        { $project: {
            createdAt: 1,
            orderTotal: {
              $add: [
                { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: { $multiply: [{ $ifNull: ['$$item.quantityOrdered', 0] }, { $ifNull: ['$$item.price', 0] }] } } } },
                { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } },
                { $multiply: [-1, { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'less']] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } }] }
              ]
            }
        }},
        { $group: { 
            _id: null, 
            total: { $sum: { $ifNull: ['$orderTotal', 0] } },
            firstOrderDate: { $min: '$createdAt' },
            latestOrderDate: { $max: '$createdAt' }
        } }
    ]);

    const stats = lifetimeStats[0] || { total: 0, firstOrderDate: new Date(), latestOrderDate: new Date() };
    const lifetimeRevenue = stats.total;
    
    // Calculate time span for averages
    const firstDate = new Date(stats.firstOrderDate);
    const lastDate = new Date();
    const totalMonthsSinceFirst = Math.max(1, (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + (lastDate.getMonth() - firstDate.getMonth()) + 1);
    const totalYearsSinceFirst = Math.max(1, totalMonthsSinceFirst / 12);

    const avgMonthlyRevenue = Math.round(lifetimeRevenue / totalMonthsSinceFirst);
    const avgYearlyRevenue = Math.round(lifetimeRevenue / totalYearsSinceFirst);

    // Calculate MoM Growth
    let momGrowth = 0;
    if (revenueData.length >= 2) {
        const lastMonth = revenueData[revenueData.length - 1].revenue;
        const prevMonth = revenueData[revenueData.length - 2].revenue;
        if (prevMonth > 0) {
            momGrowth = Math.round(((lastMonth - prevMonth) / prevMonth) * 100);
        }
    }

    res.json({
      summary: {
        totalUsers,
        activeOrders,
        lifetimeRevenue,
        periodRevenue: revenueData.reduce((sum, d) => sum + d.revenue, 0),
        avgMonthlyRevenue,
        avgYearlyRevenue,
        momGrowth
      },
      statusDistribution: statusCounts.map(s => ({ name: s._id, value: s.count })),
      salesTrend: revenueData.map(d => ({
        name: `${d._id.month}/${d._id.year}`,
        revenue: Math.round(d.revenue),
        orders: d.orders
      })),
      topProducts: topProducts.map(p => ({
        name: p.name,
        qty: p.totalQty,
        revenue: Math.round(p.revenue)
      }))
    });

  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ error: 'Server error fetching analytics data.' });
  }
});

// GET /api/admin/order-counts - Focused endpoint for sidebar counts
app.get('/api/admin/order-counts', requireAdminOrStaff, async (req, res) => {
  try {
    const statusCounts = await Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Format into a simple object and handle groupings
    const formattedCounts = statusCounts.reduce((acc, curr) => {
      const status = curr._id || '';
      acc[status] = curr.count;
      
      // Grouping logic for Dispatch
      if (status.startsWith('Dispatch') || status === 'Partially Delivered') {
        acc['DispatchGroup'] = (acc['DispatchGroup'] || 0) + curr.count;
      }
      
      // Grouping logic for Hold
      if (status === 'Hold' || status === 'Paused') {
        acc['HoldGroup'] = (acc['HoldGroup'] || 0) + curr.count;
      }
      
      return acc;
    }, {});

    // Calculate "Delivered & Paid" count to adjust counts and avoid overlap
    const deliveredPaidAggregate = await Order.aggregate([
      { $match: { isDeleted: { $ne: true }, status: 'Delivered' } },
      { $project: {
          orderTotal: {
            $add: [
              { $sum: { $map: { 
                  input: { $ifNull: ['$items', []] }, 
                  as: 'item', 
                  in: { $multiply: [{ $toDouble: { $ifNull: ['$$item.quantityOrdered', 0] } }, { $toDouble: { $ifNull: ['$$item.price', 0] } }] } 
              } } },
              { $sum: { $map: { 
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, 
                  as: 'a', 
                  in: { $toDouble: { $ifNull: ['$$a.amount', 0] } } 
              } } },
              { $multiply: [-1, { $sum: { $map: { 
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'advance', 'payment', 'less']] } } }, 
                  as: 'a', 
                  in: { $toDouble: { $ifNull: ['$$a.amount', 0] } } 
              } } }] }
            ]
          }
      }},
      { $match: { orderTotal: { $lte: 0.05 } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);

    const deliveredPaidCount = deliveredPaidAggregate[0]?.count || 0;

    // Adjust counts to reflect the UI: Delivered tab shows BOTH active deliveries and completed records
    const totalCompleted = (formattedCounts['Completed'] || 0) + deliveredPaidCount;
    formattedCounts['Completed'] = totalCompleted;
    // The Delivered tab count should show the sum of active deliveries and completed ones
    formattedCounts['Delivered'] = (formattedCounts['Delivered'] || 0) + (formattedCounts['Completed'] || 0);

    // Calculate Balance count (Orders with status in [Delivered, Dispatch, Partially Delivered] and balance > 0)
    const balanceCountAggregate = await Order.aggregate([
      { $match: { 
        isDeleted: { $ne: true },
        $or: [
          { status: { $in: ['Delivered', 'Partially Delivered'] } },
          { status: { $regex: '^Dispatch' } }
        ]
      } },
      { $project: {
          orderTotal: {
            $add: [
              { $sum: { $map: { 
                  input: { $ifNull: ['$items', []] }, 
                  as: 'item', 
                  in: { $multiply: [
                    { $cond: { 
                        if: { $and: [
                          { $eq: ["$$item.isCustom", true] }, 
                          { $eq: [{ $ifNull: ["$$item.quantityOrdered", 0] }, 0] }
                        ]}, 
                        then: 1, 
                        else: { $toDouble: { $ifNull: ["$$item.quantityOrdered", 0] } } 
                    }}, 
                    { $toDouble: { $ifNull: ['$$item.price', 0] } } 
                  ]} 
              } } },
              { $sum: { $map: { 
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, 
                  as: 'a', 
                  in: { $toDouble: { $ifNull: ['$$a.amount', 0] } } 
              } } },
              { $multiply: [-1, { $sum: { $map: { 
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'advance', 'payment', 'less']] } } }, 
                  as: 'a', 
                  in: { $toDouble: { $ifNull: ['$$a.amount', 0] } } 
              } } }] }
            ]
          }
      }},
      { $match: { orderTotal: { $gt: 0.01 } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    formattedCounts['Balance'] = balanceCountAggregate[0]?.count || 0;

    // Calculate Advance count (Orders with at least one adjustment of type 'advance')
    const advanceCount = await Order.countDocuments({ isDeleted: { $ne: true }, 'adjustments.type': 'advance' });
    formattedCounts['Advance'] = advanceCount;

    res.json(formattedCounts);
  } catch (err) {
    console.error('Order counts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/orders/:id - Admin only order soft deletion (Password 'v1' verified client-side)
app.delete('/api/admin/orders/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const result = await Order.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() }, { new: true });
    if (!result) return res.status(404).json({ error: 'Order not found' });
    await syncUserLedger(result.user);
    res.json({ message: 'Order moved to recycle bin successfully' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// GET /api/admin/deleted-orders - Fetch orders in Recycle Bin
app.get('/api/admin/deleted-orders', requireAdminOrStaff, async (req, res) => {
  try {
    const deletedOrders = await Order.find({ isDeleted: true })
      .populate('user', 'name mobile email address')
      .sort({ deletedAt: -1 })
      .lean();
    res.json(deletedOrders);
  } catch (err) {
    console.error("Error fetching deleted orders:", err);
    res.status(500).json({ error: 'Server error fetching deleted orders.' });
  }
});

// POST /api/admin/orders/:id/restore - Restore soft-deleted order
app.post('/api/admin/orders/:id/restore', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const result = await Order.findByIdAndUpdate(req.params.id, { isDeleted: false, deletedAt: null }, { new: true });
    if (!result) return res.status(404).json({ error: 'Order not found' });
    await syncUserLedger(result.user);
    res.json({ message: 'Order restored successfully' });
  } catch (err) {
    console.error('Restore order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/orders/:id/permanent - Permanent delete
app.delete('/api/admin/orders/:id/permanent', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const result = await Order.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Order not found' });
    await syncUserLedger(result.user);
    res.json({ message: 'Order permanently deleted' });
  } catch (err) {
    console.error('Permanent delete order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// =========== ORDER MANAGEMENT (ADMIN/STAFF) ===========

// Get all orders for Admin/Staff panels (optimized)
app.get('/api/admin/orders', requireAdminOrStaff, async (req, res) => {
  try {
    const orders = await Order.find({ isDeleted: { $ne: true } })
      .populate('user', 'name mobile email address') // Include address for PDF generation
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain JS objects for better performance
    res.json(orders);
  } catch (err) {
    console.error("Error fetching admin orders:", err);
    res.status(500).json({ error: 'Server error fetching orders.' });
  }
});

// Get delivery history for a specific order (optimized)
app.get('/api/admin/orders/:orderId/history', requireAdminOrStaff, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    const deliveries = await Delivery.find({ order: req.params.orderId })
      .sort({ deliveryDate: -1 })
      .populate('product', 'name description unit') // Only fetch needed product fields
      .lean(); // Convert to plain objects
    res.json(deliveries);
  } catch (error) {
    console.error("Error fetching delivery history:", error);
    res.status(500).json({ error: 'Failed to fetch delivery history.' });
  }
});

// Update agent details on specific delivery history records
app.patch('/api/admin/deliveries/update-agent', requireAdminOrStaff, async (req, res) => {
  try {
    const { deliveryIds, agentName, agentMobile, agentDescription, agentAddress } = req.body;

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return res.status(400).json({ error: 'No delivery records specified.' });
    }
    // Validate IDs
    const invalidIds = deliveryIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: `Invalid delivery ID format found: ${invalidIds.join(', ')}` });
    }

    const updatedAgent = {
      name: agentName,
      mobile: agentMobile,
      description: agentDescription,
      address: agentAddress
    };

    // Update all matching delivery documents
    const updateResult = await Delivery.updateMany(
      { _id: { $in: deliveryIds } },
      { $set: { deliveryAgent: updatedAgent } }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'No matching delivery records found to update.' });
    }

    // Notify user and admins (find one order to get user ID)
    const oneDelivery = await Delivery.findOne({ _id: deliveryIds[0] })
      .populate({ path: 'order', select: 'user' });

    if (oneDelivery && oneDelivery.order && oneDelivery.order.user) {
      notifyUser(oneDelivery.order.user);
    }
    notifyAdmins(); // Notify all staff/admins

    res.json({ ok: true, message: 'Delivery history updated.' });

  } catch (err) {
    console.error("Error updating delivery agent:", err);
    res.status(500).json({ error: 'Server error while updating delivery history.' });
  }
});

// Get all unique delivery agents from historical deliveries
app.get('/api/admin/delivery-agents', requireAdminOrStaff, async (req, res) => {
  try {
    const historicalAgents = await Delivery.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$deliveryAgent.id", "$deliveryAgent.name"] },
          name: { $first: "$deliveryAgent.name" },
          mobile: { $first: "$deliveryAgent.mobile" },
          totalDeliveries: { $sum: 1 },
          lastDate: { $max: "$deliveryDate" }
        }
      },
      { $sort: { lastDate: -1 } }
    ]);
    res.json(historicalAgents);
  } catch (err) {
    console.error("Error fetching delivery agents:", err);
    res.status(500).json({ error: 'Server error fetching delivery agents.' });
  }
});

// Get historical delivery records for a specific agent
app.get('/api/admin/delivery-records/:agentId', requireAdminOrStaff, async (req, res) => {
  try {
    const { agentId } = req.params;
    let query = {};

    if (agentId === 'null' || agentId === 'undefined') {
      query["deliveryAgent.id"] = { $in: [null, undefined] };
    } else if (mongoose.Types.ObjectId.isValid(agentId)) {
      query["deliveryAgent.id"] = agentId;
    } else {
      // It's a name
      query["deliveryAgent.name"] = agentId;
    }

    const records = await Delivery.find(query)
      .populate('product', 'name unit')
      .populate({
        path: 'order',
        select: 'customOrderId user',
        populate: { path: 'user', select: 'name mobile' }
      })
      .sort({ deliveryDate: -1 })
      .lean();

    res.json(records.map(r => ({ ...r, isPending: false })));
  } catch (err) {
    console.error("Error fetching agent records:", err);
    res.status(500).json({ error: 'Server error fetching agent records.' });
  }
});

// Confirm a delivery batch (Optionally add payment adjustment)
app.get('/api/admin/delivery-batches/confirm', requireAdminOrStaff, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, batchDate, receivedAmount, isNullAction, paymentMode } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid Order ID');
    }

    // 1. Find the delivery records for this batch
    // We treat records within 2 seconds of the batchDate as the same batch to be safe
    const targetDate = new Date(batchDate);
    const windowStart = new Date(targetDate.getTime() - 5000);
    const windowEnd = new Date(targetDate.getTime() + 5000);

    const deliveries = await Delivery.find({
      order: orderId,
      deliveryDate: { $gte: windowStart, $lte: windowEnd }
    }).session(session);

    if (deliveries.length === 0) {
      throw new Error('Batch not found');
    }

    // 2. Update deliveries
    const amount = (isNullAction === 'true') ? 0 : (parseFloat(receivedAmount) || 0);
    for (const del of deliveries) {
      del.isConfirmed = true;
      del.receivedAmount = amount > 0 ? (amount / deliveries.length) : 0;
      del.paymentMode = amount > 0 ? (paymentMode || null) : null;
      await del.save({ session });
    }

    // 3. Sync Adjustment to Order
    const order = await Order.findById(orderId).session(session);
    if (order) {
      // Use the first delivery's deliveredAt as the canonical timestamp for this batch
      const batchTimestamp = new Date(deliveries[0].deliveredAt || deliveries[0].createdAt).getTime();
      const batchIdValue = batchTimestamp.toString();
      const descriptionMarker = `[BatchID: ${batchTimestamp}]`;

      // Search by: 1. New batchId field, OR 2. Old description-based marker
      let existingAdjIndex = order.adjustments.findIndex(a => 
        a.batchId === batchIdValue || 
        a.description?.includes(descriptionMarker)
      );

      // Fallback for legacy data (Adoption logic): 
      // If no marker found, look for any 'advance' adjustment for this agent that has NO marker yet.
      if (existingAdjIndex === -1 && amount > 0) {
        const agentName = deliveries[0].deliveryAgent.name;
        // Find adjustments for this agent that don't have ANY BatchID marker yet
        const floatingAdjIndex = order.adjustments.findIndex(a => 
          a.description?.includes(`Collection via Dispatch Agent: ${agentName}`) &&
          !a.description?.includes('[BatchID:') &&
          !a.batchId
        );
        if (floatingAdjIndex !== -1) {
          existingAdjIndex = floatingAdjIndex;
          console.log(`[DEBUG] Adopting floating adjustment at index ${existingAdjIndex} for batch ${batchIdValue}`);
        }
      }
      
      if (amount > 0) {
        if (existingAdjIndex !== -1) {
          // Update existing adjustment
          order.adjustments[existingAdjIndex].amount = amount;
          order.adjustments[existingAdjIndex].paymentMode = paymentMode || null;
          order.adjustments[existingAdjIndex].batchId = batchIdValue; // Ensure field is set
          // Keep description clean but update agent name if needed
          order.adjustments[existingAdjIndex].description = `Collection via Dispatch Agent: ${deliveries[0].deliveryAgent.name} ${descriptionMarker}`;
        } else {
          // Push new adjustment
          order.adjustments.push({
            description: `Collection via Dispatch Agent: ${deliveries[0].deliveryAgent.name} ${descriptionMarker}`,
            amount: amount,
            type: 'advance',
            isLocked: true,
            date: new Date(batchTimestamp), // Match batch timestamp
            paymentMode: paymentMode || null,
            batchId: batchIdValue
          });
        }
      } else if (existingAdjIndex !== -1) {
        // Remove if amount is now 0 and it existed
        order.adjustments.splice(existingAdjIndex, 1);
      }
      await order.save({ session });
      
      // Check if the order is now fully dispatched and paid to mark as 'Delivered'
      await checkAndMarkOrderCompleted(order, session);
      await syncUserLedger(order.user, session);
    }

    await session.commitTransaction();
    notifyAdmins();
    res.json({ success: true, message: 'Batch confirmed successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error("Error confirming delivery batch:", err);
    res.status(500).json({ error: err.message || 'Server error confirming batch.' });
  } finally {
    session.endSession();
  }
});

// Update Agent Charge (Rent) for a specific delivery batch
app.post('/api/admin/delivery-batches/agent-charge', requireAdminOrStaff, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, batchDate, chargeAmount } = req.body;
    
    console.log(`[DEBUG] Update agent charge: orderId=${orderId}, batchDate=${batchDate}, amount=${chargeAmount}`);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid Order ID format');
    }

    const targetDate = new Date(batchDate);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid batch date format');
    }

    // Window of 30 seconds to find the delivery records
    const windowStart = new Date(targetDate.getTime() - 30000); 
    const windowEnd = new Date(targetDate.getTime() + 30000);

    const deliveries = await Delivery.find({
      order: orderId,
      deliveryDate: { $gte: windowStart, $lte: windowEnd }
    }).session(session);

    if (deliveries.length === 0) {
      console.log(`[DEBUG] No deliveries found for window: ${windowStart.toISOString()} - ${windowEnd.toISOString()} for order ${orderId}`);
      throw new Error('No delivery records found matching this batch time. Please refresh the page and try again.');
    }

    const charge = parseFloat(chargeAmount) || 0;
    
    // Distribute charge across all records in the batch
    for (const del of deliveries) {
      del.agentCharge = charge > 0 ? (charge / deliveries.length) : 0;
      await del.save({ session });
    }

    await session.commitTransaction();
    notifyAdmins();
    res.json({ ok: true, message: 'Agent charge updated successfully' });
  } catch (err) {
    if (session && session.inTransaction()) await session.abortTransaction();
    console.error("Error updating agent charge:", err);
    res.status(400).json({ error: err.message || 'Server error updating agent charge.' });
  } finally {
    if (session) session.endSession();
  }
});

// Update Expected Amount for a specific delivery batch
app.post('/api/admin/delivery-batches/expected-amount', requireAdminOrStaff, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, batchDate, expectedAmount } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid Order ID format');
    }

    const targetDate = new Date(batchDate);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid batch date format');
    }

    // Window of 30 seconds to find the delivery records
    const windowStart = new Date(targetDate.getTime() - 30000); 
    const windowEnd = new Date(targetDate.getTime() + 30000);

    const deliveries = await Delivery.find({
      order: orderId,
      deliveryDate: { $gte: windowStart, $lte: windowEnd }
    }).session(session);

    if (deliveries.length === 0) {
      throw new Error('No delivery records found matching this batch time.');
    }

    const amount = parseFloat(expectedAmount) || 0;
    
    for (const del of deliveries) {
      del.expectedAmount = amount;
      await del.save({ session });
    }

    await session.commitTransaction();
    notifyAdmins();
    res.json({ ok: true, message: 'Expected amount updated successfully' });
  } catch (err) {
    if (session && session.inTransaction()) await session.abortTransaction();
    console.error("Error updating expected amount:", err);
    res.status(400).json({ error: err.message || 'Server error updating expected amount.' });
  } finally {
    if (session) session.endSession();
  }
});





// Revert (delete) a batch of delivery records and update the parent order
app.post('/api/admin/deliveries/revert-batch', requireAdminOrStaff, async (req, res) => {
  // Use a transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // --- MODIFICATION: Destructure adjustmentIdsToRemove ---
    const { deliveryIds, adjustmentIdsToRemove } = req.body; // Added adjustmentIdsToRemove

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      throw new Error('No delivery IDs provided.');
    }
    // Validate delivery IDs
    const invalidDeliveryIds = deliveryIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidDeliveryIds.length > 0) {
      throw new Error(`Invalid delivery ID format found: ${invalidDeliveryIds.join(', ')}`);
    }
    // --- NEW: Validate adjustment IDs (if provided) ---
    if (adjustmentIdsToRemove && Array.isArray(adjustmentIdsToRemove)) {
      const invalidAdjustmentIds = adjustmentIdsToRemove.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidAdjustmentIds.length > 0) {
        throw new Error(`Invalid adjustment ID format found: ${invalidAdjustmentIds.join(', ')}`);
      }
    }
    // --- END NEW ---


    const deliveries = await Delivery.find({ _id: { $in: deliveryIds } }).session(session).populate('order');
    if (!deliveries || deliveries.length === 0) {
      throw new Error('No matching delivery records found.');
    }

    const orderId = deliveries[0].order._id; // All deliveries must belong to the same order
    const order = await Order.findById(orderId).session(session); // Fetch the order within the transaction
    if (!order) {
      throw new Error('Associated order not found.');
    }
    let userToNotify = order.user;

    const quantityToRevertMap = new Map();
    for (const delivery of deliveries) {
      if (delivery.order._id.toString() !== orderId.toString()) {
        throw new Error('Deliveries from multiple orders cannot be reverted together.');
      }
      // Use orderItemId if available (new records), otherwise fallback to product (old records)
      const key = (delivery.orderItemId || delivery.product)?.toString();
      if (!key) continue;
      
      const currentQty = quantityToRevertMap.get(key) || 0;
      quantityToRevertMap.set(key, currentQty + delivery.quantityDelivered);
    }

    // Update the main order document quantities
    order.items.forEach(item => {
      const itemId = item._id.toString();
      const prodId = item.product?.toString();
      
      let revertQty = 0;
      if (quantityToRevertMap.has(itemId)) {
        revertQty = quantityToRevertMap.get(itemId);
      } else if (prodId && quantityToRevertMap.has(prodId)) {
        revertQty = quantityToRevertMap.get(prodId);
      }

      if (revertQty > 0) {
        item.quantityDelivered -= revertQty;
        if (item.quantityDelivered < 0) item.quantityDelivered = 0; // Prevent negative
      }
    });

    // Recalculate the order's status
    let totalOrdered = 0;
    let totalDelivered = 0;
    order.items.forEach(item => {
      totalOrdered += item.quantityOrdered;
      totalDelivered += item.quantityDelivered;
    });

    const tolerance = 0.001; // For floating point comparisons

    // Recalculate status correctly
    const remainingDispatches = await Delivery.distinct('dispatchId', { order: orderId }).session(session);
    const count = remainingDispatches.length;
    
    if (order.deliveryAgent && order.deliveryAgent.dispatchId) {
      order.status = `Dispatch ${count + 1} ready`;
    } else if (count > 0) {
      order.status = `Dispatch ${count}`;
    } else {
      // Nothing left in history and no agent assigned - set back to generic 'Dispatch'
      order.status = 'Dispatch';
    }
    order.deliveredAt = undefined;

    // --- MODIFICATION: Check for locked adjustments BEFORE removing ---
    if (adjustmentIdsToRemove && adjustmentIdsToRemove.length > 0) {

      // Find all adjustments that are in the list AND are locked
      const lockedAdjs = order.adjustments.filter(adj =>
        adjustmentIdsToRemove.includes(adj._id.toString()) && adj.isLocked
      );

      if (lockedAdjs.length > 0) {
        // If any are found, throw an error and abort the transaction
        const total = lockedAdjs.reduce((sum, adj) => sum + adj.amount, 0).toFixed(2);
        throw new Error(`Cannot revert: This batch has ${lockedAdjs.length} locked payment(s) (totaling ₹${total}) associated with it.`);
      }

      // If no locked adjustments are found, proceed with removal
      order.adjustments.pull(...adjustmentIdsToRemove);
    }
    // --- END MODIFICATION ---


    await order.save({ session }); // Save updated order (with quantities AND adjustments changed)

    // Delete the delivery records
    const deleteResult = await Delivery.deleteMany({ _id: { $in: deliveryIds } }).session(session);
    if (deleteResult.deletedCount !== deliveryIds.length) {
      throw new Error('Could not delete all specified delivery records.');
    }

    await session.commitTransaction(); // Commit changes

    notifyAdmins();
    if (userToNotify) notifyUser(userToNotify);

    res.json({ ok: true, message: 'Delivery batch reverted successfully.' });

  } catch (err) {
    await session.abortTransaction(); // Rollback on error
    console.error("Error reverting delivery batch:", err);
    res.status(err.message.startsWith('Invalid') || err.message.startsWith('No matching') || err.message.startsWith('Cannot revert') ? 400 : 500)
      .json({ error: err.message || 'Server error while reverting delivery.' });
  } finally {
    session.endSession(); // End the session
  }
});

// Create a new order for a user (Admin/Staff)
app.post('/api/admin/orders/create-for-user', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, items, orderDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items list is empty.' });
    }

    const productIds = items.map(item => item.productId).filter(id => id); // Filter out null for custom products
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const orderItems = items.map(item => {
      if (item.isCustom) {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price);
        if (isNaN(price) || price < 0) return null;
        return {
          name: item.name,
          price: price,
          quantityOrdered: quantity,
          quantityDelivered: 0,
          isCustom: true,
          isQtyNotSpecified: quantity === 0,
          unit: item.unit || '',
          isPriceModified: false,
          catalogPrice: price
        };
      }

      const product = productMap.get(item.productId);
      if (!product) return null;
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price); // Price comes from the request for admin/staff creation
      if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) return null;
      return {
        product: product._id,
        name: product.name,
        price: price, // Use price from request
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: 0,
        isPriceModified: Math.abs(price - product.price) > 0.01,
        catalogPrice: product.price
      };
    }).filter(item => item !== null);


    if (orderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products or details provided.' });
    }

    const newOrder = new Order({
      user: user._id,
      items: orderItems,
      customOrderId: await getNextOrderId(),
      status: 'Ordered', // Start as Pending
    });

    await newOrder.save();

    if (orderDate) {
      // Use direct MongoDB collection update to bypass all Mongoose timestamp/validation logic
      await Order.collection.updateOne(
        { _id: newOrder._id },
        { $set: { createdAt: new Date(orderDate) } }
      );
    }

    await syncUserLedger(user._id);

    notifyAdmins('new_order');
    res.status(201).json({ ok: true, message: 'Order created successfully!' });

  } catch (err) {
    console.error("Admin create order error:", err);
    res.status(500).json({ error: 'Server error creating order.' });
  }
});

// Create a new order for a user, as a rate request (Admin/Staff, but typically Staff)
app.post('/api/admin/orders/create-for-user-rate-request', requireAdminOrStaff, async (req, res) => {
  // Logic is very similar to create-for-user, just sets status differently
  try {
    const { userId, items, orderDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items list is empty.' });
    }

    const productIds = items.map(item => item.productId).filter(id => id); // Filter out null for custom products
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const orderItems = items.map(item => {
      if (item.isCustom) {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price);
        if (isNaN(price) || price < 0) return null;
        return {
          name: item.name,
          price: price,
          quantityOrdered: quantity,
          quantityDelivered: 0,
          isCustom: true,
          isQtyNotSpecified: quantity === 0,
          unit: item.unit || '',
          isPriceModified: false,
          catalogPrice: price
        };
      }

      const product = productMap.get(item.productId);
      if (!product) return null;
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price);
      if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) return null;
      return {
        product: product._id,
        name: product.name,
        price: price, // Use price from request
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: 0,
        isPriceModified: Math.abs(price - product.price) > 0.01,
        catalogPrice: product.price
      };
    }).filter(item => item !== null);


    if (orderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products or details provided.' });
    }

    const newOrder = new Order({
      user: user._id,
      items: orderItems,
      customOrderId: await getNextOrderId(),
      status: 'Rate Requested', // Start as Rate Requested
    });

    await newOrder.save();

    if (orderDate) {
      // Use direct MongoDB collection update to bypass all Mongoose timestamp/validation logic
      await Order.collection.updateOne(
        { _id: newOrder._id },
        { $set: { createdAt: new Date(orderDate) } }
      );
    }

    await syncUserLedger(user._id);

    notifyAdmins('new_order');
    res.status(201).json({ ok: true, message: 'Order created and rate change requested.' });

  } catch (err) {
    console.error("Admin create order rate request error:", err);
    res.status(500).json({ error: 'Server error creating order.' });
  }
});

// Record a partial or full delivery
app.post('/api/admin/orders/record-delivery', requireAdminOrStaff, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, deliveries } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error('Invalid order ID format.');
    }
    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      throw new Error('Deliveries array is missing or empty.');
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error('Order not found');
    if (!order.deliveryAgent || !order.deliveryAgent.name) {
      throw new Error('Cannot record delivery without an assigned agent.');
    }
    // Allow recording delivery even if marked 'Fully Dispatched Internally'
    if (!order.status.startsWith('Dispatch') && order.status !== 'Partially Delivered') {
      throw new Error(`Cannot record delivery for order with status: ${order.status}`);
    }

    const deliveryPromises = [];
    const updatedItemsMap = new Map(
      order.items.map(item => [item._id.toString(), { ...item.toObject() }])
    ); // Work with all items, mapped by their unique subdocument ID
    // Use client-supplied delivery date if provided, otherwise use server time
    const now = req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date();

    // Use the dispatch ID that was generated when the agent was assigned
    let currentDispatchId = order.deliveryAgent?.dispatchId;
    if (!currentDispatchId) {
      // Fallback just in case an agent was assigned before this update
      currentDispatchId = await getNextDispatchId();
      if (order.deliveryAgent) {
        order.deliveryAgent.dispatchId = currentDispatchId;
      } else {
        order.deliveryAgent = { dispatchId: currentDispatchId };
      }
    }

    const agentCharge = parseFloat(req.body.rent) || 0;

    for (const del of deliveries) {
      if (!mongoose.Types.ObjectId.isValid(del.productId)) continue; // Skip invalid IDs

      const itemInOrder = updatedItemsMap.get(del.productId);
      if (!itemInOrder) continue; // Item not in order (note: frontend sends item._id as productId for custom)

      const quantityToDeliver = parseFloat(del.quantity);
      if (isNaN(quantityToDeliver) || quantityToDeliver <= 0) continue; // Invalid quantity

      const maxDeliverable = itemInOrder.quantityOrdered - itemInOrder.quantityDelivered;
      const finalQuantity = Math.min(quantityToDeliver, maxDeliverable); // Clamp to max
      if (finalQuantity <= 0) continue; // Nothing to deliver

      // Create delivery record
      const deliveryRecord = new Delivery({
        order: order._id,
        product: itemInOrder.product || null,
        orderItemId: itemInOrder._id,
        name: itemInOrder.name,
        unit: itemInOrder.unit,
        description: itemInOrder.description,
        isCustom: itemInOrder.isCustom || false,
        customOrderId: order.customOrderId,
        deliveryAgent: {
          id: order.deliveryAgent?.id,
          name: order.deliveryAgent?.name || "Unknown Agent",
          mobile: order.deliveryAgent?.mobile,
          description: order.deliveryAgent?.description,
          address: order.deliveryAgent?.address
        },
        agentCharge: agentCharge,
        dispatchId: currentDispatchId,
        quantityDelivered: finalQuantity,
        deliveryDate: now
      });
      deliveryPromises.push(deliveryRecord.save({ session }));

      // Update the temporary map
      itemInOrder.quantityDelivered += finalQuantity;
    }

    if (deliveryPromises.length === 0) {
      throw new Error('No valid items found to record delivery for.');
    }

    await Promise.all(deliveryPromises); // Save all delivery records

    // Update the actual order items based on the map
    order.items = Array.from(updatedItemsMap.values());

    // --- REVERTED LOGIC START ---
    // Recalculate total delivered quantity
    let totalItemsOrdered = 0;
    let totalItemsDeliveredAfter = 0;
    order.items.forEach(item => {
      totalItemsOrdered += item.quantityOrdered; // Keep track of ordered total too
      totalItemsDeliveredAfter += item.quantityDelivered;
    });

    // Calculate the current dispatch number based on history
    const completedDispatches = await Delivery.distinct('dispatchId', { order: orderId }).session(session);
    const currentDispatchCount = completedDispatches.length;

    const tolerance = 0.001;
    if (totalItemsDeliveredAfter > tolerance) {
      // Set to "Dispatch N" instead of Partially Delivered
      order.status = `Dispatch ${currentDispatchCount}`;
    } else {
      // If everything is reverted, go back to Dispatch
      order.status = 'Dispatch';
    }
    // If it started as 'Dispatch' and nothing was delivered or all reverted, it stays 'Dispatch'

    // Do NOT automatically set to 'Delivered'
    // Do NOT automatically set deliveredAt
    order.deliveredAt = undefined; // Ensure deliveredAt is always cleared here
    // --- REVERTED LOGIC END ---

    // Check if the order is now fully dispatched and paid to mark as 'Delivered'
    await checkAndMarkOrderCompleted(order, session);

    await order.save({ session });
    await syncUserLedger(order.user, session);
    await session.commitTransaction();

    notifyAdmins();
    notifyUser(order.user);

    res.json({ ok: true, message: 'Delivery recorded successfully' });

  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Delivery recording error:", err);
    res.status(err.message.startsWith('Invalid') || err.message.startsWith('No valid') || err.message.startsWith('Cannot record') ? 400 : 500)
      .json({ error: err.message || 'Server error while recording delivery.' });
  } finally {
    session.endSession();
  }
});
// Delete a specific dispatch batch and rollback quantities in the order
app.delete('/api/admin/orders/:orderId/dispatch/:dispatchId', requireAdminOrStaff, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, dispatchId } = req.params;

    // 1. Rollback quantities in the Order
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error('Order not found');

    const deliveries = await Delivery.find({ order: orderId, dispatchId }).session(session);
    let didSomething = false;

    // If there ARE deliveries, roll them back and delete them
    if (deliveries.length > 0) {
      for (const del of deliveries) {
        const itemInOrder = order.items.find(item => 
          (del.orderItemId && item._id.toString() === del.orderItemId.toString()) ||
          (item.product && del.product && item.product.toString() === del.product.toString())
        );
        if (itemInOrder) {
          itemInOrder.quantityDelivered = Math.max(0, itemInOrder.quantityDelivered - del.quantityDelivered);
        }
      }

      // Status will be recalculated at the end of this route

      // 3. Delete the delivery records
      await Delivery.deleteMany({ order: orderId, dispatchId }).session(session);
      didSomething = true;
    }

    // 4. Also clear order.deliveryAgent if it matches the dispatchId
    if (order.deliveryAgent && order.deliveryAgent.dispatchId === dispatchId) {
      order.deliveryAgent = undefined;
      didSomething = true;
    }

    if (!didSomething) {
      throw new Error('No delivery records or active agent found for this Dispatch ID.');
    }

    // Recalculate status correctly
    const remainingDispatches = await Delivery.distinct('dispatchId', { order: orderId }).session(session);
    const count = remainingDispatches.length;
    
    if (order.deliveryAgent && order.deliveryAgent.dispatchId) {
      // If an agent is still assigned (e.g. we deleted a previous batch but current assignment remains)
      order.status = `Dispatch ${count + 1} ready`;
    } else if (count > 0) {
      // No current agent, but some dispatches were completed
      order.status = `Dispatch ${count}`;
    } else {
      // Nothing left in history and no agent assigned - set back to generic 'Dispatch'
      order.status = 'Dispatch';
    }

    await order.save({ session });
    await syncUserLedger(order.user, session);
    await session.commitTransaction();
    notifyAdmins();
    notifyUser(order.user);
    res.json({ success: true, message: 'Dispatch batch deleted and quantities rolled back.' });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

// Update agent details for an entire dispatch batch
app.put('/api/admin/orders/:orderId/dispatch/:dispatchId', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, dispatchId } = req.params;
    const { name, mobile, address, description, dispatchDate } = req.body;

    const deliveryUpdateData = {
      "deliveryAgent.name": name || "Unknown Agent",
      "deliveryAgent.mobile": mobile,
      "deliveryAgent.description": description,
      "deliveryAgent.address": address
    };
    if (dispatchDate) {
      deliveryUpdateData.deliveryDate = new Date(dispatchDate);
    }

    const result = await Delivery.updateMany(
      { order: orderId, dispatchId },
      { $set: deliveryUpdateData }
    );

    // Update order.deliveryAgent if it matches the active one
    const order = await Order.findById(orderId);
    let orderUpdated = false;
    if (order && order.deliveryAgent && order.deliveryAgent.dispatchId === dispatchId) {
      order.deliveryAgent.name = name || "Unknown Agent";
      order.deliveryAgent.mobile = mobile;
      order.deliveryAgent.description = description;
      order.deliveryAgent.address = address;
      if (dispatchDate) {
          order.deliveryAgent.date = new Date(dispatchDate);
      }
      await order.save();
      orderUpdated = true;
    }

    if (result.matchedCount === 0 && !orderUpdated) {
      return res.status(404).json({ success: false, message: 'No delivery records found for this Dispatch ID.' });
    }

    res.json({ success: true, message: 'Agent details updated for the dispatch batch.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========== PAYMENT SETTINGS ROUTES (ADMIN ONLY) ===========

// Get all payment settings
app.get('/api/admin/payment-settings', requireAdminOrStaff, async (req, res) => {
  try {
    const settings = await PaymentSetting.find().sort({ createdAt: -1 }).lean();
    res.json(settings);
  } catch (err) {
    console.error("Error fetching payment settings:", err);
    res.status(500).json({ error: 'Server error fetching payment settings.' });
  }
});

// Create or update payment setting
app.post('/api/admin/payment-settings', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const { id, name, qrCode, type, bankName, accountName, accountNumber, ifsc } = req.body;
    console.log(`[DEBUG] Saving payment setting: id=${id}, name=${name}, type=${type}, accountNumber=${accountNumber}`);
    
    if (id) {
      // Update existing
      const updated = await PaymentSetting.findByIdAndUpdate(
        id,
        { name, qrCode, type, bankName, accountName, accountNumber, ifsc },
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: 'Payment setting not found' });
      return res.json({ ok: true, data: updated });
    } else {
      // Create new
      const newSetting = new PaymentSetting({ name, qrCode, type, bankName, accountName, accountNumber, ifsc });
      await newSetting.save();
      return res.status(201).json({ ok: true, data: newSetting });
    }
  } catch (err) {
    console.error("Error saving payment setting:", err);
    res.status(500).json({ error: `Server error saving payment setting: ${err.message}` });
  }
});

// Delete payment setting
app.delete('/api/admin/payment-settings/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const deleted = await PaymentSetting.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Payment setting not found' });
    res.json({ ok: true, message: 'Payment setting deleted' });
  } catch (err) {
    console.error("Error deleting payment setting:", err);
    res.status(500).json({ error: 'Server error deleting payment setting.' });
  }
});


// Update Order CreatedAt Date
app.patch('/api/admin/orders/:id/update-date', requireAdminOrStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate } = req.body;
    console.log(`[DEBUG] Updating order date: orderId=${id}, newDate=${newDate}`);

    if (!newDate) return res.status(400).json({ error: 'New date is required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid order ID' });

    // Use direct MongoDB collection update to bypass all Mongoose timestamp/validation logic
    const updateResult = await Order.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { createdAt: new Date(newDate) } }
    );
    
    console.log(`[DEBUG] MongoDB Update Result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);

    if (updateResult.matchedCount === 0) return res.status(404).json({ error: 'Order not found' });

    // Fetch the updated and populated order to return to the frontend
    const updatedOrder = await Order.findById(id).populate('user').populate('items.product');

    notifyAdmins();
    res.json({ ok: true, order: updatedOrder });
  } catch (err) {
    console.error('Error updating order date:', err);
    res.status(500).json({ error: 'Server error updating order date' });
  }
});

// Update Dispatch Batch Date (Admin Only)
app.patch('/api/admin/orders/:orderId/dispatch-batch-date', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const { orderId } = req.params;
    const { batchKey, newDate } = req.body;

    if (!batchKey || !newDate) return res.status(400).json({ error: 'batchKey and newDate are required' });
    if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

    const batchTimestamp = parseInt(batchKey);
    if (isNaN(batchTimestamp)) return res.status(400).json({ error: 'Invalid batchKey' });

    // Use ±2 second window to match the timestamp-based batch key
    const dateMin = new Date(batchTimestamp - 2000);
    const dateMax = new Date(batchTimestamp + 2000);

    const result = await Delivery.updateMany(
      { order: orderId, deliveryDate: { $gte: dateMin, $lte: dateMax } },
      { $set: { deliveryDate: new Date(newDate) } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'No delivery records found for this batch. Date may not match exactly.' });
    }

    notifyAdmins();
    res.json({ ok: true, message: `Updated ${result.modifiedCount} delivery record(s).` });
  } catch (err) {
    console.error('Error updating dispatch batch date:', err);
    res.status(500).json({ error: 'Server error updating dispatch batch date' });
  }
});


// Update Order Status (helper - remains the same)
const updateOrderStatus = async (orderId, status, updates = {}) => {
  // Basic validation
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid Order ID format");
  }
  const allowedStatuses = ['Ordered', 'Confirmed', 'Paused', 'Delivered', 'Cancelled', 'Rate Requested', 'Rate Approved', 'Hold', 'Dispatch', 'Partially Delivered', 'Completed'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const finalUpdates = { status, ...updates };
  const order = await Order.findByIdAndUpdate(orderId, { $set: finalUpdates }, { new: true })
    .populate('user')
    .populate('items.product');

  if (order) {
    notifyAdmins();
    notifyUser(order.user);
    // Automatically mark as completed if balance is cleared (e.g. when manually marking as Delivered)
    await checkAndMarkOrderCompleted(order);
  }
  return order;
};

// Generic Status Update Route
app.patch('/api/admin/orders/update-status', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, status, reason } = req.body;
    let updates = {};

    // Fetch the order first to check current status
    const currentOrder = await Order.findById(orderId);
    if (!currentOrder) return res.status(404).json({ error: 'Order not found' });

    // Handle special logic for specific statuses
    switch (status) {
      case 'Paused':
      case 'Hold': // Save reason for Hold as well
        if (reason) updates.pauseReason = reason.substring(0, 500); // Limit reason length
        else updates.pauseReason = undefined; // Clear reason if not provided
        break;
      case 'Confirmed':
        updates.confirmedAt = new Date();
        updates.pauseReason = undefined; // Clear reason when confirming
        break;
      case 'Dispatch':
        updates.pauseReason = undefined;
        break;
      case 'Ordered':
        updates.pauseReason = undefined;
        // If canceling rate request, restore original prices
        if (currentOrder.status === 'Rate Requested' || currentOrder.status === 'Rate Approved') {
          const productIds = currentOrder.items.map(item => item.product);
          const products = await Product.find({ _id: { $in: productIds } });
          const productMap = new Map(products.map(p => [p._id.toString(), p]));

          // Restore original prices for all items
          currentOrder.items.forEach(item => {
            if (!item.product) return; // Skip custom items without product ID
            const originalProduct = productMap.get(item.product.toString());
            if (originalProduct) {
              item.price = originalProduct.price;
            }
          });
          await currentOrder.save();
        }
        break;
      case 'Delivered':
        // --- VALIDATION START: Enforce Delivered status ONLY if criteria are met ---
        // 1. Check if all items are fully dispatched
        const totalItemsOrdered = currentOrder.items?.reduce((sum, item) => sum + (item.quantityOrdered || 0), 0) || 0;
        const totalItemsDelivered = currentOrder.items?.reduce((sum, item) => sum + (item.quantityDelivered || 0), 0) || 0;
        const allItemsDispatched = (totalItemsDelivered >= totalItemsOrdered - 0.001);

        // 2. Check if balance is cleared
        const totalAmount = currentOrder.items?.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0) || 0;
        let adjustmentsTotal = 0;
        currentOrder.adjustments?.forEach(adj => {
          if (adj.type === 'charge') adjustmentsTotal += adj.amount;
          else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment' || adj.type === 'less') adjustmentsTotal -= adj.amount;
        });
        const balance = totalAmount + adjustmentsTotal;
        const balanceCleared = (balance <= 0.01);

        if (!allItemsDispatched) {
          return res.status(400).json({ error: 'Order cannot be marked as Delivered: Not all items have been dispatched.' });
        }
        // Balance is allowed to be outstanding for 'Delivered' status.
        // It will automatically move to 'Completed' via checkAndMarkOrderCompleted when balance is zero.

        updates.deliveredAt = new Date();
        updates.pauseReason = undefined;
        // --- VALIDATION END ---
        break;
      case 'Cancelled':
        updates.cancelledAt = new Date();
        updates.pauseReason = undefined;
        break;
    }

    const order = await updateOrderStatus(orderId, status, updates);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ ok: true, message: `Order status updated to ${status}` });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(err.message.startsWith('Invalid') ? 400 : 500)
      .json({ error: err.message || 'Server error updating status.' });
  }
});


// Specific Admin-Only Status Update: Approve Rate Change
app.patch('/api/admin/orders/approve-rate', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only.' });
  }
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId); // Find first
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // If already approved, return success instead of error
    if (order.status === 'Rate Approved') {
      return res.json({ ok: true, message: 'Rate was already approved.' });
    }

    if (order.status !== 'Rate Requested') {
      return res.status(400).json({ error: `Cannot approve rate for order with status: ${order.status}` });
    }
    // Now update using the helper
    await updateOrderStatus(orderId, 'Rate Approved');
    res.json({ ok: true, message: 'Rate approved.' });
  } catch (err) {
    console.error("Error approving rate:", err);
    res.status(err.message.startsWith('Invalid') ? 400 : 500)
      .json({ error: err.message || 'Server error approving rate.' });
  }
});


// Assign a delivery agent
app.patch('/api/admin/orders/assign-agent', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, agentName, agentMobile, agentDescription, agentAddress, dispatchDate } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    // Basic validation for agent details
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name is required.' });
    }
    const newDispatchId = await getNextDispatchId();

    const updates = {
      "deliveryAgent.dispatchId": newDispatchId,
      "deliveryAgent.name": agentName,
      "deliveryAgent.mobile": agentMobile || null, 
      "deliveryAgent.description": agentDescription || null,
      "deliveryAgent.address": agentAddress || null,
      "deliveryAgent.date": dispatchDate ? new Date(dispatchDate) : new Date()
    };

    // Calculate how many dispatches have already occurred
    const completedDispatches = await Delivery.distinct('dispatchId', { order: orderId });
    const nextDispatchNumber = completedDispatches.length + 1;
    updates.status = nextDispatchNumber === 1 ? 'Dispatch 1 ready' : `Dispatch ${nextDispatchNumber} ready`;

    const order = await Order.findByIdAndUpdate(orderId, { $set: updates }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    notifyAdmins();
    notifyUser(order.user);
    res.json({ ok: true, message: 'Agent assigned.' });
  } catch (err) {
    console.error("Error assigning agent:", err);
    res.status(500).json({ error: 'Server error assigning agent.' });
  }
});

// Edit order items (for specific editable states) - Admin/Staff
app.put('/api/admin/orders/edit', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, updatedItems } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // --- THIS IS THE FIX: Added 'Confirmed' and 'Rate Requested' to the array ---
    const editableStates = ['Ordered', 'Paused', 'Hold', 'Rate Requested', 'Rate Approved', 'Confirmed', 'Dispatch', 'Partially Delivered'];
    if (!editableStates.includes(order.status)) {
      return res.status(403).json({ error: `Cannot edit items for an order with status: ${order.status}` });
    }
    // --- END FIX ---

    if (!updatedItems || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      return res.status(400).json({ error: 'Cannot save an empty order.' });
    }

    const productIds = updatedItems.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const existingDeliveryMap = new Map(
      order.items
        .filter(item => item.product)
        .map(item => [item.product.toString(), item.quantityDelivered])
    );

    const newOrderItems = updatedItems.map(item => {
      if (item.isCustom) {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        if (quantity < 0 || price < 0) return null;

        const existingItem = order.items.find(i => i.isCustom && i.name === item.name);
        const oldDeliveredQty = existingItem ? existingItem.quantityDelivered : 0;

        return {
          name: item.name,
          price: price,
          quantityOrdered: quantity,
          quantityDelivered: Math.min(oldDeliveredQty, quantity),
          isCustom: true,
          isQtyNotSpecified: item.isQtyNotSpecified || false,
          unit: item.unit || '',
          description: item.description || '',
          isPriceModified: existingItem ? (price !== existingItem.price || existingItem.isPriceModified) : false,
          catalogPrice: existingItem ? (existingItem.catalogPrice || existingItem.price) : price
        };
      }
      const product = productMap.get(item.productId);
      if (!product) return null;
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price);
      if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) return null;

      const oldDeliveredQty = existingDeliveryMap.get(item.productId) || 0;
      const newDeliveredQty = Math.min(oldDeliveredQty, quantity);

      return {
        product: product._id,
        name: product.name,
        price: price,
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: newDeliveredQty,
        isPriceModified: Math.abs(price - product.price) > 0.01,
        catalogPrice: product.price
      };
    }).filter(item => item !== null);

    if (newOrderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in the update.' });
    }

    order.items = newOrderItems;
    // Do NOT change status here - keep current status

    // --- CONSOLIDATED SAVE: Moved completion check BEFORE saving to ensure single save call ---
    await checkAndMarkOrderCompleted(order, null, false);
    await order.save();
    await syncUserLedger(order.user);
    // --- END CONSOLIDATED SAVE ---

    notifyAdmins('order_updated');
    notifyUser(order.user);
    res.json({ ok: true, message: 'Order items updated successfully.' });

  } catch (err) {
    console.error("Error editing order items (admin/staff):", err);
    res.status(500).json({ error: 'Server error editing order.' });
  }
});

// Add Custom Item to Order (Admin/Staff) - for freeform/customized products
app.post('/api/admin/orders/add-custom-item', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, name, quantity, price, unit, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required.' });
    }
    const parsedQty = (quantity === '' || quantity === undefined || quantity === null) ? 1 : (parseFloat(quantity) || 0);
    const parsedPrice = parseFloat(price) || 0;
    if (parsedQty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
    }
    if (parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a non-negative number.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const customItem = {
      name: name.trim().substring(0, 100),
      price: parsedPrice,
      quantityOrdered: parsedQty,
      quantityDelivered: 0,
      isCustom: true,
      isQtyNotSpecified: (quantity === '' || quantity === undefined || quantity === null),
      unit: unit ? unit.trim().substring(0, 30) : '',
      description: description ? description.trim().substring(0, 200) : '',
      isPriceModified: false,
      catalogPrice: parsedPrice
    };

    // Use MongoDB direct update to bypass product required validation on existing items
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $push: { items: customItem } },
      { new: true, runValidators: false }
    ).populate('user').populate('items.product');

    if (!updatedOrder) return res.status(404).json({ error: 'Order not found during update.' });

    await syncUserLedger(updatedOrder.user._id || updatedOrder.user);

    notifyAdmins('order_updated');
    notifyUser(updatedOrder.user);
    res.json({ ok: true, message: 'Custom item added to order.', order: updatedOrder });
  } catch (err) {
    console.error('Error adding custom item to order:', err);
    res.status(500).json({ error: 'Server error adding custom item.' });
  }
});

// Update a Custom Item in Order (Admin/Staff)
app.put('/api/admin/orders/update-custom-item', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, itemId, name, quantity, price, unit, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid order or item ID format.' });
    }

    const parsedQty = (quantity === '' || quantity === undefined || quantity === null) ? 1 : (parseFloat(quantity) || 0);
    const parsedPrice = parseFloat(price) || 0;
    if (parsedQty < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
    if (parsedPrice < 0) return res.status(400).json({ error: 'Price must be a non-negative number.' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order.' });

    if (!item.isCustom) return res.status(400).json({ error: 'Only custom products can be edited using this endpoint.' });

    item.name = name || item.name;
    item.isQtyNotSpecified = (quantity === '' || quantity === undefined || quantity === null);
    item.quantityOrdered = parsedQty;
    item.isPriceModified = (parsedPrice !== item.price || item.isPriceModified);
    if (!item.catalogPrice) item.catalogPrice = item.price;
    item.price = parsedPrice;
    item.unit = unit !== undefined ? unit : item.unit;
    item.description = description !== undefined ? description : item.description;

    await order.save();
    await checkAndMarkOrderCompleted(order);
    await syncUserLedger(order.user._id || order.user);

    const updatedOrder = await Order.findById(orderId).populate('user').populate('items.product');

    notifyAdmins('order_updated');
    notifyUser(order.user);
    res.json({ ok: true, message: 'Custom item updated.', order: updatedOrder });
  } catch (err) {
    console.error('Error updating custom item:', err);
    res.status(500).json({ error: 'Server error updating custom item.' });
  }
});

// Remove a Custom Item from Order (Admin/Staff)
app.patch('/api/admin/orders/remove-custom-item', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, itemId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid order or item ID format.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order.' });

    if (!item.isCustom) return res.status(400).json({ error: 'Only custom products can be removed using this endpoint.' });

    if (item.quantityDelivered > 0) {
      return res.status(400).json({ error: 'Cannot delete an item that has already been partially or fully delivered.' });
    }

    order.items.pull(itemId);
    await order.save();
    await checkAndMarkOrderCompleted(order);
    await syncUserLedger(order.user._id || order.user);

    const updatedOrder = await Order.findById(orderId).populate('user').populate('items.product');

    notifyAdmins('order_updated');
    notifyUser(order.user);
    res.json({ ok: true, message: 'Custom item removed from order.', order: updatedOrder });
  } catch (err) {
    console.error('Error removing custom item:', err);
    res.status(500).json({ error: 'Server error removing custom item.' });
  }
});

// Request Rate Change (Admin/Staff action, transitions to Rate Requested)
app.patch('/api/admin/orders/request-rate-change', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, updatedItems } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Allow rate change request from these states
    const editableStates = ['Ordered', 'Paused', 'Hold', 'Rate Approved', 'Confirmed', 'Dispatch', 'Partially Delivered'];
    if (!editableStates.includes(order.status)) {
      return res.status(403).json({ error: `Cannot request rate change for order status: ${order.status}` });
    }

    if (!updatedItems || !Array.isArray(updatedItems) || updatedItems.length === 0) {
      return res.status(400).json({ error: 'Cannot save an empty order.' });
    }

    // Logic to update items is identical to the edit route
    const productIds = updatedItems.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const existingDeliveryMap = new Map(
      order.items
        .filter(item => item.product)
        .map(item => [item.product.toString(), item.quantityDelivered])
    );

    const newOrderItems = updatedItems.map(item => {
      if (item.isCustom) {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        if (quantity < 0 || price < 0) return null;

        const existingItem = order.items.find(i => i.isCustom && i.name === item.name);
        const oldDeliveredQty = existingItem ? existingItem.quantityDelivered : 0;

        return {
          name: item.name,
          price: price,
          quantityOrdered: quantity,
          quantityDelivered: Math.min(oldDeliveredQty, quantity),
          isCustom: true,
          unit: item.unit || '',
          description: item.description || '',
          isPriceModified: existingItem ? (price !== existingItem.price || existingItem.isPriceModified) : false,
          catalogPrice: existingItem ? (existingItem.catalogPrice || existingItem.price) : price
        };
      }
      const product = productMap.get(item.productId);
      if (!product) return null;
      const quantity = parseFloat(item.quantity);
      const price = parseFloat(item.price);
      if (isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) return null;

      // --- NEW LOGIC TO PRESERVE DELIVERY STATE ---
      // Get the old delivered quantity for this product, default to 0 if it's a new item
      const oldDeliveredQty = existingDeliveryMap.get(item.productId) || 0;

      // The new delivered qty cannot be more than the new ordered qty
      const newDeliveredQty = Math.min(oldDeliveredQty, quantity);
      // --- END NEW LOGIC ---

      return {
        product: product._id,
        name: product.name,
        price: price, // Use new price
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantityOrdered: quantity,
        quantityDelivered: newDeliveredQty,
        isPriceModified: Math.abs(price - product.price) > 0.01,
        catalogPrice: product.price
      };
    }).filter(item => item !== null);

    if (newOrderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in the update.' });
    }

    order.items = newOrderItems;
    order.status = 'Rate Requested'; // Set status to Rate Requested
    order.pauseReason = undefined; // Clear reason if it was paused/held

    // --- CONSOLIDATED SAVE: Moved completion check BEFORE saving to ensure single save call ---
    await checkAndMarkOrderCompleted(order, null, false);
    await order.save();
    // --- END CONSOLIDATED SAVE ---

    notifyAdmins('order_updated'); // Notify admin/staff
    notifyUser(order.user); // Notify user of status change
    res.json({ ok: true, message: 'Rate change requested.' });

  } catch (err) {
    console.error("Error requesting rate change:", err);
    res.status(500).json({ error: 'Server error requesting rate change.' });
  }
});


// Financial Adjustments (Add)
app.post('/api/admin/orders/adjustments', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, description, amount, type, date, note } = req.body;
    
    // Global Charges Controller Check
    if (type === 'charge') {
      const settings = await AppController.findOne() || await AppController.create({});
      const isAdminFlag = req.session.isAdmin;
      const isStaffFlag = req.session.isStaff;

      if (isAdminFlag && !settings.isChargesEnabledAdmin) {
        return res.status(403).json({ error: 'Charges functionality is currently disabled for Admin.' });
      }
      if (isStaffFlag && !settings.isChargesEnabledStaff) {
        return res.status(403).json({ error: 'Charges functionality is currently disabled for Staff.' });
      }
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    if (!['charge', 'discount', 'advance', 'payment', 'less'].includes(type)) {
      return res.status(400).json({ error: `Invalid adjustment type: ${type}` });
    }
    const adjustmentAmount = parseFloat(amount);
    if (isNaN(adjustmentAmount) || adjustmentAmount < 0) {
      return res.status(400).json({ error: 'Invalid amount (must be non-negative).' });
    }
    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description cannot be empty.' });
    }

    const newAdjustment = { 
      description: description.substring(0, 100), 
      amount: adjustmentAmount, 
      type,
      date: date ? new Date(date) : new Date(),
      note: note ? note.substring(0, 500) : null
    }; // Limit desc length

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $push: { adjustments: newAdjustment } },
      { new: true, runValidators: true } // Run schema validation on update
    ).populate('user', 'name mobile email address');

    if (order) {
      await checkAndMarkOrderCompleted(order);
      await syncUserLedger(order.user._id || order.user);
    }

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    notifyAdmins();
    notifyUser(order.user._id);
    res.json({ ok: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} added.`, order });
  } catch (err) {
    console.error("Error adding adjustment:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error adding adjustment.' });
  }
});

// Financial Adjustments (Update Date)
app.patch('/api/admin/orders/:orderId/adjustments/:adjustmentId/date', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, adjustmentId } = req.params;
    const { newDate } = req.body;

    if (!newDate) return res.status(400).json({ error: 'New date is required' });
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(adjustmentId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, 'adjustments._id': adjustmentId },
      { $set: { 'adjustments.$.date': new Date(newDate) } },
      { new: true }
    ).populate('user', 'name mobile email address').populate('items.product');

    if (!order) return res.status(404).json({ error: 'Order or adjustment not found' });

    notifyAdmins();
    res.json({ ok: true, message: 'Adjustment date updated.', order });
  } catch (err) {
    console.error('Error updating adjustment date:', err);
    res.status(500).json({ error: 'Server error updating adjustment date' });
  }
});

// Financial Adjustments (Remove)
app.patch('/api/admin/orders/remove-adjustment', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, adjustmentId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(adjustmentId)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    // --- MODIFICATION START ---
    // First, find the order and check the adjustment's lock status
    const orderCheck = await Order.findById(orderId);
    if (!orderCheck) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const adj = orderCheck.adjustments.id(adjustmentId);
    if (!adj) {
      return res.status(404).json({ error: 'Adjustment not found.' });
    }

    // If not locked, proceed with removal (Lock removed as per user request to allow editing/removing dispatches)
    const order = await Order.findByIdAndUpdate(
      orderId,
      { $pull: { adjustments: { _id: adjustmentId } } },
      { new: true }
    ).populate('user', 'name mobile email address');
    // --- MODIFICATION END ---

    // Check if the order exists (findByIdAndUpdate returns null if orderId not found)
    if (!order) return res.status(404).json({ error: 'Order not found during update.' });

    await checkAndMarkOrderCompleted(order);
    await syncUserLedger(order.user._id || order.user);

    notifyAdmins();
    notifyUser(order.user._id);
    res.json({ ok: true, message: 'Adjustment removed.', order });
  } catch (err) {
    console.error("Error removing adjustment:", err);
    res.status(500).json({ error: 'Server error removing adjustment.' });
  }
});

app.patch('/api/admin/orders/lock-adjustment', requireAdminOrStaff, async (req, res) => {
  // Only Admin can lock
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only.' });
  }
  try {
    const { orderId, adjustmentId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(adjustmentId)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    // Find the adjustment and make sure it's not already locked
    const orderCheck = await Order.findOne({ _id: orderId, 'adjustments._id': adjustmentId });
    const adj = orderCheck?.adjustments.id(adjustmentId);

    if (!adj) {
      return res.status(404).json({ error: 'Order or adjustment not found.' });
    }
    if (adj.isLocked) {
      return res.status(400).json({ error: 'Adjustment is already locked.' });
    }

    // Use positional operator $ to update the subdocument
    const order = await Order.findOneAndUpdate(
      { _id: orderId, 'adjustments._id': adjustmentId },
      { $set: { 'adjustments.$.isLocked': true } },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: 'Order or adjustment not found during update.' });

    notifyAdmins();
    notifyUser(order.user);
    res.json({ ok: true, message: 'Adjustment locked.' });
  } catch (err) {
    console.error("Error locking adjustment:", err);
    res.status(500).json({ error: 'Server error locking adjustment.' });
  }
});

// --- NEW ROUTE: Add Deduction linked to Delivery ---
app.post('/api/admin/orders/add-delivery-deduction', requireAdminOrStaff, async (req, res) => {
  try {
    const { orderId, deliveryIds, description, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid order ID format.' });
    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) return res.status(400).json({ error: 'Delivery IDs are missing or invalid.' });
    if (!description || description.trim() === '') return res.status(400).json({ error: 'Description is required.' });

    const deductionAmount = parseFloat(amount);
    if (isNaN(deductionAmount) || deductionAmount <= 0) {
      return res.status(400).json({ error: 'Invalid deduction amount (must be positive).' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Add prefix to description for clarity
    const formattedDesc = `${description.substring(0, 100)}`; // Limit length

    const newAdjustment = {
      description: formattedDesc,
      amount: deductionAmount,
      type: 'discount' // Treat as a discount financially
    };

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $push: { adjustments: newAdjustment } },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) return res.status(404).json({ error: 'Order not found (during update).' });

    // --- ADDED COMPLETION CHECK ---
    await checkAndMarkOrderCompleted(updatedOrder);
    // --- END ADDED CHECK ---

    notifyAdmins('order_updated');
    notifyUser(updatedOrder.user, 'order_status_updated'); // Use updatedOrder.user

    // --- FIX: Send the entire updated order back to the client ---
    res.json(updatedOrder);

  } catch (err) {
    console.error("Error adding delivery deduction:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error adding deduction.' });
  }
});

// Delete an order (Admin Only)
// Debugging middleware specifically for delete
app.use('/api/admin/orders/:id', (req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[DELETE ROUTE HIT] Attempting to delete order ID: ${req.params.id}`);
  }
  next();
});

app.delete('/api/admin/orders/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admins only.' });
  }
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    // Try to find and delete the order
    const deletedOrder = await Order.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Delete associated delivery records to maintain referential integrity
    await Delivery.deleteMany({ order: orderId });

    await syncUserLedger(deletedOrder.user);

    // Notify admins of the deletion so UI can refresh if needed
    notifyAdmins('order_deleted');

    res.json({ ok: true, message: 'Order deleted successfully.' });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ error: 'Server error deleting order.' });
  }
});

// Real-time admin/staff stream (SSE) - Enhanced for reliability
app.get('/api/admin/order-stream', requireAdminOrStaff, (req, res) => {
  // Set headers for SSE with proper cache control
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable buffering in nginx
  });

  // Send initial connection message
  res.write('data: connected\n\n');

  // Add this client to the list
  adminClients.push(res);
  console.log(`Admin/Staff client connected. Total clients: ${adminClients.length}`);

  // Send keep-alive pings every 30 seconds to prevent connection timeout
  const keepAliveInterval = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  // When the connection is closed, remove from the list
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    adminClients = adminClients.filter(client => client !== res);
    console.log(`Admin/Staff client disconnected. Remaining clients: ${adminClients.length}`);
  });
});

app.get('/api/myorders/stream', requireUserAuth, (req, res) => {
  if (!req.session.userId) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  const userId = req.session.userId.toString();
  userClients.set(userId, res); // Add user client

  const intervalId = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(intervalId);
    userClients.delete(userId); // Remove user client
  });
});

// General Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie('connect.sid'); // Optional: Clear session cookie
    res.json({ ok: true });
  });
});

// --- App Controller Settings Routes ---
app.get('/api/admin/app-controller', requireAdminOrStaff, async (req, res) => {
  try {
    let settings = await AppController.findOne();
    if (!settings) {
      settings = await AppController.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/app-controller', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await AppController.findOne();
    if (!settings) {
      settings = new AppController(updates);
    } else {
      Object.assign(settings, updates);
    }
    await settings.save();
    notifyAdmins('settings_updated');
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/app-controller/public', async (req, res) => {
  try {
    let settings = await AppController.findOne();
    if (!settings) {
      settings = await AppController.create({});
    }
    res.json({
      isChargesEnabledAdmin: settings.isChargesEnabledAdmin,
      isChargesEnabledStaff: settings.isChargesEnabledStaff
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// KHATABOOK LEDGER SERVICES & CONTROLLERS
// ==========================================

async function syncUserLedger(userId, session = null) {
  // 1. Delete all non-manual (system-generated) transactions for the user
  const deleteQuery = LedgerTransaction.deleteMany({ user: userId, isManual: { $ne: true } });
  if (session) deleteQuery.session(session);
  await deleteQuery;

  // 2. Recalculate Totals (Manual only - active/unclosed only)
  const txnsQuery = LedgerTransaction.find({ user: userId, isClosed: { $ne: true } });
  if (session) txnsQuery.session(session);
  const txns = await txnsQuery;

  let totalYouGave = 0; // Credits: You gave credit (Udhar) to the customer/supplier
  let totalYouGot = 0;  // Debits: You got payment (Mila) from the customer/supplier

  // Fetch opening balance from user profile
  const userQuery = User.findById(userId);
  if (session) userQuery.session(session);
  const user = await userQuery;

  for (const t of txns) {
    if (t.type === 'credit') {
      totalYouGave += t.amount;
    } else if (t.type === 'debit') {
      totalYouGot += t.amount;
    }
  }

  // Outstanding net balance = totalYouGot (Mila/paid) - totalYouGave (Gave/due)
  let netBalance = totalYouGot - totalYouGave;
  if (user && user.openingBalance) {
    if (user.openingBalanceType === 'credit') {
      netBalance += user.openingBalance;
    } else if (user.openingBalanceType === 'debit') {
      netBalance -= user.openingBalance;
    }
  }

  // 3. Update the cached ledger fields in the User document
  const updateQuery = User.findByIdAndUpdate(userId, {
    netBalance,
    totalYouGave,
    totalYouGot
  }, { new: true });
  if (session) updateQuery.session(session);
  await updateQuery;
}

async function backfillLedgerOnStartup() {
  try {
    const fs = require('fs');
    const initFilePath = path.join(__dirname, '.ledger_initialized');
    if (!fs.existsSync(initFilePath)) {
      console.log('--- LEDGER INITIALIZATION: Resetting all users to empty initial state ---');
      await User.updateMany({}, { $set: { isAddedToLedger: false, ledgerType: undefined } });
      fs.writeFileSync(initFilePath, 'true');
      console.log('--- LEDGER INITIALIZATION: Ledger reset completed successfully ---');
    } else {
      console.log('--- LEDGER INITIALIZATION: Ledger already initialized (no-op) ---');
    }
  } catch (err) {
    console.error('Error in ledger startup initialization:', err);
  }
}

// 1. GET /api/admin/ledger/summary
app.get('/api/admin/ledger/summary', requireAdminOrStaff, async (req, res) => {
  try {
    const { ledgerType } = req.query;
    const matchQuery = { isAddedToLedger: true };
    if (ledgerType) {
      matchQuery.ledgerType = ledgerType;
    }

    const summary = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalWillGet: {
            $sum: {
              $cond: [{ $lt: ['$netBalance', 0] }, { $abs: '$netBalance' }, 0]
            }
          },
          totalWillGive: {
            $sum: {
              $cond: [{ $gt: ['$netBalance', 0] }, '$netBalance', 0]
            }
          }
        }
      }
    ]);

    const totalWillGet = summary.length > 0 ? summary[0].totalWillGet : 0;
    const totalWillGive = summary.length > 0 ? summary[0].totalWillGive : 0;
    const totalYouGave = totalWillGet;
    const totalYouGot = totalWillGive;
    const netBalance = totalYouGot - totalYouGave;

    res.json({
      netBalance,
      totalYouGave,
      totalYouGot,
      totalWillGet,
      totalWillGive
    });
  } catch (err) {
    console.error('Error fetching ledger summary:', err);
    res.status(500).json({ error: 'Server error fetching ledger summary.' });
  }
});

// 2. GET /api/admin/ledger/customers
app.get('/api/admin/ledger/customers', requireAdminOrStaff, async (req, res) => {
  try {
    const filterQuery = { isAddedToLedger: true };

    if (req.query.ledgerType) {
      filterQuery.ledgerType = req.query.ledgerType;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { mobile: searchRegex }
      ];
    }

    if (req.query.district) {
      filterQuery.district = new RegExp('^' + req.query.district + '$', 'i');
    }

    if (req.query.taluk) {
      filterQuery.taluk = new RegExp('^' + req.query.taluk + '$', 'i');
    }

    if (req.query.filter === 'debtors') {
      filterQuery.netBalance = { $lt: 0 };
    } else if (req.query.filter === 'creditors') {
      filterQuery.netBalance = { $gt: 0 };
    }

    const customers = await User.find(filterQuery)
      .select('name mobile altMobile district taluk address netBalance totalYouGave totalYouGot ledgerType openingBalance openingBalanceType')
      .sort({ name: 1 });

    const mappedCustomers = await Promise.all(customers.map(async (u) => {
      const lastTx = await LedgerTransaction.findOne({ user: u._id })
        .sort({ date: -1, createdAt: -1 })
        .select('date');

      return {
        user: {
          _id: u._id,
          name: u.name,
          mobile: u.mobile,
          altMobile: u.altMobile,
          district: u.district,
          taluk: u.taluk,
          address: u.address,
          ledgerType: u.ledgerType || 'Customer',
          openingBalance: u.openingBalance || 0,
          openingBalanceType: u.openingBalanceType || 'debit'
        },
        netBalance: u.netBalance || 0,
        totalYouGave: u.totalYouGave || 0,
        totalYouGot: u.totalYouGot || 0,
        lastTransactionDate: lastTx ? lastTx.date : null
      };
    }));

    res.json(mappedCustomers);
  } catch (err) {
    console.error('Error fetching ledger customers:', err);
    res.status(500).json({ error: 'Server error fetching ledger customers.' });
  }
});

// 2.5 POST /api/admin/ledger/close-balance/:userId
app.post('/api/admin/ledger/close-balance/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'Both From Date and To Date are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Find all unclosed transactions in this date range
    const targetTxns = await LedgerTransaction.find({
      user: userId,
      date: { $gte: start, $lte: end },
      isClosed: { $ne: true }
    });

    // Calculate closed net balance (debit/credit sums)
    // credit (type === 'credit') is You Gave (Debit / outstanding)
    // debit (type === 'debit') is You Got (Credit / advance)
    let closedDebitSum = 0;
    let closedCreditSum = 0;

    for (const t of targetTxns) {
      if (t.type === 'credit') {
        closedDebitSum += t.amount;
      } else if (t.type === 'debit') {
        closedCreditSum += t.amount;
      }
    }

    // closedNet = credit - debit
    const closedNet = closedCreditSum - closedDebitSum;

    const openingBalanceBefore = user.openingBalance || 0;
    const openingBalanceTypeBefore = user.openingBalanceType || 'debit';

    // Existing starting balance net value
    const initialNet = user.openingBalanceType === 'credit' ? (user.openingBalance || 0) : -(user.openingBalance || 0);

    // New starting net value
    const newStartingNet = initialNet + closedNet;

    if (newStartingNet < 0) {
      user.openingBalance = Math.abs(newStartingNet);
      user.openingBalanceType = 'debit';
    } else if (newStartingNet > 0) {
      user.openingBalance = Math.abs(newStartingNet);
      user.openingBalanceType = 'credit';
    } else {
      user.openingBalance = 0;
      user.openingBalanceType = 'debit';
    }

    // Mark these transactions as isClosed = true
    await LedgerTransaction.updateMany(
      {
        user: userId,
        date: { $gte: start, $lte: end },
        isClosed: { $ne: true }
      },
      { $set: { isClosed: true } }
    );

    await user.save();

    const closeRecord = await LedgerCloseBalance.create({
      user: userId,
      fromDate: start,
      toDate: end,
      transactionIds: targetTxns.map(t => t._id),
      closedCount: targetTxns.length,
      openingBalanceBefore,
      openingBalanceTypeBefore,
      openingBalanceAfter: user.openingBalance || 0,
      openingBalanceTypeAfter: user.openingBalanceType || 'debit',
      createdBy: (req.session?.adminUsername || req.session?.staffUsername || req.user?.username || 'system')
    });
    
    // Re-synchronize and recalculate active/unclosed ledger balances
    await syncUserLedger(userId);

    // Broadcast update via socket if needed
    if (req.app.get('socketio')) {
      req.app.get('socketio').emit('ledgerUpdate', userId);
    }

    res.json({
      success: true,
      message: 'Ledger transactions in specified range successfully closed and carry-forwarded.',
      openingBalance: user.openingBalance,
      openingBalanceType: user.openingBalanceType,
      closeRecordId: closeRecord._id
    });
  } catch (err) {
    console.error('Error closing balance:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// 3. GET /api/admin/ledger/customer/:userId
app.get('/api/admin/ledger/customer/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    // Always synchronize/recalculate to guarantee up-to-date totals
    await syncUserLedger(userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const txns = await LedgerTransaction.find({ user: userId })
      .sort({ date: 1, createdAt: 1 });

    let running = 0;
    const mappedTxns = txns.map(t => {
      if (t.type === 'credit') {
        running -= t.amount;
      } else if (t.type === 'debit') {
        running += t.amount;
      }

      return {
        _id: t._id,
        date: t.date,
        type: t.type === 'credit' ? 'dr' : 'cr',
        amount: t.amount,
        description: t.description,
        isManual: t.isManual,
        paymentMode: t.paymentMode,
        note: t.note,
        order: t.order,
        adjustmentId: t.adjustmentId,
        productItems: t.productItems || [],
        skuLine: t.skuLine || '',
        isClosed: t.isClosed || false,
        runningBalance: running
      };
    });

    mappedTxns.reverse();

    const closeBalanceHistory = await LedgerCloseBalance.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    const profileData = {
      _id: user._id,
      name: user.name,
      mobile: user.mobile,
      altMobile: user.altMobile,
      district: user.district,
      taluk: user.taluk,
      address: user.address,
      netBalance: user.netBalance || 0,
      totalYouGave: user.totalYouGave || 0,
      totalYouGot: user.totalYouGot || 0,
      ledgerType: user.ledgerType || 'Customer',
      openingBalance: user.openingBalance || 0,
      openingBalanceType: user.openingBalanceType || 'debit'
    };

    res.json({
      profile: profileData,
      customer: profileData, // Symmetrical fix for data.customer references
      transactions: mappedTxns,
      closeBalanceHistory: closeBalanceHistory.map(r => ({
        _id: r._id,
        fromDate: r.fromDate,
        toDate: r.toDate,
        closedCount: r.closedCount || 0,
        openingBalanceBefore: r.openingBalanceBefore || 0,
        openingBalanceTypeBefore: r.openingBalanceTypeBefore || 'debit',
        openingBalanceAfter: r.openingBalanceAfter || 0,
        openingBalanceTypeAfter: r.openingBalanceTypeAfter || 'debit',
        status: r.status || 'active',
        createdBy: r.createdBy || 'system',
        createdAt: r.createdAt,
        revertedAt: r.revertedAt || null,
        deletedAt: r.deletedAt || null
      }))
    });
  } catch (err) {
    console.error('Error fetching single customer ledger:', err);
    res.status(500).json({ error: 'Server error fetching customer ledger.' });
  }
});

app.post('/api/admin/ledger/close-balance/:userId/:closeId/revert', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, closeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(closeId)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const closeRecord = await LedgerCloseBalance.findOne({ _id: closeId, user: userId });
    if (!closeRecord) return res.status(404).json({ error: 'Close balance record not found.' });
    if (closeRecord.status !== 'active') return res.status(400).json({ error: 'Only active close balance can be reverted.' });

    const latestActive = await LedgerCloseBalance.findOne({ user: userId, status: 'active' }).sort({ createdAt: -1 });
    if (!latestActive || String(latestActive._id) !== String(closeRecord._id)) {
      return res.status(400).json({ error: 'Only the latest active close balance can be reverted.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Customer not found.' });

    user.openingBalance = closeRecord.openingBalanceBefore || 0;
    user.openingBalanceType = closeRecord.openingBalanceTypeBefore || 'debit';
    await user.save();

    await LedgerTransaction.updateMany(
      { _id: { $in: closeRecord.transactionIds || [] }, user: userId },
      { $set: { isClosed: false } }
    );

    closeRecord.status = 'reverted';
    closeRecord.revertedAt = new Date();
    await closeRecord.save();

    await syncUserLedger(userId);
    return res.json({ success: true, message: 'Close balance reverted successfully.' });
  } catch (err) {
    console.error('Error reverting close balance:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

app.delete('/api/admin/ledger/close-balance/:userId/:closeId', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, closeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(closeId)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const closeRecord = await LedgerCloseBalance.findOne({ _id: closeId, user: userId });
    if (!closeRecord) return res.status(404).json({ error: 'Close balance record not found.' });
    if (closeRecord.status !== 'active') return res.status(400).json({ error: 'Only active close balance can be deleted.' });

    const latestActive = await LedgerCloseBalance.findOne({ user: userId, status: 'active' }).sort({ createdAt: -1 });
    if (!latestActive || String(latestActive._id) !== String(closeRecord._id)) {
      return res.status(400).json({ error: 'Only the latest active close balance can be deleted.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Customer not found.' });

    user.openingBalance = closeRecord.openingBalanceBefore || 0;
    user.openingBalanceType = closeRecord.openingBalanceTypeBefore || 'debit';
    await user.save();

    await LedgerTransaction.deleteMany({
      _id: { $in: closeRecord.transactionIds || [] },
      user: userId
    });

    closeRecord.status = 'deleted';
    closeRecord.deletedAt = new Date();
    await closeRecord.save();

    await syncUserLedger(userId);
    return res.json({ success: true, message: 'Close balance deleted successfully.' });
  } catch (err) {
    console.error('Error deleting close balance:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// 4. POST /api/admin/ledger/transaction
app.post('/api/admin/ledger/transaction', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, type, amount, description, date, paymentMode, note, productItems } = req.body;

    if (!userId || !type || !amount || !description) {
      return res.status(400).json({ error: 'Missing required transaction fields.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

    const mappedType = type === 'dr' ? 'credit' : 'debit';

    // Build skuLine from productItems if provided
    let skuLine = '';
    let validatedProducts = [];
    if (Array.isArray(productItems) && productItems.length > 0) {
      validatedProducts = productItems.map(p => ({
        productId: p.productId,
        name: p.name,
        sku: p.sku || '',
        qty: Number(p.qty) || 1,
        unitPrice: Number(p.unitPrice) || 0
      }));
      skuLine = validatedProducts
        .filter(p => p.sku)
        .map(p => `${p.sku} × ${p.qty}`)
        .join(', ');
    }

    const txn = new LedgerTransaction({
      user: userId,
      type: mappedType,
      amount: numAmount,
      description,
      date: date ? new Date(date) : new Date(),
      isManual: true,
      paymentMode,
      note,
      productItems: validatedProducts,
      skuLine: skuLine || undefined
    });

    await txn.save();
    await syncUserLedger(userId);

    // Broadcast real-time update to all connected clients
    io.emit('ledger:updated', { userId: userId.toString() });

    res.json({ ok: true, transaction: txn });
  } catch (err) {
    console.error('Error adding ledger transaction:', err);
    res.status(500).json({ error: 'Server error adding transaction.' });
  }
});

// 5a. PUT /api/admin/ledger/transaction/:transactionId  (edit manual transaction)
app.put('/api/admin/ledger/transaction/:transactionId', requireAdminOrStaff, async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const txn = await LedgerTransaction.findById(transactionId);
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });
    if (!txn.isManual) return res.status(400).json({ error: 'Only manual transactions can be edited.' });

    const { amount, description, productItems } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }
    if (numAmount > 999999999.99) {
      return res.status(400).json({ error: 'Amount cannot exceed ₹99,99,99,999.99.' });
    }

    txn.amount = numAmount;
    if (description && description.trim()) txn.description = description.trim();

    // Support editing / clearing product items + rebuild skuLine (same logic as POST add)
    if (Array.isArray(productItems)) {
      let validatedProducts = [];
      if (productItems.length > 0) {
        validatedProducts = productItems.map(p => ({
          productId: p.productId,
          name: p.name,
          sku: p.sku || '',
          qty: Number(p.qty) || 1,
          unitPrice: Number(p.unitPrice) || 0
        }));
      }
      txn.productItems = validatedProducts;

      const newSkuLine = validatedProducts
        .filter(p => p.sku)
        .map(p => `${p.sku} × ${p.qty}`)
        .join(', ');
      txn.skuLine = newSkuLine || undefined;
    }

    await txn.save();

    const userId = txn.user;
    await syncUserLedger(userId);
    io.emit('ledger:updated', { userId: userId.toString() });

    res.json({ ok: true, message: 'Transaction updated successfully.' });
  } catch (err) {
    console.error('Error editing ledger transaction:', err);
    res.status(500).json({ error: 'Server error editing transaction.' });
  }
});

// 5b. DELETE /api/admin/ledger/transaction/:transactionId
app.delete('/api/admin/ledger/transaction/:transactionId', requireAdminOrStaff, async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const txn = await LedgerTransaction.findById(transactionId);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (!txn.isManual) {
      return res.status(400).json({ error: 'Only custom manual transactions can be deleted manually.' });
    }

    const userId = txn.user;

    // Check if user is Admin
    if (req.session.isAdmin) {
      await LedgerTransaction.findByIdAndDelete(transactionId);
      await syncUserLedger(userId);

      // Broadcast real-time update
      io.emit('ledger:updated', { userId: userId.toString() });

      return res.json({ ok: true, deleted: true });
    } else {
      // User is Staff: Flag the transaction for approval
      let requestedBy = 'Staff';
      if (req.session.staffId) {
        const staffUser = await User.findById(req.session.staffId).select('name');
        if (staffUser) {
          requestedBy = staffUser.name;
        }
      }

      txn.deleteRequest = {
        isRequested: true,
        requestedBy,
        requestedAt: new Date(),
        status: 'pending'
      };

      await txn.save();

      // Broadcast update
      io.emit('ledger:updated', { userId: userId.toString() });
      io.emit('ledger:delete-request', { transactionId, userId: userId.toString() });

      return res.json({ ok: true, pendingApproval: true, message: 'Deletion request sent to Admin.' });
    }
  } catch (err) {
    console.error('Error handling ledger transaction deletion:', err);
    res.status(500).json({ error: 'Server error handling deletion.' });
  }
});

// 5c. GET /api/admin/ledger/delete-requests (Admin only)
app.get('/api/admin/ledger/delete-requests', requireAdmin, async (req, res) => {
  try {
    const requests = await LedgerTransaction.find({ 'deleteRequest.status': 'pending' })
      .populate('user', 'name mobile')
      .sort({ 'deleteRequest.requestedAt': -1 });
    res.json(requests);
  } catch (err) {
    console.error('Error fetching deletion requests:', err);
    res.status(500).json({ error: 'Server error fetching deletion requests.' });
  }
});

// 5d. POST /api/admin/ledger/transaction/:transactionId/approve-delete (Admin only)
app.post('/api/admin/ledger/transaction/:transactionId/approve-delete', requireAdmin, async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const txn = await LedgerTransaction.findById(transactionId);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const userId = txn.user;
    await LedgerTransaction.findByIdAndDelete(transactionId);
    await syncUserLedger(userId);

    // Broadcast update
    io.emit('ledger:updated', { userId: userId.toString() });

    res.json({ ok: true, message: 'Transaction deletion approved and completed.' });
  } catch (err) {
    console.error('Error approving transaction deletion:', err);
    res.status(500).json({ error: 'Server error approving deletion.' });
  }
});

// 5e. POST /api/admin/ledger/transaction/:transactionId/reject-delete (Admin only)
app.post('/api/admin/ledger/transaction/:transactionId/reject-delete', requireAdmin, async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const txn = await LedgerTransaction.findById(transactionId);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    txn.deleteRequest = {
      isRequested: false,
      requestedBy: undefined,
      requestedAt: undefined,
      status: 'active'
    };

    await txn.save();

    // Broadcast update
    const userId = txn.user;
    io.emit('ledger:updated', { userId: userId.toString() });

    res.json({ ok: true, message: 'Transaction deletion rejected.' });
  } catch (err) {
    console.error('Error rejecting transaction deletion:', err);
    res.status(500).json({ error: 'Server error rejecting deletion.' });
  }
});

// 6. POST /api/admin/ledger/sync-all
app.post('/api/admin/ledger/sync-all', requireAdminOrStaff, async (req, res) => {
  try {
    const users = await User.find({});
    let successCount = 0;
    for (const u of users) {
      try {
        await syncUserLedger(u._id);
        successCount++;
      } catch (err) {
        console.error(`Error syncing ledger for user ${u._id}:`, err);
      }
    }
    res.json({ ok: true, message: `Successfully synchronized ${successCount} user ledger profiles.` });
  } catch (err) {
    console.error('Error syncing all ledgers:', err);
    res.status(500).json({ error: 'Server error syncing all ledgers.' });
  }
});

// 7. POST /api/admin/ledger/add-to-ledger
app.post('/api/admin/ledger/add-to-ledger', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, ledgerType } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.isAddedToLedger = true;
    user.ledgerType = ledgerType || 'Customer';
    await user.save();
    await syncUserLedger(userId);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Error adding user to ledger:', err);
    res.status(500).json({ error: 'Server error adding user to ledger.' });
  }
});

// 8. POST /api/admin/ledger/switch-type
app.post('/api/admin/ledger/switch-type', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId, ledgerType } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Normalize target type if provided
    let targetType = ledgerType;
    if (targetType && typeof targetType === 'string') {
      targetType = targetType.trim();
      targetType = targetType.charAt(0).toUpperCase() + targetType.slice(1).toLowerCase();
    }

    // Strict validation or fallback toggling case-insensitively
    if (targetType === 'Customer' || targetType === 'Supplier') {
      user.ledgerType = targetType;
    } else {
      const current = (user.ledgerType || 'Customer').toLowerCase();
      user.ledgerType = current === 'customer' ? 'Supplier' : 'Customer';
    }

    await user.save();
    await syncUserLedger(userId);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Error switching user ledger type:', err);
    res.status(500).json({ error: 'Server error switching user ledger type.' });
  }
});

// 9. DELETE /api/admin/ledger/remove-from-ledger/:userId
app.delete('/api/admin/ledger/remove-from-ledger/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Reset ledger properties
    user.isAddedToLedger = false;
    user.ledgerType = undefined;
    user.netBalance = 0;
    user.totalYouGave = 0;
    user.totalYouGot = 0;
    user.openingBalance = 0;
    user.openingBalanceType = 'debit';
    await user.save();
    
    // Delete all ledger transactions for this user
    await LedgerTransaction.deleteMany({ user: userId });
    
    // Broadcast ledger:updated so all lists refresh instantly
    io.emit('ledger:updated', { userId: userId.toString() });
    
    res.json({ ok: true, message: 'User successfully removed from ledger and transactions cleared.' });
  } catch (err) {
    console.error('Error removing user from ledger:', err);
    res.status(500).json({ error: 'Server error removing user from ledger.' });
  }
});

// 10. DELETE /api/admin/ledger/clear-statements/:userId
app.delete('/api/admin/ledger/clear-statements/:userId', requireAdminOrStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Clear all ledger statements/entries and close-balance history for this user.
    await LedgerTransaction.deleteMany({ user: userId });
    await LedgerCloseBalance.deleteMany({ user: userId });

    // Keep user in ledger, but reset ledger balances to fresh state.
    user.netBalance = 0;
    user.totalYouGave = 0;
    user.totalYouGot = 0;
    user.openingBalance = 0;
    user.openingBalanceType = 'debit';
    await user.save();

    io.emit('ledger:updated', { userId: userId.toString() });
    res.json({ ok: true, message: 'All statements cleared for this user.' });
  } catch (err) {
    console.error('Error clearing user ledger statements:', err);
    res.status(500).json({ error: 'Server error clearing statements.' });
  }
});

// GET /api/admin/products/visible — returns all visible products for ledger product picker
app.get('/api/admin/products/visible', requireAdminOrStaff, async (req, res) => {
  try {
    const products = await Product.find({ isVisible: true })
      .select('_id name sku price unit')
      .sort({ name: 1 })
      .lean();
    res.json(products);
  } catch (err) {
    console.error('Error fetching visible products:', err);
    res.status(500).json({ error: 'Server error fetching products.' });
  }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Catch-all for undefined API routes (ensures JSON error instead of HTML)
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Final catch-all for client-side routing (SPA support)
app.get('*', (req, res) => {
  // Avoid sending index.html for API-like paths
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  // Serve React app if build exists, otherwise legacy public folder
  if (hasReactBuild) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open site at: http://localhost:${PORT}`);
});
