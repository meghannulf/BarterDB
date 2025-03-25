const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bcrypt = require('bcrypt');

// Create or open the SQLite database
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Database connected');
    // Create the users table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      }
    });
  }
});

// Function to check if email exists
function emailExists(email, callback) {
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Error checking email:', err);
      callback(err, null);
    } else {
      callback(null, row); // Returns null if email does not exist
    }
  });
}

// Function to add new user to the database
function addUser(name, email, password, callback) {
    // First, check if email already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Error checking email:', err);
            callback(err, null);
        } else if (row) {
            // Email already exists, return error
            callback({ message: 'Email already registered.' }, null);
        } else {
            // Proceed to insert the new user
            db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password], function(err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, this.lastID); // Return last inserted ID
                }
            });
        }
    });
}

function loginUser(email, password, callback) {
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
          return callback(err, null);
      }

      if (!row) {
          return callback({ message: 'Invalid email or password' }, null);  // User not found
      }

      // Ensure the password from the user is being compared with the hash stored in the database
      bcrypt.compare(password, row.password, (err, isMatch) => {
          if (err) {
              return callback({ message: 'Error comparing password', error: err.message }, null);
          }

          if (isMatch) {
              // Passwords match, return the user data
              callback(null, row);
          } else {
              // Passwords don't match
              callback({ message: 'Invalid email or password' }, null);
          }
      });
  });
}

// Function to update password for a user (use this for password reset)
function updatePassword(email, newPassword, callback) {
  db.run('UPDATE users SET password = ? WHERE email = ?', [newPassword, email], function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, this.changes); // Return the number of rows affected
    }
  });
}

module.exports = { db, emailExists, addUser, updatePassword, loginUser };
