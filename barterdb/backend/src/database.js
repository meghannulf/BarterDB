const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const crypto = require('crypto');
const path = require('path');
const bcrypt = require("bcrypt");

// Create or open the unified database
const barterDb = new sqlite3.Database("./databases/barterdb.db", (err) => {
  if (err) {
    console.error("Error opening database", err);
    return;
  }

  console.log("Unified database connected");

  // Enable foreign key support (SQLite foreign keys are disabled by default)
  barterDb.run("PRAGMA foreign_keys = ON;", (err) => {
    if (err) {
      console.error("Error enabling foreign keys:", err);
    }
  });

  // Create the users table if it doesn't exist (with the is_admin column)
  barterDb.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE
    )`,
    (err) => {
      if (err) {
        console.error("Error creating users table:", err);
      } else {
        console.log("Users table created or already exists.");
        // After creating the table, run the function to check and create the admin if necessary
        createDefaultAdminIfNotExists();
      }
    }
  );

  barterDb.run(
    `CREATE TABLE IF NOT EXISTS past_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    user_id INTEGER,
    action TEXT,
    created_at TIMESTAMP,
    item_name TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
  )`,
  (err) => {
    if (err) {
      console.error("Error creating items table:", err);
    } else {
      console.log("Items table created or already exists.");
    }
  }
  );
  

  // Create the items table if it doesn't exist
  barterDb.run(
    `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,   -- Reference to user who posted the item
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      available_quantity INTEGER NOT NULL,
      item_type TEXT NOT NULL,    -- Product or Service
      photo TEXT,                 -- Path to the item photo (optional)
      posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) -- Unified reference to users table
    )`,
    (err) => {
      if (err) {
        console.error("Error creating items table:", err);
      } else {
        console.log("Items table created or already exists.");
      }
    }
  );

  // Create the equivalence_table for item exchange values
  barterDb.run(
    `CREATE TABLE IF NOT EXISTS equivalence_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item1_id INTEGER NOT NULL,
      item2_id INTEGER NOT NULL,
      equivalence_ratio DECIMAL(5, 2) NOT NULL,  -- How much of item2 is equivalent to item1
      FOREIGN KEY (item1_id) REFERENCES items(id),
      FOREIGN KEY (item2_id) REFERENCES items(id)
    )`,
    (err) => {
      if (err) {
        console.error("Error creating equivalence table:", err);
      } else {
        console.log("Equivalence table created or already exists.");
      }
    }
  );

  // Create the transactions table
  barterDb.run(
    `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,       -- ID of the user performing the action
        item_id INTEGER NOT NULL,       -- ID of the item involved (if applicable)
        action TEXT NOT NULL,           -- e.g., 'added item', 'traded item', 'accepted offer', 'declined offer'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    (err) => {
      if (err) {
        console.error("Error creating transactions table:", err);
      } else {
        console.log("Transactions table created or already exists.");
      }
    }
  );

  // Create the costs table for transaction fee management
  barterDb.run(
    `CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      cost_percentage DECIMAL(5, 2) NOT NULL,  -- Transaction cost in percentage
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    (err) => {
      if (err) {
        console.error("Error creating costs table:", err);
      } else {
        console.log("Costs table created or already exists.");
      }
    }
  );
});

//function to create admin
// Function to check if the default admin exists, and create them if not
function createDefaultAdminIfNotExists() {
  const defaultAdminEmail = "barter_admin@gmail.com";
  const defaultAdminPassword = "admin123";
  const defaultAdminName = "admin";

  // Check if the admin user already exists
  barterDb.get(
    "SELECT id FROM users WHERE email = ?",
    [defaultAdminEmail],
    (err, row) => {
      if (err) {
        console.error("Error checking if admin exists:", err);
        return;
      }

      if (row) {
        console.log("Admin already exists");
        return; // If the admin exists, no need to create again
      }

      // If the admin doesn't exist, create the admin user
      bcrypt.hash(defaultAdminPassword, 10, (err, hashedPassword) => {
        if (err) {
          console.error("Error hashing admin password:", err);
          return;
        }

        // Add the default admin user
        barterDb.run(
          `INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)`,
          [defaultAdminName, defaultAdminEmail, hashedPassword, true],
          function (err) {
            if (err) {
              console.error("Error adding admin user:", err);
            } else {
              console.log("Default admin user created");
            }
          }
        );
      });
    }
  );
}


// function to log user activity
function logUserActivity(userId, itemId, action, callback) {
  barterDb.run(
    "INSERT INTO transactions (user_id, item_id, action) VALUES (?, ?, ?)",
    [userId, itemId, action],
    function (err) {
      if (err) {
        console.error("Error logging activity:", err);
        callback(err, null);
      } else {
        console.log(`Activity logged: ${action}`);
        callback(null, this.lastID); // Return the transaction ID
      }
    }
  );
}

// Function to get User activity
function getRecentActivity(userId, callback) {
  barterDb.all(
    `SELECT t.id, t.action, i.name AS item_name, t.created_at
     FROM transactions t
     LEFT JOIN items i ON t.item_id = i.id
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC
     LIMIT 10`, // Most recent 10 activities
    [userId],
    (err, rows) => {
      if (err) {
        console.error("Error fetching recent activity:", err);
        callback(err, null);
      } else {
        callback(null, rows); // Return activity rows
      }
    }
  );
}

// Function to add new item
// Function to add new item
function addItem(
  userId,
  name,
  description,
  quantity,
  type,
  photoPath,
  callback
) {
  console.log("Adding item with data:", {
    userId,
    name,
    description,
    quantity,
    type,
    photoPath,
  });

  // Insert the item into the database
  barterDb.run(
    "INSERT INTO items (user_id, name, description, available_quantity, item_type, photo) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, name, description, quantity, type, photoPath],
    function (err) {
      if (err) {
        console.error("Error adding item:", err);
        callback(err, null);  // If an error occurs, return it through the callback
      } else {
        callback(null, this.lastID);  // Return last inserted ID on success
      }
    }
  );
}


// Function to generate a unique trade hash
function generateTradeHash() {
  return crypto.randomBytes(8).toString('hex'); // Generate a random 16-character hash
}

// Function to create a transaction immediately
function createTransaction(userId, offeredId, productId, quantityNeeded, quantityOffered, callback) {
  console.log('Creating transaction with userId:', userId);
  console.log('Offered ID:', offeredId);
  console.log('Product ID:', productId);
  console.log('Quantity Needed:', quantityNeeded);
  console.log('Quantity Offered:', quantityOffered);

  // Ensure valid inputs before proceeding with the database insert
  if (!userId || !offeredId || !productId) {
    return callback(new Error('Missing necessary data for transaction creation'), null);
  }

  // Get the name of the item the user is offering (item A)
  barterDb.get(`SELECT name FROM items WHERE id = ?`, [offeredId], (errA, itemA) => {
    if (errA) return callback(errA, null);
    if (!itemA) return callback(new Error("Item A not found"), null);

    // Get the name of the product the user needs (item B)
    barterDb.get(`SELECT name FROM items WHERE id = ?`, [productId], (errB, itemB) => {
      if (errB) return callback(errB, null);
      if (!itemB) return callback(new Error("Item B not found"), null);

      // Now that we have the names of both items, we can proceed to create the transaction
      const itemAName = itemA.name;
      const itemBName = itemB.name;
      const timestamp = new Date().toISOString();  // Ensure a valid timestamp is used

      // Insert trade transaction for the user offering item A
      barterDb.run(
        `INSERT INTO transactions (user_id, item_id, action, created_at) VALUES (?, ?, ?, ?)`,
        [userId, offeredId, 'Trade initiated', timestamp],
        function (err) {
          if (err) return callback(err, null);

          // Log the transaction for the other user receiving item B
          barterDb.run(
            `INSERT INTO transactions (user_id, item_id, action, created_at) VALUES (?, ?, ?, ?)`,
            [userId, productId, 'Trade initiated', timestamp],
            function (err2) {
              if (err2) return callback(err2, null);

              // Return both items and the transaction ID
              callback(null, {
                transactionId: this.lastID,  // Return the transaction ID
                itemAName: itemAName,
                itemBName: itemBName
              });
            }
          );
        }
      );
    });
  });
}
  


// Function to get equivalence ration
function getEquivalenceRatio(item1, item2, callback) {
  barterDb.get(
    `SELECT equivalence_ratio
     FROM equivalence_table
     WHERE item1_id = ? AND item2_id = ?`,
    [item1, item2],
    (err, row) => {
      if (err) return callback(err, null);
      if (!row) return callback(null, null); // No equivalence ratio found
      return callback(null, row.equivalence_ratio); // Return equivalence ratio
    }
  );
}

// Value function
function calculateFinalValue(itemPrice, equivalenceRatio, costPercentage, callback) {
  const finalValue = itemPrice * equivalenceRatio * (1 - costPercentage / 100);
  return callback(null, finalValue);
}

// Transaction functions 
function createTransaction(userIdA, itemAId, itemBId, action, timestamp, callback) {
  // First, fetch the userId associated with itemBId (userIdB)
  barterDb.get(
    `SELECT user_id FROM items WHERE id = ?`,
    [itemBId],
    (err, row) => {
      if (err) {
        return callback(err, null);
      }

      if (!row) {
        return callback(new Error("Item B not found"), null);
      }

      const userIdB = row.user_id; // Get userIdB from the query result

      // Insert trade transaction for user A (initiating trade)
      barterDb.run(
        `INSERT INTO transactions (user_id, item_id, action, created_at) VALUES (?, ?, ?, ?)`,
        [userIdA, itemAId, action, timestamp],
        function (err) {
          if (err) return callback(err, null);

          // Log the transaction for the other user (user B, receiving the trade)
          barterDb.run(
            `INSERT INTO transactions (user_id, item_id, action, created_at) VALUES (?, ?, ?, ?)`,
            [userIdB, itemBId, action, timestamp],
            function (err2) {
              if (err2) return callback(err2, null);

              callback(null, {
                transactionId: this.lastID, // Return the transaction ID of the first entry
              });
            }
          );
        }
      );
    }
  );
}

// Function to fetch active (initiated) transactions for a user
function getAllTransactions(userId, callback) {
  // Query to fetch active transactions for the given user (where action = 'initiated')
  const allTransactionsQuery = `
    SELECT t.id, t.item_id, t.action, t.created_at, i.name AS item_name
    FROM transactions t
    JOIN items i ON t.item_id = i.id
    WHERE t.user_id = ? AND t.action = 'initiated'  -- Only active trades
  `;

  // Fetch all active transactions
  barterDb.all(allTransactionsQuery, [userId], (err, transactions) => {
    if (err) {
      console.error('Error fetching transactions:', err);  // Log error if any
      return callback(err, null); // Return the error if fetching transactions fails
    }

    console.log('Fetched transactions for user:', userId);
    console.log(transactions);  // Log the transactions to see the structure and contents

    if (!transactions || transactions.length === 0) {
      console.log('No active transactions found for this user.');
    }

    // Return only active transactions
    callback(null, transactions);
  });
}

// Function to fetch past trades for a user
function getPastTrades(userId, callback) {
  // Query to fetch past trades for the given user
  const pastTradesQuery = `
    SELECT pt.id, pt.item_id, pt.user_id, pt.action, pt.created_at, pt.item_name AS item_name
    FROM past_trades pt
    JOIN items i ON pt.item_id = i.id
    WHERE pt.user_id = ?;  -- Only trades associated with the user
  `;

  // Fetch past trades
  barterDb.all(pastTradesQuery, [userId], (err, pastTrades) => {
    if (err) {
      console.error('Error fetching past trades:', err);
      return callback(err, null);  // Return error if fetching fails
    }

    console.log('Fetched past trades for user:', userId);
    console.log(pastTrades);  // Log the past trades to see the structure

    // Return past trades
    callback(null, pastTrades);
  });
}



// Update once trade is accepted
// Function to accept the trade and move it to past_trades
function acceptTrade(transactionId, userId, callback) {
  const selectQuery = `SELECT * FROM transactions WHERE id = ? AND user_id = ?`;

  barterDb.get(selectQuery, [transactionId, userId], (err, row) => {
    if (err) {
      console.error("Error fetching trade:", err);
      return callback(err, null);
    }

    if (!row) {
      return callback(new Error("Trade not found"), null);
    }

    // Update the trade status to "accepted" in the transactions table
    const updateQuery = `
      UPDATE transactions
      SET action = 'accepted'
      WHERE id = ? AND user_id = ?
    `;

    barterDb.run(updateQuery, [transactionId, userId], function(err) {
      if (err) {
        console.error("Error updating trade status:", err);
        return callback(err, null);
      }

      callback(null, { message: "Trade accepted." });
    });
  });
}



// Function to update the action of a trade
function updateTradeAction(transactionId, userId, action, callback) {
  const updateQuery = `
    UPDATE transactions 
    SET action = ? 
    WHERE id = ? AND user_id = ?
  `;

  barterDb.run(updateQuery, [action, transactionId, userId], function (err) {
    if (err) {
      console.error("Error updating trade action:", err);
      return callback(err, null);
    }
    console.log(`Rows updated: ${this.changes}`);  // Log how many rows were affected
    if (this.changes === 0) {
      console.log("No rows were updated. Check if transactionId and userId are correct.");
    }
    callback(null, { message: `Trade action updated to ${action} successfully.` });
  });
}



function deleteTradeById(transactionId, callback) {
  const deleteQuery = `DELETE FROM transactions WHERE id = ?`;

  barterDb.run(deleteQuery, [transactionId], function (err) {
    if (err) {
      console.error("Error deleting trade:", err);  // Log the error
      return callback(err, null);
    }
    callback(null, { message: "Trade deleted successfully" });
  });
}


// verify the transaction 
function verifyTransaction(hashCodePartA, hashCodePartB, callback) {
  const fullHashCode = hashCodePartA + hashCodePartB;
  if (isValidHash(fullHashCode)) {
    // Verify that each participant has provided their item
    // (You can extend this by checking if items were posted, and the transaction was correctly initiated)
    return callback(null, true); // Verification successful
  } else {
    return callback(new Error("Invalid hash code"), null); // Hash mismatch
  }
}

// Example hash validation function (use a secure hashing method in practice)
function isValidHash(hashCode) {
  return hashCode.length === 16; // Just an example of length verification
}

// Complete the exchange 
// After the trade is accepted, update the items table to reflect the new ownership
function completeTrade(transactionId, userIdA, userIdB, itemAId, itemBId, callback) {
  // First, update item A ownership to user B
  barterDb.run(
    `UPDATE items SET user_id = ? WHERE id = ?`,
    [userIdB, itemAId],
    function (err) {
      if (err) return callback(err, null);

      // Then update item B ownership to user A
      barterDb.run(
        `UPDATE items SET user_id = ? WHERE id = ?`,
        [userIdA, itemBId],
        function (err2) {
          if (err2) return callback(err2, null);

          // Update the transaction to mark it as completed
          barterDb.run(
            `UPDATE transactions SET action = 'completed trade' WHERE id = ?`,
            [transactionId],
            function (err3) {
              if (err3) return callback(err3, null);

              callback(null, "Trade completed successfully!");
            }
          );
        }
      );
    }
  );
}




// Function to get all items without including empty columns
function getAllItems(callback) {
  barterDb.all(
    `SELECT id, user_id, name, description, available_quantity, item_type, 
        posted_at, 
        CASE 
          WHEN photo IS NOT NULL AND photo != '' THEN photo 
          ELSE NULL 
        END AS photo 
      FROM items`,
    [],
    (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        // Filter rows to exclude columns where all their values are NULL or empty
        const filteredRows = rows.map((row) => {
          const result = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && value !== "") {
              result[key] = value; // Add non-empty values to the result object
            }
          }
          return result;
        });

        callback(null, filteredRows); // Return items with only non-empty columns
      }
    }
  );
}

function getAvailableItems(userId, callback) {
  // SQL query to fetch all items except those owned by the logged-in user
  const query = `
    SELECT id, user_id, name, description, available_quantity, item_type, 
           posted_at, 
           CASE 
             WHEN photo IS NOT NULL AND photo != '' THEN photo 
             ELSE NULL 
           END AS photo 
    FROM items
    WHERE user_id != ?;
  `;  // Exclude items owned by the logged-in user (user_id != userId)

  barterDb.all(query, [userId], (err, rows) => {
    if (err) {
      return callback(err, null); // Return error if there's an issue with the query
    }

    if (!rows || rows.length === 0) {
      return callback(null, []); // Return empty array if no items are found
    }

    // Filter rows to exclude columns where all their values are NULL or empty
    const filteredRows = rows.map((row) => {
      const result = {};
      for (const [key, value] of Object.entries(row)) {
        if (value !== null && value !== "") {
          result[key] = value; // Add non-empty values to the result object
        }
      }

      // Add correct URL prefix to photo paths if available
      if (result.photo) {
        result.photo = `http://localhost:5001/api/auth/uploads/${path.basename(result.photo)}`;
      }

      return result;
    });

    callback(null, filteredRows); // Return items with only non-empty columns and photo URLs
  });
}


// Function to get items by user ID
function getItemsByUserId(userId, callback) {
  barterDb.all(
    "SELECT * FROM items WHERE user_id = ?",
    [userId],
    (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, rows); // Return items for specific user
      }
    }
  );
}

// Function to delete items
function deleteItemById(itemId, callback) {
  barterDb.run("DELETE FROM items WHERE id = ?", [itemId], function (err) {
    if (err) {
      console.error("Error deleting item:", err);
      callback(err, null);
    } else {
      console.log(`Item with ID ${itemId} deleted successfully.`);
      callback(null, this.changes); // Return the number of rows affected
    }
  });
}

// Function to check if email exists
function emailExists(email, callback) {
  barterDb.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
    if (err) {
      console.error("Error checking email:", err);
      callback(err, null);
    } else {
      callback(null, row); // Returns null if email does not exist
    }
  });
}

//function to get all users from the database
function getAllUsers(callback) {
  barterDb.all(
    "SELECT * FROM users", 
    [], 
    (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, rows); // Return users data
      }
    }
  );
}


// Function to add new user to the database
function addUser(name, email, password, callback) {
  barterDb.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
    if (err) {
      console.error("Error checking email:", err);
      callback(err, null);
    } else if (row) {
      // Email already exists, return error
      callback({ message: "Email already registered." }, null);
    } else {
      barterDb.run(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, password],
        function (err) {
          if (err) {
            callback(err, null);
          } else {
            callback(null, this.lastID); // Return last inserted ID
          }
        }
      );
    }
  });
}

function loginUser(email, password, callback) {
  barterDb.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
    if (err) {
      return callback(err, null);
    }

    if (!row) {
      return callback({ message: "Invalid email or password" }, null); // User not found
    }

    // Ensure the password from the user is being compared with the hash stored in the database
    bcrypt.compare(password, row.password, (err, isMatch) => {
      if (err) {
        return callback(
          { message: "Error comparing password", error: err.message },
          null
        );
      }

      if (isMatch) {
        // Passwords match, return the user data
        callback(null, row);
      } else {
        // Passwords don't match
        callback({ message: "Invalid email or password" }, null);
      }
    });
  });
}

// Function to get user by ID
function getUserById(userId, callback) {
  barterDb.get(
    "SELECT id, name, email FROM users WHERE id = ?",
    [userId],
    (err, row) => {
      if (err) {
        console.error("Error fetching user by ID:", err);
        return callback(err, null);
      }
      if (!row) {
        return callback({ message: "User not found" }, null);
      }
      callback(null, row);
    }
  );
}

// delete users from database (admin)
function deleteUserById(userId, callback) {
  barterDb.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
    if (err) {
      console.error("Error deleting user:", err);
      callback(err, null);
    } else {
      callback(null, this.changes); // Return number of rows affected (0 if no user was deleted)
    }
  });
}

// Function to update password for a user
function updatePassword(email, newPassword, callback) {
  barterDb.run(
    "UPDATE users SET password = ? WHERE email = ?",
    [newPassword, email],
    function (err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, this.changes); // Return the number of rows affected
      }
    }
  );
}

module.exports = {
  barterDb,
  updateTradeAction,
  emailExists,
  addUser,
  getPastTrades,
  updatePassword,
  loginUser,
  getUserById,
  deleteUserById,
  getAllUsers,
  addItem,
  getAllItems,
  getItemsByUserId,
  getRecentActivity,
  logUserActivity,
  getAllTransactions,
  acceptTrade,
  deleteItemById,
  createDefaultAdminIfNotExists,
  createTransaction,
  verifyTransaction,
  getAvailableItems,
  calculateFinalValue,
  getEquivalenceRatio,
  createTransaction,
  deleteTradeById

};
