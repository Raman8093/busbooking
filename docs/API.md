# BusBooker API documentation

Base URL: `http://localhost:5000/api`

Protected routes use:

```http
Authorization: Bearer <jwt-token>
```

## Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create a customer account |
| POST | `/auth/login` | Public | Login and receive a JWT |
| GET | `/auth/me` | Authenticated | Return the current user |

Register body:

```json
{ "name": "Asha", "email": "asha@example.com", "password": "secret123" }
```

## Customer trip and booking routes

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/trips/search?source=Bengaluru&destination=Chennai&date=2026-11-15` | Public | Search scheduled trips |
| GET | `/trips/:id` | Public | Show trip, bus, route, and seat availability |
| POST | `/bookings` | Customer | Atomically claim seats and create a PNR |
| GET | `/bookings/mine` | Customer | Show the current customer's bookings |
| GET | `/bookings/:id` | Owner/Admin | Show a ticket |
| PATCH | `/bookings/:id/cancel` | Customer | Cancel and simulate a refund |

Booking body:

```json
{
  "tripId": "trip-id",
  "seats": ["1", "2"],
  "passengers": [
    { "name": "Asha", "age": 24, "gender": "female", "seatNumber": "1", "phone": "9999999999" },
    { "name": "Ravi", "age": 28, "gender": "male", "seatNumber": "2", "phone": "9999999999" }
  ]
}
```

## Admin routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/admin/dashboard` | Summary statistics and occupancy |
| GET/POST | `/admin/buses` | List or create buses |
| PUT/DELETE | `/admin/buses/:id` | Edit or delete a bus |
| GET/POST | `/admin/routes` | List or create routes |
| PUT/DELETE | `/admin/routes/:id` | Edit or delete a route |
| GET | `/trips` | List all trips |
| POST | `/trips` | Create a trip schedule |
| PUT/DELETE | `/trips/:id` | Edit or delete a trip |
| GET | `/bookings/all` | List all bookings |
| GET | `/bookings/manifest/:tripId` | Passenger manifest and occupancy |

## Common responses

Successful responses use `success: true`. Errors use an HTTP error status and this shape:

```json
{ "success": false, "message": "A readable error message" }
```

