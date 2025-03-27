const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bcrypt = require('bcrypt');

// Create or open the SQLite database
const db = new sqlite3.Database('./databases/users.db', (err) => {
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


// Create or open the items database (with a different variable name)
// Create or open the items database (with a different variable name)
const itemsDb = new sqlite3.Database('./databases/items.db', (err) => {
  if (err) {
    console.error('Error opening items database', err);
  } else {
    console.log('Items database connected');

    // Enable foreign key support (SQLite foreign keys are disabled by default)
    itemsDb.run("PRAGMA foreign_keys = ON;", (err) => {
      if (err) {
        console.error('Error enabling foreign keys:', err);
      }
    });

    // Create the items table if it doesn't exist
    itemsDb.run(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,  -- Reference to user who posted the item
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      available_quantity INTEGER NOT NULL,
      item_type TEXT NOT NULL,  -- Product or Service
      posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating items table:', err);
      }
    });

    // Example of adding equivalence_table for item exchange values
    itemsDb.run(`CREATE TABLE IF NOT EXISTS equivalence_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item1_id INTEGER NOT NULL,
      item2_id INTEGER NOT NULL,
      equivalence_ratio DECIMAL(5, 2) NOT NULL,  -- How much of item2 is equivalent to item1
      FOREIGN KEY (item1_id) REFERENCES items(id),
      FOREIGN KEY (item2_id) REFERENCES items(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating equivalence table:', err);
      }
    });

    // Example of adding costs table for transaction fee management
    itemsDb.run(`CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      cost_percentage DECIMAL(5, 2) NOT NULL,  -- Transaction cost in percentage
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating costs table:', err);
      }
    });
  }
});

// Function to add new item
function addItem(userId, name, description, quantity, price, callback) {
    db.run('INSERT INTO items (user_id, name, description, available_quantity, price) VALUES (?, ?, ?, ?, ?)', 
        [userId, name, description, quantity, price], function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, this.lastID); // Return last inserted ID
            }
        });
}

// Function to get all items
function getAllItems(callback) {
    db.all('SELECT * FROM items', [], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows);  // Return all items
        }
    });
}

// Function to get items by user ID
function getItemsByUserId(userId, callback) {
    db.all('SELECT * FROM items WHERE user_id = ?', [userId], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows);  // Return items for specific user
        }
    });
}

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

function getUserById(userId, callback) {
  db.get('SELECT id, name, email FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.error('Error fetching user by ID:', err);
      callback(err, null);
    } else if (!row) {
      callback({ message: 'User not found' }, null);
    } else {
      callback(null, row);
    }
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

module.exports = { db, itemsDb, emailExists, addUser, updatePassword, loginUser, getUserById, addItem, getAllItems, getItemsByUserId };
