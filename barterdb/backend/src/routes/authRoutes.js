const express = require('express');
const router = express.Router();
const db = require('../database');
const { emailExists } = require('../database');
const { addUser } = require('../database');
const { loginUser } = require('../database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { getUserById } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'getoffmylawnkid';

// Authentication middleware (can be in a separate middleware file)
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token is not valid' });
    }
    req.user = user;
    next();
  });
};



// Nodemailer transporter setup (example using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any mail service (Gmail, SendGrid, etc.)
  auth: {
    user: 'barterdb7@gmail.com', // Replace with your email
    pass: 'P@ssword123', // Replace with your email password or use an app password for Gmail
  },
});

// Route for user registration
router.post('/register', (req, res) => {
    const { name, email, password } = req.body;
  
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    // Check if the email already exists
    emailExists(email, (err, row) => {
        if (err) {
          return res.status(500).json({ message: 'Internal server error' });
        }
    
        if (row) {
          // Email exists, return 409 Conflict
          return res.status(409).json({ message: 'Email already exists' });
        }
  
      // Hash the password before saving it
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          return res.status(500).json({ message: 'Error hashing password', error: err });
        }
  
        // Add the user to the database
        addUser(name, email, hashedPassword, (err, userId) => {
          if (err) {
            return res.status(500).json({ message: 'Failed to register user', error: err });
          }
  
          res.status(201).json({ message: 'User registered successfully', userId });
        });
      });
    });
  });

// Ensure this is added inside authRoutes.js
router.get('/user/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  
  getUserById(userId, (err, user) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    res.status(200).json(user);
  });
});


router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: 'Both email and password are required' });
  }

  loginUser(email, password, (err, user) => {
      if (err) {
          return res.status(401).json({ message: err.message || 'Invalid email or password' });
      }

      // If session already exists, return existing session info
      if (req.session.userId) {
          return res.status(200).json({ 
              message: 'Already logged in', 
              userId: req.session.userId, 
              token: req.session.token 
          });
      }

      // Create JWT token
      const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '24h' }
      );

      // Store session data
      req.session.token = token;
      req.session.userId = user.id;

      console.log('Session Created:', req.session);

      return res.status(200).json({
          message: 'User logged in successfully',
          userId: user.id,
          token: token
      });
  });
});


module.exports = router;
