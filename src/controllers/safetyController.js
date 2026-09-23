const safetyRepository = require('../repositories/safetyRepository');

class SafetyController {
  async getDestinationSafety(req, res, next) {
    try {
      const { destinationId } = req.params;
      
      const safetyData = await safetyRepository.getByDestinationId(destinationId);

      if (!safetyData) {
        return res.status(404).json({ 
          message: 'Safety advisory data is not yet available for this destination.' 
        });
      }

      return res.status(200).json({ safety: safetyData });
    } catch (error) {
      next(error);
    }
  }

  async getCountrySafety(req, res, next) {
    try {
      const { countryIso } = req.params;

      const safetyData = await safetyRepository.getByCountryIso(countryIso);

      if (!safetyData) {
        return res.status(404).json({ 
          message: `No safety data found for country code: ${countryIso}` 
        });
      }

      return res.status(200).json({ safety: safetyData });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SafetyController();