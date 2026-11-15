const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    seatNumber: { type: String, required: true },
    phone: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    pnr: { type: String, required: true, unique: true, index: true },
    passengers: { type: [passengerSchema], required: true },
    seats: { type: [String], required: true },
    totalFare: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['CONFIRMED', 'CANCELLED'], default: 'CONFIRMED' },
    refundStatus: { type: String, enum: ['NONE', 'PENDING', 'REFUNDED'], default: 'NONE' },
    refundAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

bookingSchema.index({ trip: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

