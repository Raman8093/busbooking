# Bus Booking Management System

A simple, full-stack bus booking application built for a web development internship assessment.

## Technology

- React.js and CSS with Vite
- Node.js and Express.js
- MongoDB with Mongoose
- JWT authentication and bcrypt password hashing
- Lucide React icons

## Features

### Customer

- Register and log in
- Search trips by source, destination, and date
- View bus details and real-time seat availability
- Select seats and enter passenger details
- Confirm bookings with a unique PNR
- View tickets and booking history
- Cancel tickets with a configurable simulated refund

### Admin

- Dashboard statistics and occupancy rate
- Add, edit, and delete buses
- Add, edit, and delete routes
- Create, edit, and delete trip schedules
- View all bookings
- View passenger manifests for a trip

## Requirements

- Node.js 18 or newer
- A running MongoDB instance, local or hosted

## Setup

From the project root in PowerShell, use `npm.cmd` if PowerShell blocks `npm.ps1`:

```bash
npm.cmd run install-all
```

Copy `server/.env.example` to `server/.env` and update the MongoDB connection string if required:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/busbooking
JWT_SECRET=use_a_long_random_secret_here
CANCELLATION_REFUND_PERCENT=80
```

Seed demo data:

```bash
npm.cmd run seed --prefix server
```

Start the backend in one terminal:

```bash
npm.cmd run dev:server
```

Start the frontend in another terminal:

```bash
npm.cmd run dev:client
```

Open `http://localhost:5173` in a browser. The backend runs on `http://localhost:5000`.

## Demo accounts

Run the seed command first.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@busbooker.com | Admin@123 |
| Customer | customer@busbooker.com | Customer@123 |

The seed creates a Bengaluru → Chennai trip for tomorrow.

## Testing

The API tests use an in-memory MongoDB server and cover health, registration/login, role authorization, trip search, PNR creation, duplicate-seat prevention, cancellation, refund status, and admin occupancy/manifest reporting.

```bash
npm.cmd test --prefix server
npm.cmd run build --prefix client
```

## Project structure

```text
busbooking/
├── client/
│   └── src/
│       ├── api.js
│       ├── App.jsx
│       └── styles.css
├── server/
│   ├── src/
│   │   ├── config/          # MongoDB connection
│   │   ├── controllers/     # Request/business logic
│   │   ├── middleware/      # JWT and error handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # REST endpoints
│   │   └── seed.js
│   └── test/
└── docs/
```

## Booking integrity

The server claims seats with an atomic `findOneAndUpdate` that only matches when every requested seat is still absent from `Trip.bookedSeats`. This prevents two concurrent customers from successfully booking the same seat. Cancellation removes the seats from the trip and records a simulated refund on the booking.

See [docs/API.md](docs/API.md) for endpoints and [docs/ER-DIAGRAM.md](docs/ER-DIAGRAM.md) for the database relationships.

