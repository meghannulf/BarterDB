const express = require('express');
const router = express.Router();
const db = require('../database');
const { emailExists } = require('../database');
const { addUser } = require('../database');
const { loginUser } = require('../database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'getoffmylawnkids'; // Replace with a strong secret key for JWT

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

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Both email and password are required' });
    }

    // Use the loginUser function to check credentials
    loginUser(email, password, (err, user) => {
        if (err) {
            // Send detailed error message back to the frontend
            return res.status(401).json({ message: err.message || 'Invalid email or password' });
        }

        // Success - user authenticated
        console.log("User logged in successfully");
        return res.status(200).json({ message: 'User logged in successfully', userId: user.id });
    });
});

module.exports = router;
