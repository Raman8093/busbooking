const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Booking = require('../models/Booking');
const { normalizeDate } = require('../utils/booking');

async function searchTrips(req, res, next) {
  try {
    const { source, destination, date } = req.query;
    const query = { status: 'scheduled' };

    if (source || destination) {
      const routeQuery = {};
      if (source) routeQuery.source = new RegExp(`^${source.trim()}$`, 'i');
      if (destination) routeQuery.destination = new RegExp(`^${destination.trim()}$`, 'i');
      const matchingRoutes = await Route.find(routeQuery).select('_id');
      query.route = { $in: matchingRoutes.map((r) => r._id) };
    }

    if (date) {
      const start = normalizeDate(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.travelDate = { $gte: start, $lt: end };
    }

    const trips = await Trip.find(query)
      .populate('bus')
      .populate('route')
      .sort({ travelDate: 1, departureTime: 1 });

    const validTrips = trips.filter((trip) => Boolean(trip.bus && trip.route));

    res.json({
      success: true,
      trips: validTrips.map((trip) => {
        const totalSeats = trip.bus?.totalSeats || 0;
        const bookedCount = Array.isArray(trip.bookedSeats) ? trip.bookedSeats.length : 0;
        return {
          ...trip.toObject(),
          availableSeats: Math.max(0, totalSeats - bookedCount)
        };
      })
    });
  } catch (error) {
    next(error);
  }
}

async function getTrip(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.id).populate('bus').populate('route');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    const totalSeats = trip.bus?.totalSeats || 0;
    const bookedCount = Array.isArray(trip.bookedSeats) ? trip.bookedSeats.length : 0;

    res.json({
      success: true,
      trip: {
        ...trip.toObject(),
        availableSeats: Math.max(0, totalSeats - bookedCount)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function listTrips(req, res, next) {
  try {
    const trips = await Trip.find().populate('bus').populate('route').sort({ travelDate: -1 });
    res.json({ success: true, trips });
  } catch (error) {
    next(error);
  }
}

async function createTrip(req, res, next) {
  try {
    const { bus, route, travelDate, departureTime, arrivalTime, price } = req.body;
    if (!bus || !route || !travelDate || !departureTime || !arrivalTime || price === undefined) {
      return res.status(400).json({ success: false, message: 'All trip fields are required' });
    }

    const [selectedBus, selectedRoute] = await Promise.all([
      Bus.findById(bus),
      Route.findById(route)
    ]);

    if (!selectedBus) return res.status(404).json({ success: false, message: 'Bus not found' });
    if (!selectedRoute) return res.status(404).json({ success: false, message: 'Route not found' });

    const trip = await Trip.create({
      bus,
      route,
      travelDate: normalizeDate(travelDate),
      departureTime: String(departureTime).trim(),
      arrivalTime: String(arrivalTime).trim(),
      price: Number(price)
    });

    res.status(201).json({ success: true, trip: await trip.populate(['bus', 'route']) });
  } catch (error) {
    next(error);
  }
}

async function updateTrip(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

    const update = { ...req.body };
    if (update.travelDate) update.travelDate = normalizeDate(update.travelDate);

    if (update.bus) {
      const selectedBus = await Bus.findById(update.bus);
      if (!selectedBus) return res.status(404).json({ success: false, message: 'Bus not found' });
      if (trip.bookedSeats && trip.bookedSeats.length > selectedBus.totalSeats) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign bus with ${selectedBus.totalSeats} seats because ${trip.bookedSeats.length} seats are already booked`
        });
      }
    }

    if (update.route) {
      const selectedRoute = await Route.findById(update.route);
      if (!selectedRoute) return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const updatedTrip = await Trip.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate(['bus', 'route']);
    res.json({ success: true, trip: updatedTrip });
  } catch (error) {
    next(error);
  }
}

async function deleteTrip(req, res, next) {
  try {
    const hasBookings = await Booking.exists({ trip: req.params.id, status: 'CONFIRMED' });
    if (hasBookings) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trip with active customer bookings. Cancel the bookings or mark the trip as cancelled first.'
      });
    }

    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    res.json({ success: true, message: 'Trip deleted' });
  } catch (error) {
    next(error);
  }
}

module.exports = { searchTrips, getTrip, listTrips, createTrip, updateTrip, deleteTrip };

