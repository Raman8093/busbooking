const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const { createBooking, getMyBookings, getBooking, cancelBooking, listAllBookings, getManifest } = require('../controllers/bookingController');

const router = express.Router();
router.use(protect);
router.post('/', requireRole('customer'), createBooking);
router.get('/mine', requireRole('customer'), getMyBookings);
router.get('/all', requireRole('admin'), listAllBookings);
router.get('/manifest/:tripId', requireRole('admin'), getManifest);
router.get('/:id', getBooking);
router.patch('/:id/cancel', requireRole('customer'), cancelBooking);

module.exports = router;

