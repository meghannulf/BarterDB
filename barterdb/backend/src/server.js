const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes'); // Ensure this path is correct

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'], // List both origins in an array
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));


 // Allow cross-origin requests (useful for frontend-backend separation)
app.use(bodyParser.json()); // Parse JSON bodies

// Define the root route ("/") to respond with something (optional)
app.get('/', (req, res) => {
  res.send('Welcome to the BarterDB API!');
});

// Use the auth routes (handles routes under /api/auth)
app.use('/api/auth', authRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
