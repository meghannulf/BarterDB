const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const sqlite3 = require("sqlite3"); // Added sqlite3 import
const SQLiteStore = require("connect-sqlite3")(session);
const authRoutes = require("./routes/authRoutes");
const jwt = require("jsonwebtoken");
const path = require("path"); // Added path module import
const fs = require("fs"); // Added file system module import

const JWT_SECRET = process.env.JWT_SECRET || "getoffmylawnkid";
const app = express();
const PORT = 5001;

app.use(
  "barterdb/backend/src/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// Ensure the databases directory exists
const databasesDir = path.join(__dirname, "databases");
if (!fs.existsSync(databasesDir)) {
  fs.mkdirSync(databasesDir, { recursive: true });
}

// Specify the sessions directory path
const sessionsDir = path.join(__dirname, "databases");

// Create or open the sessions database
const sessionsDb = new sqlite3.Database("./databases/sessions.db", (err) => {
  if (err) {
    console.error("Error opening sessions database", err);
  } else {
    console.log("Sessions database connected");

    // Create the sessions table if it doesn't exist
    sessionsDb.run(
      `CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            sess TEXT NOT NULL,
            expire INTEGER NOT NULL
        )`,
      (err) => {
        if (err) {
          console.error("Error creating sessions table:", err);
        }
      }
    );
  }
});

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:5001",
      "http://127.0.0.1:5001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(bodyParser.json());

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite", // Store sessions in SQLite
      dir: sessionsDir,
    }),
    secret: JWT_SECRET, // Secret used to sign the session ID cookie
    resave: false, // Don't force session to be saved back to the store
    saveUninitialized: false, // Don't save uninitialized sessions
    cookie: {
      secure: false, // Set to false in development to allow cookies over HTTP
      httpOnly: true, // Make sure cookie is inaccessible to JavaScript
      maxAge: 24 * 60 * 60 * 1000, // Set session expiration time (24 hours)
    },
  })
);

// Persist authentication middleware
const authenticateSession = (req, res, next) => {
  // Check if user is authenticated via session
  if (req.session && req.session.userId) {
    return next();
  }

  // Check for JWT token in Authorization header
  const token =
    req.headers["authorization"]?.split(" ")[1] || req.session.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.session.userId = decoded.userId;
    req.session.email = decoded.email;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Example protected route
app.get("/api/protected", authenticateSession, (req, res) => {
  res.json({
    message: "Access granted",
    userId: req.session.userId,
  });
});

// Define the root route ("/") to respond with something (optional)
app.get("/", (req, res) => {
  res.send("Welcome to the BarterDB API!");
});

// Use the auth routes (handles routes under /api/auth)
app.use("/api/auth", authRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running`);
  console.log(`Listening on all network interfaces`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
