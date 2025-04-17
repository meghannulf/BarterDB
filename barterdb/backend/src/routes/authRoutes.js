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
const { getUserById, getAllItems, deleteItemById, getAllUsers, deleteUserById, findExchangeMatch, createTransaction, calculateFinalValue } = require("../database");
const { addItem } = require("../database");
const multer = require("multer");
const path = require("path");

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
    req.user = user; // Attach user data to the request
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

// Route to initiate a trade
router.post('/trade/initiate', authenticateToken, (req, res) => {
  const { productNeeded, itemOffered, amountNeeded, amountOffered, cost1, cost2 } = req.body;

  findExchangeMatch(productNeeded, itemOffered, (err, match) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!match) return res.status(404).json({ message: "No suitable match found" });

    const equivalenceRatio = match.equivalence_ratio;

    calculateFinalValue(amountNeeded, equivalenceRatio, cost1, (err, finalValue) => {
      if (err) return res.status(500).json({ message: err.message });

      // Continue with transaction creation if final value is valid
      createTransaction(req.user.id, match.user_id, productNeeded, itemOffered, generateTradeHash(), (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json({ message: "Transaction initiated", result });
      });
    });
  });
});

// Route to verify the trade
router.post('/trade/verify', authenticateToken, (req, res) => {
  const { tradeHash, itemId1, itemId2 } = req.body;

  verifyTrade(tradeHash, itemId1, itemId2, (err, tradeDetails) => {
    if (err) return res.status(500).json({ message: err.message });

    const { trade, equivalenceRatio } = tradeDetails;

    res.status(200).json({
      message: "Trade verified successfully",
      trade,
      equivalenceRatio
    });
  });
});

// Route to complete the trade
router.post('/trade/complete', authenticateToken, (req, res) => {
  const { tradeHash, itemId1, itemId2 } = req.body;

  verifyTrade(tradeHash, itemId1, itemId2, (err, tradeDetails) => {
    if (err) return res.status(500).json({ message: err.message });

    const { trade, equivalenceRatio } = tradeDetails;

    // Transfer the item from X to A and from B to Y
    barterDb.run(
      "UPDATE items SET user_id = ? WHERE id = ?",
      [req.user.id, itemId1],
      (err) => {
        if (err) return res.status(500).json({ message: "Error transferring items" });

        barterDb.run(
          "UPDATE items SET user_id = ? WHERE id = ?",
          [trade.user_id, itemId2],
          (err) => {
            if (err) return res.status(500).json({ message: "Error transferring items" });

            res.status(200).json({ message: "Trade completed successfully!" });
          }
        );
      }
    );
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
