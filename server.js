require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');

// Models
const User = require('./models/User');
const Staff = require('./models/Staff');
const Product = require('./models/Product');
const Order = require('./models/Order'); // Using the new Order model
const Delivery = require('./models/Delivery'); // New Delivery model
const Counter = require('./models/Counter');

const app = express();
let adminClients = [];
let userClients = new Map();
const PORT = process.env.PORT || 5500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard-cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } 
}));

app.use(express.static(path.join(__dirname, 'public')));

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
}).then(() => {
  console.log('MongoDB connected');
  ensureProducts().catch(console.error);
  ensureStaff().catch(console.error);
}).catch(err => console.error('MongoDB error:', err));

// Preload product list if not present
async function ensureProducts() {
  const count = await Product.countDocuments();
  if (count === 0) {
    const products = [
      { name: 'Product A', description: 'Description A', price: 100, sku: 'P-A', unit: 'kg', isVisible: true },
      { name: 'Product B', description: 'Description B', price: 120, sku: 'P-B', unit: 'pcs', isVisible: true },
      { name: 'Product C', description: 'Description C', price: 150, sku: 'P-C', unit: 'L', isVisible: true },
    ];
    await Product.insertMany(products);
    console.log('Inserted default products');
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
        return next();
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

    const staff = await Staff.findOne({ username });
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
  "Erode": ["Erode","Modakkurichi","Kodumudi","Perundurai","Bhavani","Anthiyur","Gobichettipalayam","Sathyamangalam","Nambiyur","Thalavadi"],
  "Coimbatore": ["Coimbatore (North)","Coimbatore (South)","Mettupalayam","Pollachi","Valparai","Sulur","Annur","Kinathukadavu","Madukkarai","Perur","Anaimalai"],
  "Thirupur": ["Tiruppur (North)","Tiruppur (South)","Avinashi","Palladam","Dharapuram","Kangayam","Madathukulam","Udumalaipettai","Uthukuli"],
  "Namakal": ["Namakkal","Rasipuram","Tiruchengode","Paramathi-Velur","Kolli Hills","Sendamangalam","Kumarapalayam","Mohanur"],
  "Salam": ["Salem","Salem (West)","Salem (South)","Attur","Edappadi","Gangavalli","Mettur","Omalur","Sankagiri","Valapady","Yercaud"]
};
app.get('/api/locations', (req, res) => res.json(ALLOWED_LOCATIONS));


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

    let user = await User.findOne({ mobile });

    if (!user) {
      user = new User({ mobile });
      await user.save();
    }

    req.session.userId = user._id;
    res.json({ ok: true, message: 'Logged in successfully', user: { id: user._id, name: user.name, mobile: user.mobile }});

  } catch (err) {
      console.error("Login/Register error:", err);
      res.status(500).json({ error: 'Server error during login/registration.' });
  }
});

// Get User Profile
app.get('/api/user/profile', requireUserAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-__v');
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

// Get Public Products
app.get('/api/public/products', async (req, res) => {
    try {
        const products = await Product.find({ isVisible: true }).select('-__v'); // Exclude version key
        res.json(products);
    } catch (err) {
        console.error("Error fetching public products:", err);
        res.status(500).json({ error: 'Server error fetching products.' });
    }
});

// Place a new order
app.post('/api/bulk-order', requireUserAuth, async (req, res) => {
  // console.log("Received POST /api/bulk-order"); // LOG REMOVED
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);
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
        status: { $in: ['Pending', 'Paused'] }
    });

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

        existingOrder.status = 'Pending';
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
            status: 'Pending',
        });

        await newOrder.save();
        // console.log("New order created successfully."); // LOG REMOVED

        notifyAdmins('new_order');
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

// Edit a 'Pending' or 'Paused' order (by User)
app.put('/api/myorders/edit', requireUserAuth, async (req, res) => {
  try {
    const { orderId, updatedItems } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ error: 'Order not found or permission denied.' });

    if (order.status !== 'Pending' && order.status !== 'Paused') {
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
    order.status = 'Pending'; // Always reset to pending on user edit
    order.pauseReason = undefined; // Clear reason
    await order.save();

    notifyAdmins('order_updated');
    res.json({ ok: true, message: 'Order updated successfully.' });

  } catch (err) {
    console.error("Error editing order:", err);
    res.status(500).json({ error: 'Server error editing order.' });
  }
});

// Delete a 'Pending' or 'Paused' order (by User)
// This is called when the user removes all items from the cart during an edit.
app.delete('/api/myorders/cancel/:orderId', requireUserAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format.' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.session.userId });
    if (!order) return res.status(404).json({ error: 'Order not found or permission denied.' });

    if (order.status !== 'Pending' && order.status !== 'Paused') {
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

app.get('/api/admin/check', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// Product Management (CRUD) - Accessible by Admin/Staff
app.get('/api/products', requireAdminOrStaff, async (req, res) => {
    try {
        const products = await Product.find().select('-__v');
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
        const { name, description, price, sku, unit } = req.body;
        if (!name || price == null || price < 0) { // Check price properly
            return res.status(400).json({ error: 'Name and a non-negative price are required.' });
        }
        const product = new Product({ name, description, price, sku, unit, isVisible: true }); // Default to visible
        await product.save();
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
        const { name, description, price, sku, unit } = req.body;
         if (!name || price == null || price < 0) {
            return res.status(400).json({ error: 'Name and a non-negative price are required.' });
        }
        const product = await Product.findByIdAndUpdate(req.params.id,
            { name, description, price, sku, unit },
            { new: true, runValidators: true }); // Return updated doc, run validation
        if (!product) return res.status(404).json({ error: 'Product not found.' });
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
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        product.isVisible = !product.isVisible;
        await product.save();
        res.json({ ok: true, isVisible: product.isVisible, message: `Product is now ${product.isVisible ? 'visible' : 'hidden'}.` });
    } catch (err) {
        console.error("Error toggling visibility:", err);
        res.status(500).json({ error: 'Server error toggling visibility.' });
    }
});

// User Management (Admin/Staff accessible)
app.get('/api/admin/users/:userId', requireAdminOrStaff, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return res.status(400).json({ error: 'Invalid user ID format.' });
        }
        const user = await User.findById(req.params.userId).select('-__v');
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
        // --- MODIFICATION: Replaced 'place' and 'landmark' with 'address' ---
        const { name, email, district, taluk, pincode, altMobile, address } = req.body;

        // Add similar validation as in user profile update
        if (email && !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }
        if (pincode && (pincode.length !== 6 || !/^\d{6}$/.test(pincode))) {
             return res.status(400).json({ error: 'Invalid pincode format.' });
        }
        if (altMobile && (altMobile.length !== 10 || !/^\d{10}$/.test(altMobile))) {
             return res.status(400).json({ error: 'Invalid alternative mobile format (must be 10 digits).' });
         }
         if (address && address.length > 150) {
             return res.status(400).json({ error: 'Address must be 150 characters or less.' });
         }
         if (name && name.length > 29) {
             return res.status(400).json({ error: 'Name must be 29 characters or less.' });
         }


        const updatedUser = await User.findByIdAndUpdate(
            req.params.userId,
            // --- MODIFICATION: Updated fields to save ---
            { name, email, district, taluk, pincode, altMobile, address },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ ok: true, message: 'User profile updated successfully.' });

    } catch (err) {
        console.error("Error updating user profile (admin):", err);
         if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error updating user profile.' });
    }
});

app.get('/api/admin/visited-users', requireAdminOrStaff, async (req, res) => {
    try {
        // Find users who have placed at least one order
        const usersWithOrdersResult = await Order.distinct('user');
        // Find users who are NOT in the list above
        // BUG FIX: Removed .select() to fetch the full user document
        const visitedUsers = await User.find({ _id: { $nin: usersWithOrdersResult } })
          .sort({ createdAt: -1 });
        res.json(visitedUsers);
    } catch (err) {
        console.error("Error fetching visited users:", err);
        res.status(500).json({ error: 'Server error fetching visited users.' });
    }
});

app.get('/api/admin/all-users', requireAdminOrStaff, async (req, res) => {
    try {
        const allUsers = await User.find({}).sort({ createdAt: -1 });
        res.json(allUsers);
    } catch (err) {
        console.error("Error fetching all users:", err);
        res.status(500).json({ error: 'Server error fetching all users.' });
    }
});


// =========== ORDER MANAGEMENT (ADMIN/STAFF) ===========

// Get all orders for Admin/Staff panels
app.get('/api/admin/orders', requireAdminOrStaff, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name mobile') // Populate user name and mobile
            .sort({ createdAt: -1 })
            .lean(); // Use lean for performance
        res.json(orders);
    } catch (err) {
        console.error("Error fetching admin orders:", err);
        res.status(500).json({ error: 'Server error fetching orders.' });
    }
});

// Get delivery history for a specific order
app.get('/api/admin/orders/:orderId/history', requireAdminOrStaff, async(req, res) => {
    try {
         if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format.' });
        }
        const deliveries = await Delivery.find({ order: req.params.orderId })
            .sort({ deliveryDate: -1 })
            .populate('product', 'name description unit') // Populate necessary product info
            .lean();
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
    const { userId, items } = req.body;

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
        status: 'Pending', // Start as Pending
    });

    await newOrder.save();

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
    const { userId, items } = req.body;

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
        let totalItemsDeliveredAfter = 0; // After this transaction
        let totalItemsOrdered = 0; // Keep track of ordered total

        const updatedItemsMap = new Map(order.items.map(item => [item.product.toString(), { ...item.toObject() }])); // Work with copies

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
                deliveryAgent: order.deliveryAgent, // Copy current agent details
                quantityDelivered: finalQuantity,
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
        } else if (order.status === 'Partially Delivered' && totalItemsDeliveredAfter <= tolerance){
            // If it was Partially Delivered and now everything is reverted, go back to Dispatch
            order.status = 'Dispatch';
        }
        // If it started as 'Dispatch' and nothing was delivered or all reverted, it stays 'Dispatch'

        // Do NOT automatically set to 'Delivered'
        // Do NOT automatically set deliveredAt
        order.deliveredAt = undefined; // Ensure deliveredAt is always cleared here
        // --- REVERTED LOGIC END ---


        await order.save({ session });
        await session.commitTransaction();

        notifyAdmins();
        notifyUser(order.user);

        res.json({ ok: true, message: 'Delivery recorded successfully' });

    } catch (err) {
        await session.abortTransaction();
        console.error("Delivery recording error:", err);
        res.status(err.message.startsWith('Invalid') || err.message.startsWith('No valid') || err.message.startsWith('Cannot record') ? 400 : 500)
           .json({ error: err.message || 'Server error while recording delivery.' });
    } finally {
        session.endSession();
    }
});


// Update Order Status (helper - remains the same)
const updateOrderStatus = async (orderId, status, updates = {}) => {
    // Basic validation
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new Error("Invalid Order ID format");
    }
    const allowedStatuses = ['Pending', 'Confirmed', 'Paused', 'Delivered', 'Cancelled', 'Rate Requested', 'Rate Approved', 'Hold', 'Dispatch', 'Partially Delivered'];
    if (!allowedStatuses.includes(status)) {
         throw new Error(`Invalid status: ${status}`);
    }

    const finalUpdates = { status, ...updates };
    const order = await Order.findByIdAndUpdate(orderId, { $set: finalUpdates }, { new: true });

    if (order) {
        notifyAdmins();
        notifyUser(order.user);
    }
    return order;
};

// Generic Status Update Route
app.patch('/api/admin/orders/update-status', requireAdminOrStaff, async (req, res) => {
    try {
        const { orderId, status, reason } = req.body;
        let updates = {};

        // Handle special logic for specific statuses
        switch(status) {
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
            case 'Pending': // Also clear reason when moving back to Pending
                 updates.pauseReason = undefined;
                 break;
            case 'Delivered':
                updates.deliveredAt = new Date();
                updates.pauseReason = undefined;
                // Ideally, this should only happen via record-delivery, but allow manual override
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
    const { orderId, agentName, agentMobile, agentDescription, agentAddress } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID format.' });
    }
    // Basic validation for agent details
    if (!agentName) {
        return res.status(400).json({ error: 'Agent name is required.' });
    }

    const updates = {
        "deliveryAgent.name": agentName,
        "deliveryAgent.mobile": agentMobile || null, // Allow empty mobile
        "deliveryAgent.description": agentDescription || null,
        "deliveryAgent.address": agentAddress || null
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

    // --- THIS IS THE FIX: Added 'Confirmed' to the array ---
    const editableStates = ['Pending', 'Paused', 'Hold', 'Rate Approved', 'Confirmed', 'Dispatch', 'Partially Delivered'];
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

    notifyAdmins('order_updated');
    notifyUser(order.user);
    res.json({ ok: true, message: 'Order items updated successfully.' });

  } catch (err) {
    console.error("Error editing order items (admin/staff):", err);
    res.status(500).json({ error: 'Server error editing order.' });
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
    const editableStates = ['Pending', 'Paused', 'Hold', 'Rate Approved', 'Dispatch', 'Partially Delivered'];
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
      const { orderId, description, amount, type } = req.body;
       if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format.' });
        }
       if (!['charge', 'discount', 'advance'].includes(type)) {
            return res.status(400).json({ error: 'Invalid adjustment type.' });
       }
       const adjustmentAmount = parseFloat(amount);
       if (isNaN(adjustmentAmount) || adjustmentAmount < 0) {
            return res.status(400).json({ error: 'Invalid amount (must be non-negative).' });
       }
       if (!description || description.trim() === '') {
            return res.status(400).json({ error: 'Description cannot be empty.' });
       }

      const newAdjustment = { description: description.substring(0, 100), amount: adjustmentAmount, type }; // Limit desc length

      const order = await Order.findByIdAndUpdate(
          orderId,
          { $push: { adjustments: newAdjustment } },
          { new: true, runValidators: true } // Run schema validation on update
      );
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      notifyAdmins();
      notifyUser(order.user);
      res.json({ ok: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} added.` });
    } catch (err) {
      console.error("Error adding adjustment:", err);
       if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
      res.status(500).json({ error: 'Server error adding adjustment.' });
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
      
      // THIS IS THE FIX: Check if the adjustment is locked
      if (adj.isLocked) {
          return res.status(403).json({ error: 'Cannot remove a locked adjustment.' });
      }

      // If not locked, proceed with removal
      const order = await Order.findByIdAndUpdate(
          orderId,
          { $pull: { adjustments: { _id: adjustmentId } } },
          { new: true }
      );
      // --- MODIFICATION END ---

      // Check if the order exists (findByIdAndUpdate returns null if orderId not found)
      if (!order) return res.status(404).json({ error: 'Order not found during update.' });

      notifyAdmins();
      notifyUser(order.user);
      res.json({ ok: true, message: 'Adjustment removed.' });
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
         // --- THIS IS THE FIX ---
         if (!updatedOrder) return res.status(404).json({ error: 'Order not found (during update).' });
         // --- END FIX ---


        notifyAdmins('order_updated');
        notifyUser(order.user, 'order_status_updated'); // Notify user as well

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


// SSE Streams for real-time updates
app.get('/api/admin/order-stream', requireAdminOrStaff, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  adminClients.push(res); // Add client to list

  // Heartbeat to keep connection alive (optional, but good practice)
  const intervalId = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Send comment every 30 seconds

  req.on('close', () => {
    clearInterval(intervalId); // Clear heartbeat on close
    adminClients = adminClients.filter(client => client !== res); // Remove client
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

// Final catch-all for client-side routing
app.get('*', (req, res) => {
  // Avoid sending index.html for API-like paths
  if (req.path.startsWith('/api/')) {
      return res.status(4404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open site at: http://localhost:${PORT}`);
});