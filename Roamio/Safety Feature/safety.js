const express = require('express');
const { getCitySafetyData } = require('../services/safety.service.js');
const prisma = require('../config/prisma.js');

const router = express.Router();

router.get('/destinations/:cityId/safety', async (req, res) => {
    try {
        const { cityId } = req.params;
        const { cityName, countryName } = req.query;

        if (!cityName || !countryName) {
            return res.status(400).json({ error: 'cityName and countryName are required query parameters' });
        }

        const safetyData = await getCitySafetyData(cityName, cityId, countryName);
        const emergencyContacts = await prisma.emergencyContacts.findMany({ where: { cityId } });

        return res.status(200).json({
            success: true,
            data: {
                ...safetyData,
                emergencyContacts
            }
        });
    } catch (error) {
        console.error('Error fetching safety data:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
