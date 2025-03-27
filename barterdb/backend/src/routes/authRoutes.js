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
const { getUserById, getAllItems, deleteItemById } = require("../database");
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
    return res
      .status(400)
      .json({ message: "All fields except the photo are required" });
  }

  // Check for uploaded photo and construct public URL
  const photoPath = req.file
    ? `http://localhost:5001/api/auth/uploads/${req.file.filename}`
    : null;

  // Call your database function to save the item details
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
        item.photo = `http://localhost:5001/uploads/${path.basename(
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
        item.photo = `http://localhost:5001/uploads/${path.basename(
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

    // Create JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });

    // Store session data
    req.session.token = token;
    req.session.userId = user.id;

    console.log("Session Created:", req.session);

    return res.status(200).json({
      message: "User logged in successfully",
      userId: user.id,
      token: token,
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
