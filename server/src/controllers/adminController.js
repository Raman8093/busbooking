const User = require('../models/User');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');

async function dashboard(req, res, next) {
  try {
    const [customers, buses, routes, trips, bookings, revenue] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      Bus.countDocuments(),
      Route.countDocuments(),
      Trip.countDocuments(),
      Booking.countDocuments({ status: 'CONFIRMED' }),
      Booking.aggregate([{ $match: { status: 'CONFIRMED' } }, { $group: { _id: null, total: { $sum: '$totalFare' } } }])
    ]);

    const occupancy = await Trip.aggregate([
      { $lookup: { from: 'buses', localField: 'bus', foreignField: '_id', as: 'bus' } },
      { $unwind: '$bus' },
      { $group: { _id: null, booked: { $sum: { $size: '$bookedSeats' } }, capacity: { $sum: '$bus.totalSeats' } } }
    ]);

    res.json({
      success: true,
      stats: {
        customers,
        buses,
        routes,
        trips,
        confirmedBookings: bookings,
        revenue: revenue[0]?.total || 0,
        occupancyRate: occupancy[0]?.capacity ? Math.round((occupancy[0].booked / occupancy[0].capacity) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
}

async function listBuses(req, res, next) {
  try { res.json({ success: true, buses: await Bus.find().sort({ createdAt: -1 }) }); } catch (error) { next(error); }
}
async function createBus(req, res, next) {
  try {
    const { busNumber, name, totalSeats, seatColumns, amenities, status } = req.body;
    if (!busNumber || !name || totalSeats === undefined) {
      return res.status(400).json({ success: false, message: 'Bus number, name, and total seats are required' });
    }
    const bus = await Bus.create({
      busNumber: String(busNumber).trim(),
      name: String(name).trim(),
      totalSeats: Number(totalSeats),
      seatColumns: seatColumns ? Number(seatColumns) : 4,
      amenities: Array.isArray(amenities) ? amenities : [],
      status: status || 'active'
    });
    res.status(201).json({ success: true, bus });
  } catch (error) {
    next(error);
  }
}

async function updateBus(req, res, next) {
  try {
    const update = {};
    if (req.body.busNumber !== undefined) update.busNumber = String(req.body.busNumber).trim();
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.totalSeats !== undefined) update.totalSeats = Number(req.body.totalSeats);
    if (req.body.seatColumns !== undefined) update.seatColumns = Number(req.body.seatColumns);
    if (req.body.amenities !== undefined) update.amenities = Array.isArray(req.body.amenities) ? req.body.amenities : [];
    if (req.body.status !== undefined) update.status = req.body.status;

    const bus = await Bus.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    res.json({ success: true, bus });
  } catch (error) {
    next(error);
  }
}

async function deleteBus(req, res, next) {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    const activeTrip = await Trip.findOne({ bus: req.params.id, status: 'scheduled' });
    if (activeTrip) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete bus assigned to scheduled trips. Update or cancel those trips first.'
      });
    }

    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Bus deleted' });
  } catch (error) {
    next(error);
  }
}

async function listRoutes(req, res, next) {
  try { res.json({ success: true, routes: await Route.find().sort({ createdAt: -1 }) }); } catch (error) { next(error); }
}

async function createRoute(req, res, next) {
  try {
    const { name, source, destination, stops, distanceKm } = req.body;
    if (!name || !source || !destination) {
      return res.status(400).json({ success: false, message: 'Route name, source, and destination are required' });
    }
    const route = await Route.create({
      name: String(name).trim(),
      source: String(source).trim(),
      destination: String(destination).trim(),
      stops: Array.isArray(stops) ? stops : [],
      distanceKm: distanceKm !== undefined ? Number(distanceKm) : 0
    });
    res.status(201).json({ success: true, route });
  } catch (error) {
    next(error);
  }
}

async function updateRoute(req, res, next) {
  try {
    const update = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body.source !== undefined) update.source = String(req.body.source).trim();
    if (req.body.destination !== undefined) update.destination = String(req.body.destination).trim();
    if (req.body.stops !== undefined) update.stops = Array.isArray(req.body.stops) ? req.body.stops : [];
    if (req.body.distanceKm !== undefined) update.distanceKm = Number(req.body.distanceKm);

    const route = await Route.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, route });
  } catch (error) {
    next(error);
  }
}

async function deleteRoute(req, res, next) {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    const activeTrip = await Trip.findOne({ route: req.params.id, status: 'scheduled' });
    if (activeTrip) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete route used in scheduled trips. Update or cancel those trips first.'
      });
    }

    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Route deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  dashboard,
  listBuses,
  createBus,
  updateBus,
  deleteBus,
  listRoutes,
  createRoute,
  updateRoute,
  deleteRoute
};

