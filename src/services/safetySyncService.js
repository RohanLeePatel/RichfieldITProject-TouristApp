const prisma = require('../config/prisma');
const axios = require('axios');

class SafetySyncService {
  async syncCountryAdvisories() {
    console.log('Starting scheduled TravelRiskAPI sync...');
    
    try {
      // 1. Fetch destinations and INCLUDE their nested country codes based on your schema
      const destinations = await prisma.destination.findMany({
        include: {
          city: {
            include: { country: true }
          }
        }
      });

      if (destinations.length === 0) {
        console.log('No destinations found in the database. Skipping sync.');
        return;
      }

      const config = {
        headers: {
          'X-API-Key': process.env.TRAVEL_RISK_API_KEY,
          'Content-Type': 'application/json'
        }
      };

      // Set to track which countries we've already synced (to avoid redundant API calls)
      const processedCountries = new Set();

      for (const dest of destinations) {
        // 2. Safely extract the ISO code through the City -> Country relation
        const isoCode = dest.city?.country?.code;
        
        // Skip if no country code is found, or if we already processed this country
        if (!isoCode || processedCountries.has(isoCode)) continue;
        
        processedCountries.add(isoCode);

        try {
          const response = await axios.get(`${process.env.TRAVEL_RISK_API_URL}/countries/${isoCode}`, config);
          const riskData = response.data; 

          // Extract using the exact keys from travelriskapi.com
          const score = riskData.risk_score || 0;
          
          // If advisory_description is null, fallback to the numerical level
          const text = riskData.advisory_description || `Level ${riskData.advisory_level} Advisory`;
          
          const alertsCount = riskData.active_alerts || 0;

          // Upsert the data into the SafetyAdvisory table
          await prisma.safetyAdvisory.upsert({
            where: { countryIso: isoCode }, 
            update: {
              compositeScore: Math.round(score), // Prisma expects an Int
              advisoryLevel: text,
              activeAlertsCount: alertsCount,
              lastUpdated: new Date()
            },
            create: {
              destinationId: dest.id,
              countryIso: isoCode,
              compositeScore: Math.round(score),
              advisoryLevel: text,
              activeAlertsCount: alertsCount,
            }
          });

          console.log(`Synced safety data for ${isoCode}`);
          
        } catch (apiError) {
          console.error(`Failed to fetch data for ${isoCode}:`, apiError.message);
        }
      }

      console.log('TravelRiskAPI sync completed successfully.');
    } catch (error) {
      console.error('Critical error during safety sync:', error.message);
    }
  }
} 

module.exports = new SafetySyncService();