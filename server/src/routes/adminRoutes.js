const express = require('express');
const { protect, requireRole } = require('../middleware/auth');
const {
  dashboard,
  listBuses,
  createBus,
  updateBus,
  deleteBus,
  listRoutes,
  createRoute,
  updateRoute,
  deleteRoute
} = require('../controllers/adminController');

const router = express.Router();
router.use(protect, requireRole('admin'));
router.get('/dashboard', dashboard);
router.get('/buses', listBuses);
router.post('/buses', createBus);
router.put('/buses/:id', updateBus);
router.delete('/buses/:id', deleteBus);
router.get('/routes', listRoutes);
router.post('/routes', createRoute);
router.put('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);

module.exports = router;

