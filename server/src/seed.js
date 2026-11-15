require('dotenv').config();
const bcrypt = require('bcrypt');
const connectDatabase = require('./config/db');
const User = require('./models/User');
const Bus = require('./models/Bus');
const Route = require('./models/Route');
const Trip = require('./models/Trip');

async function seed() {
  await connectDatabase();

  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const customerPassword = await bcrypt.hash('Customer@123', 10);
  const admin = await User.findOneAndUpdate(
    { email: 'admin@busbooker.com' },
    { name: 'BusBooker Admin', password: adminPassword, role: 'admin' },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: 'customer@busbooker.com' },
    { name: 'Demo Customer', password: customerPassword, role: 'customer' },
    { upsert: true, new: true }
  );

  const bus = await Bus.findOneAndUpdate(
    { busNumber: 'BB-101' },
    { name: 'CityLine Express', totalSeats: 32, seatColumns: 4, amenities: ['AC', 'Wi-Fi', 'Charging'] },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const route = await Route.findOneAndUpdate(
    { source: 'Bengaluru', destination: 'Chennai' },
    { name: 'Bengaluru to Chennai', stops: ['Hosur', 'Vellore'], distanceKm: 350 },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  await Trip.findOneAndUpdate(
    { bus: bus._id, route: route._id, travelDate: tomorrow },
    { departureTime: '07:30', arrivalTime: '14:00', price: 850, status: 'scheduled' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Seed complete');
  console.log('Admin: admin@busbooker.com / Admin@123');
  console.log('Customer: customer@busbooker.com / Customer@123');
  await require('mongoose').connection.close();
  if (admin) process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

