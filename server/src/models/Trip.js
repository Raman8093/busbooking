const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    travelDate: { type: Date, required: true },
    departureTime: { type: String, required: true },
    arrivalTime: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
    bookedSeats: { type: [String], default: [] }
  },
  { timestamps: true }
);

tripSchema.index({ route: 1, travelDate: 1 });

module.exports = mongoose.model('Trip', tripSchema);

