const axios = require('axios');
const { parseStringPromise } = require('xml2js');

/**
 * Fetches and parses the U.S. State Department Travel Advisory RSS feed.
 * @param {string} countryName 
 */
async function fetchCountrySafetyRating(countryName) {
    try {
        const feedUrl = 'https://travel.state.gov/_res/rss/TAs.xml';

        const response = await axios.get(feedUrl, { timeout: 8000 });

        const result = await parseStringPromise(response.data);
        const items = result?.rss?.channel?.[0]?.item || [];

        const matchedItem = items.find(item => {
            const title = item?.title?.[0] || '';
            return title.toLowerCase().includes(countryName.toLowerCase());
        });

        if (matchedItem) {
            const title = matchedItem.title[0];

            let score = 1.0;
            if (title.includes('Level 4')) score = 4.0;
            else if (title.includes('Level 3')) score = 3.0;
            else if (title.includes('Level 2')) score = 2.0;
            else if (title.includes('Level 1')) score = 1.0;

            return {
                score,
                threatLevel: title,
                sourceUrl: matchedItem.link?.[0] || 'https://travel.state.gov/en/international-travel/travel-advisories.html',
            };
        }

        return {
            score: 1.0,
            threatLevel: `Level 1: Exercise Normal Precautions for ${countryName}`,
            sourceUrl: 'https://travel.state.gov/en/international-travel/travel-advisories.html',
        };

    } catch (error) {
        console.error('Failed to fetch Travel Advisory feed:', error.message);

        return {
            score: 2.0,
            threatLevel: 'Data temporarily unavailable from travel.state.gov',
            sourceUrl: 'https://travel.state.gov/en/international-travel/travel-advisories.html',
        };
    }
}

module.exports = { fetchCountrySafetyRating };
