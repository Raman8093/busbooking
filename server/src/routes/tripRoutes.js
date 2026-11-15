const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const { searchTrips, getTrip, listTrips, createTrip, updateTrip, deleteTrip } = require('../controllers/tripController');

const router = express.Router();
router.get('/search', searchTrips);
router.get('/', protect, requireRole('admin'), listTrips);
router.get('/:id', getTrip);
router.post('/', protect, requireRole('admin'), createTrip);
router.put('/:id', protect, requireRole('admin'), updateTrip);
router.delete('/:id', protect, requireRole('admin'), deleteTrip);

module.exports = router;

