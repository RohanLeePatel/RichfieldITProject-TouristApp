const express = require('express');
const router = express.Router();
const travelGroupController = require('../controllers/travelGroupController');

const requireAuth = require('../middleware/authMiddleware');

router.use(requireAuth);

router.post('/groups', travelGroupController.createGroup);
router.get('/groups/me', travelGroupController.getMyGroups);
router.post('/groups/join', travelGroupController.joinGroup);

module.exports = router;

router.post('/groups', travelGroupController.createGroup);
router.get('/groups/me', travelGroupController.getMyGroups);
router.post('/groups/join', travelGroupController.joinGroup);

module.exports = router;