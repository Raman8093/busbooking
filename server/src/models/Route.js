const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    stops: [{ type: String, trim: true }],
    distanceKm: { type: Number, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);

