const express = require("express");
const router = express.Router();
const fs = require("fs");
const db = require("../database");
const { emailExists } = require("../database");
const { addUser } = require("../database");
const { loginUser } = require("../database");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const { getUserById, getPastTrades, acceptTrade, deleteTradeById, getItemsByUserId, updateTradeAction, getAllTransactions, getAvailableItems, getAllItems, deleteItemById, getAllUsers, deleteUserById, findExchangeMatch, createTransaction, calculateFinalValue } = require("../database");
const { addItem } = require("../database");
const multer = require("multer");
const path = require("path");
const crypto = require('crypto');


const JWT_SECRET = process.env.JWT_SECRET || "getoffmylawnkid";

// Authentication middleware (can be in a separate middleware file)
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user; // This should attach the decoded user data to req.user
    console.log('Authenticated user:', req.user); // Check the decoded user data
    next();
  });
};


// Route for user activity
router.get("/user/:id/activity", authenticateToken, (req, res) => {
  const userId = req.params.id;

  getRecentActivity(userId, (err, activities) => {
    if (err) {
      console.error("Error fetching user activity:", err);
      return res.status(500).json({ message: "Failed to fetch activity" });
    }
    res.status(200).json(activities);
  });
});

// Nodemailer transporter setup (example using Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail", // You can use any mail service (Gmail, SendGrid, etc.)
  auth: {
    user: "barterdb7@gmail.com", // Replace with your email
    pass: "P@ssword123", // Replace with your email password or use an app password for Gmail
  },
});



// Route for user registration
router.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check if the email already exists
  emailExists(email, (err, row) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error" });
    }

    if (row) {
      // Email exists, return 409 Conflict
      return res.status(409).json({ message: "Email already exists" });
    }

    // Hash the password before saving it
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error hashing password", error: err });
      }

      // Add the user to the database
      addUser(name, email, hashedPassword, (err, userId) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Failed to register user", error: err });
        }

        res
          .status(201)
          .json({ message: "User registered successfully", userId });
      });
    });
  });
});

// Serve static files for uploads
router.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer Configuration for Handling Photo Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");

    // Ensure the 'uploads/' directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("Uploads directory created successfully.");
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Append a timestamp to avoid duplicate file names
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
module.exports = upload;

// Route to Add Items with Optional Photo Upload
router.post("/items", authenticateToken, upload.single("photo"), (req, res) => {
  const { userId } = req.user;
  const { name, description, available_quantity, item_type } = req.body;

  // Validate required fields
  if (!userId || !name || !description || !available_quantity || !item_type) {
    return res.status(400).json({ message: "All fields except the photo are required" });
  }

  // Check for uploaded photo and construct public URL
  const photoPath = req.file
    ? `http://localhost:5001/api/auth/uploads/${req.file.filename}`
    : null;

  // Call the addItem function to save the item details
  addItem(
    userId,
    name,
    description,
    available_quantity,
    item_type,
    photoPath,
    (err, itemId) => {
      if (err) {
        console.error("Error adding item:", err);
        return res.status(500).json({ message: "Failed to add item" });
      }

      res.status(201).json({
        message: "Item added successfully",
        itemId,
        photo: photoPath,
      });
    }
  );
});

router.get("/items/available/:userId", (req, res) => {
  const userId = req.params.userId;

  // Fetch available items (excluding the ones owned by the logged-in user)
  getAvailableItems(userId, (err, items) => {
    if (err) {
      console.error("Error fetching available items:", err);
      return res.status(500).json({ message: "Error fetching available items", error: err.message });
    }

    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No available items for trade." });
    }

    // Return the fetched available items
    res.status(200).json({ items });
  });
});
// Route to Fetch Items by User ID
router.get("/items/user/:id", authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Use the getItemsByUserId function
  getItemsByUserId(userId, (err, items) => {
    if (err) {
      console.error("Error fetching items for user:", err);
      return res.status(500).json({ message: "Server error occurred." });
    }

    // Add correct URL prefix to photo paths
    const updatedItems = items.map((item) => {
      if (item.photo) {
        item.photo = `http://localhost:5001/api/auth/uploads/${path.basename(
          item.photo
        )}`;
      }
      return item;
    });

    if (updatedItems.length === 0) {
      return res.status(404).json({ message: "No items found for this user." });
    }

    res.status(200).json({
      userId,
      items: updatedItems,
    });
  });
});

// route to delete items
router.delete("/items/:id", (req, res) => {
  const itemId = req.params.id;

  deleteItemById(itemId, (err, changes) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Failed to delete item", error: err.message });
    }

    if (changes === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    res
      .status(200)
      .json({ message: `Item with ID ${itemId} deleted successfully.` });
  });
});

// Route to Fetch All Items
router.get("/items", (req, res) => {
  getAllItems((err, rows) => {
    if (err) {
      console.error("Error fetching items from database:", err);
      return res.status(500).json({ message: "Failed to fetch items" });
    }

    // Add correct URL prefix to photo paths
    const updatedRows = rows.map((item) => {
      if (item.photo) {
        item.photo = `http://localhost:5001/api/auth/uploads/${path.basename(
          item.photo
        )}`;
      }
      return item;
    });

    console.log("Items fetched and updated with photo URLs:", updatedRows);
    res.status(200).json(updatedRows); // Return updated items with accessible photo URLs
  });
});

// Route to log in a user
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Both email and password are required" });
  }

  loginUser(email, password, (err, user) => {
    if (err) {
      return res
        .status(401)
        .json({ message: err.message || "Invalid email or password" });
    }

    // If session already exists, return existing session info
    if (req.session.userId) {
      return res.status(200).json({
        message: "Already logged in",
        userId: req.session.userId,
        token: req.session.token,
      });
    }

    // Create JWT token, including `is_admin` status
    const token = jwt.sign(
      { userId: user.id, email: user.email, is_admin: user.is_admin }, // Add `is_admin` to the token
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Store session data
    req.session.token = token;
    req.session.userId = user.id;

    return res.status(200).json({
      message: "User logged in successfully",
      userId: user.id,
      token: token,
      is_admin: user.is_admin, // Include admin status in the response
    });
  });
});



// Trade Routes

// Route to initiate a trade (with userId extracted from the token)
router.post('/trade/initiate', authenticateToken, (req, res) => {
  const { productNeeded, itemOffered, quantityNeeded, quantityOffered } = req.body;

  const userId = req.user.userId; // Get userId from the decoded token (not from request body)

  if (!userId) {
    return res.status(400).json({ message: 'User ID is missing from the token' });
  }

  // Ensure that all necessary trade fields are present
  if (!productNeeded || !itemOffered || !quantityNeeded || !quantityOffered) {
    return res.status(400).json({ message: 'All trade fields are required' });
  }

  // Call the createTransaction function to initiate the trade
  createTransaction(userId, itemOffered, productNeeded, quantityNeeded, quantityOffered, (err, result) => {
    if (err) {
      console.error("Error initiating trade:", err);
      return res.status(500).json({ message: "Failed to initiate trade", error: err.message });
    }

    // Return the transaction ID to the client
    res.status(200).json({
      message: "Transaction initiated successfully.",
      transactionId: result.transactionId,
    });
  });
});

// Route to get active (initiated) trades for a user
router.get('/my-transactions/:userId', authenticateToken, (req, res) => {
  const userId = req.params.userId;
  console.log('Fetching active transactions for user:', userId);  // Log to verify the route is being hit

  // Fetch active trades (action = 'initiated')
  getAllTransactions(userId, (err, transactions) => {
    if (err) {
      console.error('Error fetching transactions:', err);
      return res.status(500).json({ message: 'Error fetching transactions', error: err.message });
    }

    console.log('Fetched active transactions:', transactions);  // Log the result from getAllTransactions

    // Return an empty array if no active transactions are found, rather than returning a 404
    res.status(200).json(transactions || []);  // Ensure an empty array is returned if no trades are found
  });
});

// Route to get past trade history for a user
router.get('/past-trades/:userId', authenticateToken, (req, res) => {
  const userId = req.params.userId;
  console.log('Fetching past trades for user:', userId);

  getPastTrades(userId, (err, pastTrades) => {
    if (err) {
      console.error('Error fetching past trades:', err);
      return res.status(500).json({ message: 'Error fetching past trades', error: err.message });
    }

    if (!pastTrades || pastTrades.length === 0) {
      return res.status(404).json({ message: 'No past trades found for this user.' });
    }

    res.status(200).json(pastTrades);  // Return the past trades if found
  });
});



router.post('/trade/accept/:transactionId', authenticateToken, (req, res) => {
  const transactionId = req.params.transactionId;
  const userId = req.user.userId;

  console.log(`Accepting trade for user: ${userId}, transactionId: ${transactionId}`);

  // Call the acceptTrade function to update the status
  acceptTrade(transactionId, userId, (err, result) => {
    if (err) {
      console.error('Error accepting trade:', err);
      return res.status(500).json({ message: 'Error accepting trade', error: err.message });
    }

    res.status(200).json(result);  // Return the success result if trade is accepted
  });
});


// Decline the trade
// Decline the trade and delete it
router.post('/trade/decline/:transactionId', authenticateToken, (req, res) => {
  const { transactionId } = req.params; // Get transactionId from the route parameter
  const userId = req.user.userId;  // Get userId from the decoded token

  // Update the trade status to 'declined'
   updateTradeAction(transactionId, userId, 'declined', (err, result) => {
    if (err) {
      console.error("Error declining trade:", err);
      return res.status(500).json({ message: "Failed to decline the trade", error: err.message });
    }

    // Call the deleteTradeById function from database.js
    deleteTradeById(transactionId, (err, deleteResult) => {
      if (err) {
        console.error("Error deleting trade:", err);
        return res.status(500).json({ message: "Failed to delete the trade", error: err.message });
      }

      // Return a success message after deletion
      res.status(200).json(deleteResult);
    });
  });
});


// Helper function to generate a trade hash
function generateTradeHash() {
  return crypto.randomBytes(8).toString('hex'); // 16 digit hash
}


// Route to handle a trade match
router.post('/match', authenticateToken, (req, res) => {
  const { productNeeded, itemOffered, amountNeeded, amountOffered } = req.body;
  findExchangeMatch(productNeeded, itemOffered, (err, match) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!match) return res.status(404).json({ message: "No suitable match found" });

    const equivalenceRatio = match.equivalenceRatio;

    calculateFinalValue(amountNeeded, equivalenceRatio, 10, (err, finalValue) => {
      if (err) return res.status(500).json({ message: err.message });

      // Continue with transaction creation if final value is valid
      createTransaction(req.user.id, match.userIdB, match.itemA.id, match.itemB.id, 'hashCode', (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json({ message: "Transaction initiated", result });
      });
    });
  });
});



router.get("/user/:id", authenticateToken, (req, res) => {
  const userId = req.params.id; // Retrieve the user ID from the route parameter
  getUserById(userId, (err, user) => {
    if (err || !user) {
      console.error("Error fetching user:", err || "User not found");
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Send user details as JSON response
  });
});

// get list of users for admin page
router.get("/users", (req, res) => {

  // Call the getAllUsers function to fetch the list of users
  getAllUsers((err, users) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).json({ message: "Failed to fetch users" });
    }

    res.status(200).json(users); // Return the list of users
  });
});


// Delete a user (admin only)
router.delete("/users/:id", authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Check if the logged-in user is an admin
  if (!req.user.is_admin) {
    return res.status(403).json({ message: "Admin access required" });
  }

  // Check if the user is trying to delete themselves
  if (req.user.id === userId) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  // Call the deleteUserById function to delete the user from the database
  deleteUserById(userId, (err, changes) => {
    if (err) {
      return res.status(500).json({ message: "Failed to delete user", error: err.message });
    }

    if (changes === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: `User with ID ${userId} deleted successfully` });
  });
});



router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).json({ message: "Logout failed" });
    }
    res.status(200).json({ message: "Logged out successfully" });
  });
});

module.exports = router;
