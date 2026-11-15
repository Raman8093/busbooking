const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    totalSeats: { type: Number, required: true, min: 1, max: 80 },
    seatColumns: { type: Number, default: 4, min: 2, max: 5 },
    amenities: [{ type: String, trim: true }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bus', busSchema);

