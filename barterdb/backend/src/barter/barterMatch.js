const db_2 = require('../database');  // Your existing database connection

const findBarterMatch = async (userId, itemName, exchangeFor) => {
    try {
        // Get all barter requests
        const requests = await db_2.getAllBarterRequests(); 

        for (let request of requests) {
            if (request.item === exchangeFor && request.exchangeFor === itemName) {
                return request;  // Match found
            }
        }
        return null;  // No match found
    } catch (error) {
        console.error("Error finding match:", error);
        throw error;
    }
};

module.exports = { findBarterMatch };
