const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const { createPnr, getRefundAmount } = require('../utils/booking');

function validatePassengers(passengers, seats) {
  if (!Array.isArray(passengers) || passengers.length === 0 || passengers.length !== seats.length) {
    return 'Passenger count must match selected seats';
  }

  const passengerSeats = passengers.map((p) => String(p.seatNumber).trim()).sort();
  const selectedSeats = [...seats].map((s) => String(s).trim()).sort();
  if (passengerSeats.join(',') !== selectedSeats.join(',')) {
    return 'Passenger seats do not match selected seats';
  }

  const validGenders = ['male', 'female', 'other'];
  for (const passenger of passengers) {
    const name = typeof passenger.name === 'string' ? passenger.name.trim() : '';
    const age = Number(passenger.age);
    const gender = typeof passenger.gender === 'string' ? passenger.gender.toLowerCase() : '';
    const phone = typeof passenger.phone === 'string' ? passenger.phone.trim() : '';

    if (!name || name.length < 2) {
      return 'Every passenger needs a valid full name (at least 2 characters)';
    }
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return 'Passenger age must be a whole number between 1 and 120';
    }
    if (!validGenders.includes(gender)) {
      return 'Passenger gender must be male, female, or other';
    }
    if (!phone || phone.length < 7) {
      return 'Every passenger needs a valid contact phone number';
    }
  }

  return null;
}

async function createBooking(req, res, next) {
  let claimedTripId;
  let claimedSeats = [];

  try {
    const { tripId, seats, passengers } = req.body;
    if (!tripId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ success: false, message: 'Trip and at least one seat are required' });
    }

    if (seats.length > 6) {
      return res.status(400).json({ success: false, message: 'You can select up to 6 seats per booking' });
    }

    const uniqueSeats = [...new Set(seats.map((s) => String(s).trim()))];
    if (uniqueSeats.length !== seats.length) {
      return res.status(400).json({ success: false, message: 'A seat cannot be selected more than once' });
    }

    // Verify trip exists and seat numbers are within bus bounds
    const existingTrip = await Trip.findById(tripId).populate('bus');
    if (!existingTrip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }
    if (existingTrip.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'This trip is not open for booking' });
    }

    const busTotalSeats = existingTrip.bus?.totalSeats || 0;
    for (const seat of uniqueSeats) {
      const seatNum = Number(seat);
      if (!Number.isInteger(seatNum) || seatNum < 1 || seatNum > busTotalSeats) {
        return res.status(400).json({
          success: false,
          message: `Seat "${seat}" is invalid for this bus (valid seats: 1 to ${busTotalSeats})`
        });
      }
    }

    const passengerError = validatePassengers(passengers, uniqueSeats);
    if (passengerError) return res.status(400).json({ success: false, message: passengerError });

    const trip = await Trip.findOneAndUpdate(
      { _id: tripId, status: 'scheduled', bookedSeats: { $nin: uniqueSeats } },
      { $addToSet: { bookedSeats: { $each: uniqueSeats } } },
      { new: true }
    ).populate('route').populate('bus');

    if (!trip) {
      return res.status(409).json({ success: false, message: 'One or more selected seats are no longer available' });
    }

    claimedTripId = trip._id;
    claimedSeats = uniqueSeats;
    const totalFare = trip.price * uniqueSeats.length;

    const formattedPassengers = passengers.map((p) => ({
      name: String(p.name).trim(),
      age: Number(p.age),
      gender: String(p.gender).toLowerCase(),
      seatNumber: String(p.seatNumber).trim(),
      phone: String(p.phone).trim()
    }));

    const booking = await Booking.create({
      user: req.user._id,
      trip: trip._id,
      pnr: createPnr(),
      passengers: formattedPassengers,
      seats: uniqueSeats,
      totalFare
    });

    res.status(201).json({ success: true, booking: await booking.populate({ path: 'trip', populate: ['bus', 'route'] }) });
  } catch (error) {
    // Release seats if creating the booking document failed after the atomic claim.
    if (claimedTripId && claimedSeats.length) {
      await Trip.findByIdAndUpdate(claimedTripId, { $pull: { bookedSeats: { $in: claimedSeats } } });
    }
    next(error);
  }
}

async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate({ path: 'trip', populate: ['bus', 'route'] }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

async function getBooking(req, res, next) {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, user: req.user._id };
    const booking = await Booking.findOne(query).populate({ path: 'trip', populate: ['bus', 'route'] }).populate('user', 'name email');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'CANCELLED') return res.status(400).json({ success: false, message: 'This booking is already cancelled' });

    const trip = await Trip.findById(booking.trip);
    if (trip) {
      await Trip.findByIdAndUpdate(trip._id, { $pull: { bookedSeats: { $in: booking.seats } } });
    }

    booking.status = 'CANCELLED';
    booking.refundStatus = 'REFUNDED';
    booking.refundAmount = getRefundAmount(booking.totalFare);
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled and refund simulated', booking });
  } catch (error) {
    next(error);
  }
}

async function listAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find().populate('user', 'name email').populate({ path: 'trip', populate: ['bus', 'route'] }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

async function getManifest(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.tripId).populate('bus').populate('route');
    if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
    const bookings = await Booking.find({ trip: trip._id, status: 'CONFIRMED' }).populate('user', 'name email');
    const passengers = bookings.flatMap((booking) => booking.passengers.map((passenger) => ({
      ...passenger.toObject(),
      pnr: booking.pnr,
      bookingId: booking._id,
      customerName: booking.user?.name
    })));

    const totalCapacity = trip.bus?.totalSeats || 0;
    const bookedCount = Array.isArray(trip.bookedSeats) ? trip.bookedSeats.length : 0;

    res.json({ success: true, trip, passengers, occupancy: { booked: bookedCount, total: totalCapacity } });
  } catch (error) {
    next(error);
  }
}

module.exports = { createBooking, getMyBookings, getBooking, cancelBooking, listAllBookings, getManifest };

