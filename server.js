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

const app = express();
let adminClients = [];
let userClients = new Map();

// Helper to notify all connected admin/staff clients via SSE
function notifyAdmins(type = 'order_updated') {
  adminClients.forEach(client => {
    client.write(`data: ${type}\n\n`);
  });
}

// Helper to notify a specific user client via SSE
function notifyUser(user, type = 'status_updated') {
  if (!user) return;
  const userId = user._id?.toString() || user.toString();
  const client = userClients.get(userId);
  if (client) {
    client.write(`data: ${type}\n\n`);
  }
}

const PORT = process.env.PORT || 5500;

// In-memory caches
let productsCache = { data: null, timestamp: null };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for products
const locationsCache = null; // Will be set once, locations are static

// Enable gzip compression for all responses
app.use(compression());

// Debug logging for API requests
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json({ limit: '2mb' })); // Increased limit for base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard-cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

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

mongoose.connect(process.env.MONGO_URI, {
  // Optimized connection pool for Vercel serverless environment
  maxPoolSize: 3, // Reduced for serverless - each function gets its own instance
  minPoolSize: 1, // Minimum connections to maintain
  maxIdleTimeMS: 10000, // Close idle connections after 10 seconds
  serverSelectionTimeoutMS: 5000, // Timeout for server selection
  socketTimeoutMS: 30000, // Reduced socket timeout for serverless (30s)
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true, // Enable retry writes for better reliability
  w: 'majority' // Write concern for data consistency
}).then(() => {
  console.log('MongoDB connected with serverless-optimized pooling');
  ensureProducts().catch(console.error);
  ensureStaff().catch(console.error);
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
async function checkAndMarkOrderCompleted(order, session) {
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
    const itemsTotal = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);
    
    let adjustmentsTotal = 0;
    if (order.adjustments && order.adjustments.length > 0) {
      order.adjustments.forEach(adj => {
        if (adj.type === 'charge') adjustmentsTotal += adj.amount;
        else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment') {
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
        await order.save({ session });
        
        // Notify relevant parties
        if (typeof notifyAdmins === 'function') notifyAdmins('order_updated');
        if (order.user && typeof notifyUser === 'function') notifyUser(order.user);
      }
      return true;
    } else if (order.status === 'Completed' && (balance > 0.01 || !allDispatched)) {
      // Revert to Delivered if it was Completed but balance is no longer zero, or no longer fully dispatched.
      console.log(`[AUTO-REVERT] Order ${order.customOrderId || order._id}: Balance is now ${balance.toFixed(2)}, Reverting 'Completed' to 'Delivered'.`);
      order.status = 'Delivered';
      await order.save({ session });
      
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


// Middleware to require Admin or Staff login
function requireAdminOrStaff(req, res, next) {
  if (req.session && (req.session.isAdmin || req.session.isStaff)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Middleware to require User login
function requireUserAuth(req, res, next) {
  if (req.session && req.session.userId) {
    // Check if user is blocked
    User.findById(req.session.userId).select('isBlocked').lean()
      .then(user => {
        if (user && user.isBlocked) {
          req.session.destroy();
          return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' });
        }
        next();
      })
      .catch(err => {
        console.error("Auth middleware error:", err);
        res.status(500).json({ error: 'Authentication error' });
      });
    return;
  }
  return res.status(401).json({ error: 'Unauthorized. Please login.' });
}

// --- Real-time Notification Helpers ---
function notifyAdmins(message = 'order_updated') {
  adminClients.forEach(client => client.write(`data: ${message}\n\n`));
}

function notifyUser(userId, message = 'order_status_updated') {
  if (!userId) return;
  const userClient = userClients.get(userId.toString());
  if (userClient) {
    userClient.write(`data: ${message}\n\n`);
  }
}

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
    if (productsCache.data && productsCache.timestamp && (now - productsCache.timestamp) < CACHE_TTL) {
      return res.json(productsCache.data);
    }

    // Fetch fresh data from database, sorted by displayOrder
    const products = await Product.find({ isVisible: true }).select('-__v').sort({ displayOrder: 1, _id: 1 }).lean();

    // Update cache
    productsCache = {
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
        existingOrder.items.map(item => [item.product.toString(), item])
      );

      for (const newItem of orderItems) {
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
    const orders = await Order.find({ user: req.session.userId })
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

    // Delete the order entirely instead of setting status to 'Cancelled'
    await order.deleteOne();

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
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true, message: 'Admin logged in' });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
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


app.post('/api/admin/verify-password', requireAdminOrStaff, (req, res) => {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';
  if (password === ADMIN_PASS) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid admin password' });
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
    if (productsCache.data && productsCache.timestamp && (now - productsCache.timestamp) < CACHE_TTL) {
      return res.json(productsCache.data);
    }

    // Fetch all products (including hidden ones for admin), sorted by displayOrder
    const products = await Product.find().select('-__v').sort({ displayOrder: 1, _id: 1 }).lean();

    // Update cache
    productsCache = {
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
    productsCache = { data: null, timestamp: null };

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
    productsCache = { data: null, timestamp: null };

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
    productsCache = { data: null, timestamp: null };

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
    productsCache = { data: null, timestamp: null };

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
    productsCache = { data: null, timestamp: null };

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

    const { name, email, district, taluk, pincode, altMobile, address, mobile } = req.body;

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
    if (name && name.length > 29) {
      return res.status(400).json({ error: 'Name must be 29 characters or less.' });
    }

    const updateData = { name, email, district, taluk, pincode, altMobile, address };
    if (mobile) updateData.mobile = mobile;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
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
    const { mobile, name, email, district, taluk, address, pincode, altMobile, isRateRequestEnabled } = req.body;

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
      isRateRequestEnabled: isRateRequestEnabled !== undefined ? isRateRequestEnabled : true
    });

    await newUser.save();
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
      .select('_id mobile name email district taluk address pincode altMobile isBlocked createdAt updatedAt')
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
    const activeOrders = await Order.countDocuments({ status: { $nin: ['Delivered', 'Cancelled', 'Completed'] } });

    // 2. Status Distribution
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 3. Revenue and Sales Trend (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueData = await Order.aggregate([
      { $match: { 
          status: { $in: ['Confirmed', 'Delivered', 'Dispatch', 'Partially Delivered', 'Completed'] },
          createdAt: { $gte: sixMonthsAgo }
      }},
      { $project: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' },
          orderTotal: {
            $add: [
              { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: { $multiply: [{ $ifNull: ['$$item.quantityOrdered', 0] }, { $ifNull: ['$$item.price', 0] }] } } } },
              { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } },
              { $multiply: [-1, { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount']] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } }] }
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
      { $match: { status: { $ne: 'Cancelled' } } },
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
        { $match: { status: { $in: ['Confirmed', 'Delivered', 'Dispatch', 'Partially Delivered', 'Completed'] } } },
        { $project: {
            createdAt: 1,
            orderTotal: {
              $add: [
                { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: { $multiply: [{ $ifNull: ['$$item.quantityOrdered', 0] }, { $ifNull: ['$$item.price', 0] }] } } } },
                { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $eq: ['$$adj.type', 'charge'] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } },
                { $multiply: [-1, { $sum: { $map: { input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount']] } } }, as: 'a', in: { $ifNull: ['$$a.amount', 0] } } } }] }
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
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Format into a simple object: { "Pending": 5, "Confirmed": 10, ... }
    const formattedCounts = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Special handling for Dispatch (Dispatch + Partially Delivered)
    formattedCounts['DispatchGroup'] = (formattedCounts['Dispatch'] || 0) + (formattedCounts['Partially Delivered'] || 0);

    // Special handling for Hold (Hold + Paused)
    formattedCounts['HoldGroup'] = (formattedCounts['Hold'] || 0) + (formattedCounts['Paused'] || 0);

    // Calculate "Delivered & Paid" count to adjust counts and avoid overlap
    const deliveredPaidAggregate = await Order.aggregate([
      { $match: { status: 'Delivered' } },
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
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'advance', 'payment']] } } }, 
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
      { $match: { status: { $in: ['Delivered', 'Dispatch', 'Partially Delivered'] } } },
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
                  input: { $filter: { input: { $ifNull: ['$adjustments', []] }, as: 'adj', cond: { $in: ['$$adj.type', ['discount', 'advance', 'payment']] } } }, 
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
    const advanceCount = await Order.countDocuments({ 'adjustments.type': 'advance' });
    formattedCounts['Advance'] = advanceCount;

    res.json(formattedCounts);
  } catch (err) {
    console.error('Order counts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/orders/:id - Admin only order deletion (Password 'v1' verified client-side)
app.delete('/api/admin/orders/:id', requireAdminOrStaff, async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden: Admins only.' });
  try {
    const result = await Order.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/verify-password - Verify admin password for sensitive actions
app.post('/api/admin/verify-password', requireAdminOrStaff, async (req, res) => {
  const { password } = req.body;
  if (password === 'v1') {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});


// =========== ORDER MANAGEMENT (ADMIN/STAFF) ===========

// Get all orders for Admin/Staff panels (optimized)
app.get('/api/admin/orders', requireAdminOrStaff, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name mobile email') // Only fetch needed user fields
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
    const windowStart = new Date(targetDate.getTime() - 2000);
    const windowEnd = new Date(targetDate.getTime() + 2000);

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
      const productId = delivery.product.toString();
      const currentQty = quantityToRevertMap.get(productId) || 0;
      quantityToRevertMap.set(productId, currentQty + delivery.quantityDelivered);
    }

    // Update the main order document quantities
    order.items.forEach(item => {
      const productId = item.product.toString();
      if (quantityToRevertMap.has(productId)) {
        item.quantityDelivered -= quantityToRevertMap.get(productId);
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

    if (totalDelivered >= totalOrdered - tolerance) {
      order.status = 'Delivered';
      order.deliveredAt = new Date();
    } else if (totalDelivered > tolerance) {
      order.status = 'Partially Delivered';
      order.deliveredAt = undefined;
    } else {
      order.status = 'Dispatch';
      order.deliveredAt = undefined;
    }

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

    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const orderItems = items.map(item => {
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

    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const orderItems = items.map(item => {
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
    if (order.status !== 'Dispatch' && order.status !== 'Partially Delivered') {
      throw new Error(`Cannot record delivery for order with status: ${order.status}`);
    }

    const deliveryPromises = [];
    const updatedItemsMap = new Map(order.items.map(item => [item.product.toString(), { ...item.toObject() }])); // Work with copies
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
      if (!itemInOrder) continue; // Item not in order

      const quantityToDeliver = parseFloat(del.quantity);
      if (isNaN(quantityToDeliver) || quantityToDeliver <= 0) continue; // Invalid quantity

      const maxDeliverable = itemInOrder.quantityOrdered - itemInOrder.quantityDelivered;
      const finalQuantity = Math.min(quantityToDeliver, maxDeliverable); // Clamp to max
      if (finalQuantity <= 0) continue; // Nothing to deliver

      // Create delivery record
      const deliveryRecord = new Delivery({
        order: order._id,
        product: itemInOrder.product,
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

    // Always set to Partially Delivered if any delivery occurred.
    // The check for fully delivered will happen in the frontend to show the button.
    const tolerance = 0.001;
    if (totalItemsDeliveredAfter > tolerance) {
      // If ANY quantity has been delivered, it's at least Partially Delivered
      order.status = 'Partially Delivered';
    } else if (order.status === 'Partially Delivered' && totalItemsDeliveredAfter <= tolerance) {
      // If it was Partially Delivered and now everything is reverted, go back to Dispatch
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
        const itemInOrder = order.items.find(item => item.product.toString() === del.product.toString());
        if (itemInOrder) {
          itemInOrder.quantityDelivered = Math.max(0, itemInOrder.quantityDelivered - del.quantityDelivered);
        }
      }

      // Update status if it was 'Delivered' or 'Partially Delivered'
      const totalDelivered = order.items.reduce((sum, item) => sum + item.quantityDelivered, 0);
      const tolerance = 0.001;
      if (totalDelivered <= tolerance) {
        order.status = 'Dispatch';
      } else {
        order.status = 'Partially Delivered';
      }

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

    await order.save({ session });
    await session.commitTransaction();
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
          else if (adj.type === 'discount' || adj.type === 'advance' || adj.type === 'payment') adjustmentsTotal -= adj.amount;
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
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const existingDeliveryMap = new Map(
      order.items.map(item => [item.product.toString(), item.quantityDelivered])
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
          description: item.description || ''
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
      };
    }).filter(item => item !== null);

    if (newOrderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in the update.' });
    }

    order.items = newOrderItems;
    // Do NOT change status here - keep current status
    await order.save();

    // --- ADDED COMPLETION CHECK ---
    await checkAndMarkOrderCompleted(order);
    // --- END ADDED CHECK ---

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
    const parsedQty = parseFloat(quantity) || 0;
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
      unit: unit ? unit.trim().substring(0, 30) : '',
      description: description ? description.trim().substring(0, 200) : ''
    };

    // Use MongoDB direct update to bypass product required validation on existing items
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $push: { items: customItem } },
      { new: true, runValidators: false }
    ).populate('user').populate('items.product');

    if (!updatedOrder) return res.status(404).json({ error: 'Order not found during update.' });

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

    const parsedQty = parseFloat(quantity) || 0;
    const parsedPrice = parseFloat(price) || 0;
    if (parsedQty < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number.' });
    if (parsedPrice < 0) return res.status(400).json({ error: 'Price must be a non-negative number.' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const item = order.items.id(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order.' });

    if (!item.isCustom) return res.status(400).json({ error: 'Only custom products can be edited using this endpoint.' });

    item.name = name || item.name;
    item.quantityOrdered = parsedQty;
    item.price = parsedPrice;
    item.unit = unit !== undefined ? unit : item.unit;
    item.description = description !== undefined ? description : item.description;

    await order.save();
    await checkAndMarkOrderCompleted(order);

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
    const products = await Product.find({ _id: { $in: productIds }, isVisible: true })
      .select('_id name price sku description unit');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const existingDeliveryMap = new Map(
      order.items.map(item => [item.product.toString(), item.quantityDelivered])
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
          description: item.description || ''
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
        quantityDelivered: newDeliveredQty, // <-- USE THE CORRECTED QUANTITY
      };
    }).filter(item => item !== null);

    if (newOrderItems.length === 0) {
      return res.status(400).json({ error: 'No valid products found in the update.' });
    }

    order.items = newOrderItems;
    order.status = 'Rate Requested'; // Set status to Rate Requested
    order.pauseReason = undefined; // Clear reason if it was paused/held
    await order.save();

    // --- ADDED COMPLETION CHECK ---
    await checkAndMarkOrderCompleted(order);
    // --- END ADDED CHECK ---

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
    const { orderId, description, amount, type, date } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    if (!['charge', 'discount', 'advance', 'payment'].includes(type)) {
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
      date: date ? new Date(date) : new Date()
    }; // Limit desc length

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $push: { adjustments: newAdjustment } },
      { new: true, runValidators: true } // Run schema validation on update
    ).populate('user', 'name mobile email');

    if (order) {
      await checkAndMarkOrderCompleted(order);
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
    ).populate('user', 'name mobile email').populate('items.product');

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
    ).populate('user', 'name mobile email');
    // --- MODIFICATION END ---

    // Check if the order exists (findByIdAndUpdate returns null if orderId not found)
    if (!order) return res.status(404).json({ error: 'Order not found during update.' });

    await checkAndMarkOrderCompleted(order);

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

// Server Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open site at: http://localhost:${PORT}`);
});
