process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Bus = require('../src/models/Bus');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');

let mongoServer;
let customerToken;
let trip;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Test Customer',
    email: 'test@example.com',
    password: 'password123'
  });
  customerToken = registerResponse.body.token;

  const bus = await Bus.create({ busNumber: 'TEST-1', name: 'Test Bus', totalSeats: 4 });
  const route = await Route.create({ name: 'Test Route', source: 'A', destination: 'B' });
  trip = await Trip.create({
    bus: bus._id,
    route: route._id,
    travelDate: new Date(),
    departureTime: '08:00',
    arrivalTime: '12:00',
    price: 500
  });
}, { timeout: 90000 });

test('health endpoint responds', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
});

test('a second booking cannot claim an already booked seat', async () => {
  const passenger = { name: 'First Passenger', age: 25, gender: 'other', seatNumber: '1', phone: '9999999999' };
  const firstResponse = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ tripId: trip._id, seats: ['1'], passengers: [passenger] });

  assert.equal(firstResponse.statusCode, 201);
  assert.match(firstResponse.body.booking.pnr, /^BB/);

  const secondResponse = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      tripId: trip._id,
      seats: ['1'],
      passengers: [{ ...passenger, name: 'Second Passenger' }]
    });

  assert.equal(secondResponse.statusCode, 409);
  assert.match(secondResponse.body.message, /no longer available/);
});

test('authentication, search, cancellation, and admin reports work', async () => {
  const loginResponse = await request(app).post('/api/auth/login').send({
    email: 'test@example.com',
    password: 'password123'
  });
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.body.user.role, 'customer');

  const forbiddenResponse = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(forbiddenResponse.statusCode, 403);

  const searchResponse = await request(app)
    .get(`/api/trips/search?source=A&destination=B&date=${new Date().toISOString().slice(0, 10)}`);
  assert.equal(searchResponse.statusCode, 200);
  assert.equal(searchResponse.body.trips.length, 1);

  const bookingsResponse = await request(app)
    .get('/api/bookings/mine')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(bookingsResponse.statusCode, 200);
  assert.equal(bookingsResponse.body.bookings.length, 1);

  const bookingId = bookingsResponse.body.bookings[0]._id;

  const adminPassword = await bcrypt.hash('admin-password', 10);
  await User.create({ name: 'Test Admin', email: 'admin@example.com', password: adminPassword, role: 'admin' });
  const adminLoginResponse = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'admin-password' });
  const adminToken = adminLoginResponse.body.token;

  // Cannot delete trip while confirmed bookings exist
  const deleteTripBlocked = await request(app)
    .delete(`/api/trips/${trip._id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleteTripBlocked.statusCode, 400);
  assert.match(deleteTripBlocked.body.message, /active customer bookings/i);

  const cancellationResponse = await request(app)
    .patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(cancellationResponse.statusCode, 200);
  assert.equal(cancellationResponse.body.booking.refundStatus, 'REFUNDED');

  const tripAfterCancellation = await Trip.findById(trip._id);
  assert.equal(tripAfterCancellation.bookedSeats.includes('1'), false);

  const dashboardResponse = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(dashboardResponse.statusCode, 200);
  assert.equal(dashboardResponse.body.stats.occupancyRate, 0);

  const manifestResponse = await request(app)
    .get(`/api/bookings/manifest/${trip._id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(manifestResponse.statusCode, 200);
  assert.equal(manifestResponse.body.passengers.length, 0);

  // Test relational integrity deletion guards
  const deleteBusBlocked = await request(app)
    .delete(`/api/admin/buses/${trip.bus}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleteBusBlocked.statusCode, 400);
  assert.match(deleteBusBlocked.body.message, /assigned to scheduled trips/i);

  const deleteRouteBlocked = await request(app)
    .delete(`/api/admin/routes/${trip.route}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleteRouteBlocked.statusCode, 400);
  assert.match(deleteRouteBlocked.body.message, /scheduled trips/i);

  // Test seat boundary validation (bus has 4 seats, seat 99 is invalid)
  const invalidSeatResponse = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      tripId: trip._id,
      seats: ['99'],
      passengers: [{ name: 'Boundary Test', age: 30, gender: 'other', seatNumber: '99', phone: '9999999999' }]
    });
  assert.equal(invalidSeatResponse.statusCode, 400);
  assert.match(invalidSeatResponse.body.message, /invalid for this bus/i);
});

test('validation, error formatting, and defensive resilience', async () => {
  // Invalid email rejection
  const invalidEmailResponse = await request(app).post('/api/auth/register').send({
    name: 'Bad Email',
    email: 'not-an-email',
    password: 'password123'
  });
  assert.equal(invalidEmailResponse.statusCode, 400);
  assert.match(invalidEmailResponse.body.message, /valid email/i);

  // Short password rejection
  const shortPassResponse = await request(app).post('/api/auth/register').send({
    name: 'Short Pass',
    email: 'valid@example.com',
    password: '123'
  });
  assert.equal(shortPassResponse.statusCode, 400);

  // CastError returns 400 Bad Request instead of 500
  const castErrorResponse = await request(app).get('/api/trips/invalid-object-id');
  assert.equal(castErrorResponse.statusCode, 400);
  assert.match(castErrorResponse.body.message, /invalid identifier format/i);

  // Search trips safely handles orphaned / missing route references without crashing
  const orphanTrip = await Trip.create({
    bus: trip.bus,
    route: new mongoose.Types.ObjectId(), // dangling reference
    travelDate: new Date(),
    departureTime: '10:00',
    arrivalTime: '15:00',
    price: 600,
    status: 'scheduled'
  });

  const searchWithOrphan = await request(app).get('/api/trips/search');
  assert.equal(searchWithOrphan.statusCode, 200);
  assert.ok(Array.isArray(searchWithOrphan.body.trips));
  // Orphan trip is safely filtered out so client doesn't crash on null route
  assert.equal(searchWithOrphan.body.trips.some((t) => t._id === orphanTrip._id.toString()), false);

  await Trip.findByIdAndDelete(orphanTrip._id);
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
}, { timeout: 60000 });

