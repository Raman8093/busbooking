# BusBooker database relationships

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    BUS ||--o{ TRIP : operates
    ROUTE ||--o{ TRIP : schedules
    TRIP ||--o{ BOOKING : receives

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password
        string role
    }

    BUS {
        ObjectId _id PK
        string busNumber UK
        string name
        number totalSeats
        string[] amenities
        string status
    }

    ROUTE {
        ObjectId _id PK
        string name
        string source
        string destination
        string[] stops
        number distanceKm
    }

    TRIP {
        ObjectId _id PK
        ObjectId bus FK
        ObjectId route FK
        date travelDate
        string departureTime
        string arrivalTime
        number price
        string[] bookedSeats
        string status
    }

    BOOKING {
        ObjectId _id PK
        ObjectId user FK
        ObjectId trip FK
        string pnr UK
        string[] seats
        Passenger[] passengers
        number totalFare
        string status
        string refundStatus
        number refundAmount
    }
```

`Trip.bookedSeats` is the current seat-availability source. A booking request atomically adds seats only when none of its requested seats are already present. Confirmed bookings are used for manifests and reporting; cancelled bookings remain as history but no longer occupy seats.

