const express = require('express');
const router = express.Router();
const { addBarterRequest, getAllBarterRequests } = require('../database');
const { findBarterMatch } = require('../barter/barterMatch');

router.post('/', async (req, res) => {
    const { userId, item, exchangeFor, quantity } = req.body;
    if (!userId || !item || !exchangeFor || !quantity) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const match = await findBarterMatch(userId, item, exchangeFor);
        if (match) return res.json({ message: 'Barter match found!', match });

        const requestId = await addBarterRequest(userId, item, exchangeFor, quantity);
        res.status(201).json({ message: 'Barter request posted', requestId });
    } catch (error) {
        res.status(500).json({ message: 'Error processing barter', error: error.message });
    }
});

module.exports = router;
