const express = require('express');
const router = express.Router();
const travelGroupController = require('../controllers/travelGroup.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.post('/groups', travelGroupController.createGroup);
router.get('/groups/me', travelGroupController.getMyGroups);
router.post('/groups/join', travelGroupController.joinGroup);

module.exports = router;