import { useEffect, useState } from 'react';
import {
  ArrowRight, BusFront, CalendarDays, Check, ChevronLeft, Download, LayoutDashboard,
  LogIn, LogOut, MapPin, Menu, Plus, Search, ShieldCheck, Ticket, Trash2, Users, X
} from 'lucide-react';
import { apiRequest, clearSession, getSavedUser, saveSession } from './api';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const defaultDate = tomorrow.toISOString().slice(0, 10);
const initialSearch = { source: 'Bengaluru', destination: 'Chennai', date: defaultDate };

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatCurrency(value) { return `₹${Number(value || 0).toLocaleString('en-IN')}`; }
function showError(error, setNotice) { setNotice({ type: 'error', text: error.message || 'Something went wrong' }); }

function App() {
  const [user, setUser] = useState(getSavedUser());
  const [page, setPage] = useState('home');
  const [authMode, setAuthMode] = useState('login');
  const [search, setSearch] = useState(initialSearch);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [booking, setBooking] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleUnauthorized(event) {
      setUser(null);
      setPage('auth');
      setNotice({ type: 'error', text: event.detail || 'Session expired. Please log in again.' });
    }
    window.addEventListener('busbooker:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('busbooker:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  function goTo(nextPage) { setPage(nextPage); setMobileMenuOpen(false); setNotice(null); }
  function handleLogout() { clearSession(); setUser(null); setPage('home'); setMobileMenuOpen(false); }

  async function handleSearch(event) {
    event.preventDefault(); setLoading(true); setNotice(null);
    try {
      const data = await apiRequest(`/trips/search?${new URLSearchParams(search)}`);
      setTrips(data.trips || []);
      setPage('results');
    } catch (error) {
      showError(error, setNotice);
    } finally {
      setLoading(false);
    }
  }

  async function openTrip(trip) {
    if (!trip || !trip._id) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/trips/${trip._id}`);
      setSelectedTrip(data.trip);
      setSelectedSeats([]);
      setPassengers([]);
      setPage('trip');
    } catch (error) {
      showError(error, setNotice);
    } finally {
      setLoading(false);
    }
  }

  function handleSeatToggle(seatNumber) {
    if (selectedSeats.includes(seatNumber)) {
      const nextSeats = selectedSeats.filter((seat) => seat !== seatNumber);
      setSelectedSeats(nextSeats);
      setPassengers(passengers.filter((passenger) => nextSeats.includes(passenger.seatNumber)));
      return;
    }
    if (selectedSeats.length >= 6) {
      setNotice({ type: 'error', text: 'You can select up to 6 seats per booking' });
      return;
    }
    const nextSeats = [...selectedSeats, seatNumber];
    setSelectedSeats(nextSeats);
    setPassengers([...passengers, { seatNumber, name: '', age: '', gender: 'other', phone: '' }]);
  }

  function updatePassenger(seatNumber, field, value) {
    setPassengers(passengers.map((passenger) => passenger.seatNumber === seatNumber ? { ...passenger, [field]: value } : passenger));
  }

  async function confirmBooking(event) {
    if (event) event.preventDefault();
    if (!user) {
      setAuthMode('login');
      setPage('auth');
      setNotice({ type: 'error', text: 'Please log in before confirming your booking' });
      return;
    }
    if (user.role === 'admin') {
      setNotice({ type: 'error', text: 'Administrator accounts cannot book tickets. Please use a customer account.' });
      return;
    }
    if (selectedSeats.length === 0) {
      setNotice({ type: 'error', text: 'Please select at least one seat to continue.' });
      return;
    }

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.name?.trim() || !p.phone?.trim() || !p.age) {
        setNotice({ type: 'error', text: `Please fill in all details for Passenger ${i + 1} (Seat ${p.seatNumber})` });
        return;
      }
      const ageNum = Number(p.age);
      if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
        setNotice({ type: 'error', text: `Age for Passenger ${i + 1} (Seat ${p.seatNumber}) must be between 1 and 120` });
        return;
      }
    }

    setLoading(true);
    try {
      const data = await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({ tripId: selectedTrip._id, seats: selectedSeats, passengers })
      });
      setBooking(data.booking);
      setPage('success');
    } catch (error) {
      showError(error, setNotice);
      if (error.message.includes('no longer available')) openTrip(selectedTrip);
    } finally {
      setLoading(false);
    }
  }

  async function openBooking(bookingId) {
    setLoading(true);
    try {
      const data = await apiRequest(`/bookings/${bookingId}`);
      setSelectedBooking(data.booking);
      setPage('ticket');
    } catch (error) {
      showError(error, setNotice);
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId) {
    if (!window.confirm('Cancel this booking? An 80% simulated refund will be recorded.')) return null;
    setLoading(true);
    try {
      const res = await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'PATCH' });
      setNotice({ type: 'success', text: 'Booking cancelled. Refund status is now REFUNDED.' });
      if (page === 'ticket' && res.booking) setSelectedBooking(res.booking);
      return res.booking;
    } catch (error) {
      showError(error, setNotice);
      return null;
    } finally {
      setLoading(false);
    }
  }

  const content = user?.role === 'admin' && page.startsWith('admin')
    ? <AdminPage setNotice={setNotice} notice={notice} />
    : <>
      {page === 'home' && <HomePage search={search} setSearch={setSearch} onSearch={handleSearch} loading={loading} />}
      {page === 'auth' && <AuthPage mode={authMode} setMode={setAuthMode} setUser={setUser} goTo={goTo} setNotice={setNotice} />}
      {page === 'results' && <ResultsPage trips={trips} search={search} onBack={() => goTo('home')} openTrip={openTrip} loading={loading} />}
      {page === 'trip' && <TripPage trip={selectedTrip} selectedSeats={selectedSeats} handleSeatToggle={handleSeatToggle} passengers={passengers} updatePassenger={updatePassenger} confirmBooking={confirmBooking} onBack={() => goTo('results')} loading={loading} user={user} />}
      {page === 'success' && <SuccessPage booking={booking} openBooking={openBooking} goHome={() => goTo('home')} />}
      {page === 'bookings' && <BookingsPage openBooking={openBooking} cancelBooking={cancelBooking} setNotice={setNotice} />}
      {page === 'ticket' && <TicketPage booking={selectedBooking} onBack={() => goTo('bookings')} cancelBooking={cancelBooking} />}
    </>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => goTo('home')}>
          <span className="brand-icon"><BusFront size={21} /></span>
          <span>BusBooker</span>
        </button>
        <button className="menu-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation">
          <Menu size={21} />
        </button>
        <nav className={`main-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <button onClick={() => goTo('home')}>Search buses</button>
          {user?.role === 'customer' && <button onClick={() => goTo('bookings')}>My bookings</button>}
          {user?.role === 'admin' && <button onClick={() => goTo('admin-dashboard')}>Admin dashboard</button>}
          {user ? (
            <button className="nav-account" onClick={handleLogout}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <button className="nav-account" onClick={() => goTo('auth')}>
              <LogIn size={16} /> Log in
            </button>
          )}
        </nav>
      </header>
      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
      <main>{content}</main>
      <footer className="footer">
        <span>© 2026 BusBooker</span>
        <span>Simple, safe, comfortable journeys.</span>
      </footer>
    </div>
  );
}

function Notice({ notice, onClose }) {
  return (
    <div className={`notice ${notice.type}`}>
      <span>{notice.text}</span>
      <button onClick={onClose} aria-label="Dismiss notice"><X size={16} /></button>
    </div>
  );
}

function HomePage({ search, setSearch, onSearch, loading }) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">Travel made uncomplicated</p>
        <h1>Every journey deserves a better beginning.</h1>
        <p className="hero-text">Find dependable buses, choose your seat, and book your next trip in a few simple steps.</p>
      </div>
      <SearchForm search={search} setSearch={setSearch} onSearch={onSearch} loading={loading} />
      <div className="trust-row">
        <span><ShieldCheck size={18} /> Secure booking</span>
        <span><Ticket size={18} /> Instant PNR</span>
        <span><Users size={18} /> Easy cancellation</span>
      </div>
    </section>
  );
}

function SearchForm({ search, setSearch, onSearch, loading }) {
  function update(field, value) { setSearch({ ...search, [field]: value }); }
  return (
    <form className="search-card" onSubmit={onSearch}>
      <div className="form-field">
        <label><MapPin size={15} /> From</label>
        <input required value={search.source} onChange={(event) => update('source', event.target.value)} placeholder="e.g. Bengaluru" />
      </div>
      <div className="route-arrow"><ArrowRight size={18} /></div>
      <div className="form-field">
        <label><MapPin size={15} /> To</label>
        <input required value={search.destination} onChange={(event) => update('destination', event.target.value)} placeholder="e.g. Chennai" />
      </div>
      <div className="form-field">
        <label><CalendarDays size={15} /> Travel date</label>
        <input required type="date" value={search.date} onChange={(event) => update('date', event.target.value)} />
      </div>
      <button className="primary-button search-button" disabled={loading}>
        <Search size={18} /> {loading ? 'Searching...' : 'Search buses'}
      </button>
    </form>
  );
}

function AuthPage({ mode, setMode, setUser, goTo, setNotice }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      saveSession(data);
      setUser(data.user);
      goTo(data.user.role === 'admin' ? 'admin-dashboard' : 'home');
    } catch (error) {
      showError(error, setNotice);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-intro">
        <span className="welcome-mark"><BusFront size={32} /></span>
        <p className="eyebrow">Welcome to BusBooker</p>
        <h1>Travel confidently, from start to finish.</h1>
        <p>Log in to manage your trips or create an account to book your first seat.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {mode === 'register' && (
          <div className="form-field">
            <label>Full name</label>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
          </div>
        )}
        <div className="form-field">
          <label>Email address</label>
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" />
        </div>
        <div className="form-field">
          <label>Password</label>
          <input required minLength="6" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" />
        </div>
        <button className="primary-button full-button" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="demo-hint">
          Demo customer: customer@busbooker.com / Customer@123<br />
          Demo admin: admin@busbooker.com / Admin@123
        </p>
      </form>
    </section>
  );
}

function ResultsPage({ trips, search, onBack, openTrip, loading }) {
  return (
    <section className="content-section">
      <button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Change search</button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Available buses</p>
          <h1>{search.source} to {search.destination}</h1>
          <p>{formatDate(search.date)} · {trips.length} {trips.length === 1 ? 'bus' : 'buses'} found</p>
        </div>
        <div className="result-filter">Direct schedules</div>
      </div>
      {loading ? <Loading /> : trips.length === 0 ? (
        <EmptyState title="No buses found" text="Try another route or travel date." />
      ) : (
        <div className="trip-list">
          {trips.map((trip) => <TripCard key={trip._id} trip={trip} openTrip={openTrip} />)}
        </div>
      )}
    </section>
  );
}

function TripCard({ trip, openTrip }) {
  const busName = trip.bus?.name || 'Standard Bus';
  const busNumber = trip.bus?.busNumber || 'BB-Express';
  const amenities = trip.bus?.amenities?.length ? trip.bus.amenities.slice(0, 2).join(' · ') : 'Comfortable travel';
  const source = trip.route?.source || 'Origin';
  const destination = trip.route?.destination || 'Destination';
  const availableSeats = trip.availableSeats ?? Math.max(0, (trip.bus?.totalSeats || 0) - (trip.bookedSeats?.length || 0));

  return (
    <article className="trip-card">
      <div className="trip-main">
        <div className="operator-mark"><BusFront size={22} /></div>
        <div>
          <h3>{busName}</h3>
          <p>{busNumber} · {amenities}</p>
        </div>
      </div>
      <div className="time-block">
        <strong>{trip.departureTime || '08:00'}</strong>
        <span>{source}</span>
      </div>
      <div className="duration">
        <span></span>
        <small>journey</small>
      </div>
      <div className="time-block">
        <strong>{trip.arrivalTime || '14:00'}</strong>
        <span>{destination}</span>
      </div>
      <div className="trip-price">
        <small>{availableSeats} seats left</small>
        <strong>{formatCurrency(trip.price)}</strong>
        <button className="outline-button" onClick={() => openTrip(trip)}>
          View seats <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function TripPage({ trip, selectedSeats, handleSeatToggle, passengers, updatePassenger, confirmBooking, onBack, loading, user }) {
  if (!trip) return null;

  const totalSeats = trip.bus?.totalSeats || 32;
  const seats = Array.from({ length: totalSeats }, (_, index) => String(index + 1));
  const bookedSeats = Array.isArray(trip.bookedSeats) ? trip.bookedSeats : [];
  const busName = trip.bus?.name || 'Bus';
  const source = trip.route?.source || 'Origin';
  const destination = trip.route?.destination || 'Destination';
  const travelDateText = trip.travelDate ? formatDate(trip.travelDate) : 'Upcoming date';
  const isAdmin = user?.role === 'admin';

  return (
    <section className="content-section">
      <button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Back to results</button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Choose your seats</p>
          <h1>{busName}</h1>
          <p>{source} → {destination} · {travelDateText}</p>
        </div>
        <div className="fare-summary">From <strong>{formatCurrency(trip.price)}</strong> per seat</div>
      </div>
      <div className="booking-grid">
        <div className="seat-card">
          <div className="seat-card-head">
            <div>
              <h2>Seat layout</h2>
              <p>Tap available seats to select them (up to 6 seats).</p>
            </div>
            <span className="driver-label">Driver</span>
          </div>
          <div className="seat-legend">
            <span><i className="seat available"></i> Available</span>
            <span><i className="seat selected"></i> Selected</span>
            <span><i className="seat booked"></i> Booked</span>
          </div>
          <div className="bus-layout">
            <div className="driver-line">Front of bus</div>
            <div className="seat-grid">
              {seats.map((seat) => {
                const isBooked = bookedSeats.includes(seat);
                const isSelected = selectedSeats.includes(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={isBooked}
                    className={`seat ${isSelected ? 'selected' : isBooked ? 'booked' : 'available'}`}
                    onClick={() => handleSeatToggle(seat)}
                    aria-label={`Seat ${seat} ${isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}`}
                  >
                    {seat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="passenger-card">
          <h2>Passenger details</h2>
          {selectedSeats.length === 0 ? (
            <div className="inline-empty">
              <Ticket size={24} />
              <p>Select at least one seat to continue.</p>
            </div>
          ) : (
            <form onSubmit={confirmBooking}>
              {!user && (
                <div className="login-callout">You will be asked to log in before booking.</div>
              )}
              {isAdmin && (
                <div className="login-callout">
                  Administrator account detected. Admins cannot create passenger bookings. Please sign in as a customer.
                </div>
              )}
              {passengers.map((passenger, index) => (
                <div className="passenger-form" key={passenger.seatNumber}>
                  <div className="passenger-title">
                    <span>Passenger {index + 1}</span>
                    <b>Seat {passenger.seatNumber}</b>
                  </div>
                  <div className="two-fields">
                    <input
                      required
                      placeholder="Full name"
                      value={passenger.name}
                      onChange={(event) => updatePassenger(passenger.seatNumber, 'name', event.target.value)}
                    />
                    <input
                      required
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Age"
                      value={passenger.age}
                      onChange={(event) => updatePassenger(passenger.seatNumber, 'age', event.target.value)}
                    />
                  </div>
                  <div className="two-fields">
                    <select
                      value={passenger.gender}
                      onChange={(event) => updatePassenger(passenger.seatNumber, 'gender', event.target.value)}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      required
                      type="tel"
                      placeholder="Phone number"
                      value={passenger.phone}
                      onChange={(event) => updatePassenger(passenger.seatNumber, 'phone', event.target.value)}
                    />
                  </div>
                </div>
              ))}
              <div className="booking-total">
                <span>Total fare</span>
                <strong>{formatCurrency(trip.price * selectedSeats.length)}</strong>
              </div>
              <button
                type="submit"
                className="primary-button full-button"
                disabled={loading || isAdmin}
              >
                {loading ? 'Confirming...' : 'Confirm booking'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function SuccessPage({ booking, openBooking, goHome }) {
  return (
    <section className="success-page">
      <div className="success-icon"><Check size={34} /></div>
      <p className="eyebrow">Booking confirmed</p>
      <h1>Your seat is reserved.</h1>
      <p>We have created your digital ticket. Keep your PNR handy for the journey.</p>
      <div className="pnr-card">
        <span>PNR number</span>
        <strong>{booking?.pnr || 'N/A'}</strong>
      </div>
      <div className="success-actions">
        <button className="primary-button" onClick={() => openBooking(booking?._id)}>
          View ticket <ArrowRight size={17} />
        </button>
        <button className="outline-button" onClick={goHome}>Book another trip</button>
      </div>
    </section>
  );
}

function BookingsPage({ openBooking, cancelBooking, setNotice }) {
  const [bookings, setBookings] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/bookings/mine')
      .then((data) => {
        if (active) setBookings(data.bookings || []);
      })
      .catch((error) => {
        if (active) showError(error, setNotice);
      })
      .finally(() => {
        if (active) setPageLoading(false);
      });
    return () => { active = false; };
  }, [setNotice]);

  async function handleCancel(bookingId) {
    const updated = await cancelBooking(bookingId);
    if (updated) {
      setBookings((prev) => prev.map((b) => (b._id === bookingId ? { ...b, ...updated } : b)));
    }
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your travel history</p>
          <h1>My bookings</h1>
          <p>All your tickets and refund updates in one place.</p>
        </div>
      </div>

      {pageLoading ? (
        <Loading />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings yet" text="Your confirmed tickets will appear here." />
      ) : (
        <div className="booking-list">
          {bookings.map((item) => {
            const routeText = item.trip?.route
              ? `${item.trip.route.source} → ${item.trip.route.destination}`
              : 'Route details unavailable';
            const travelDateText = item.trip?.travelDate ? formatDate(item.trip.travelDate) : 'Date unavailable';
            const seatList = Array.isArray(item.seats) ? item.seats.join(', ') : 'N/A';

            return (
              <article className="booking-row" key={item._id}>
                <div className="booking-icon"><BusFront size={21} /></div>
                <div className="booking-route">
                  <strong>{routeText}</strong>
                  <span>{travelDateText} · Seats: {seatList}</span>
                </div>
                <div className="booking-pnr">
                  <span>PNR</span>
                  <strong>{item.pnr}</strong>
                </div>
                <div className="booking-status">
                  <span className={`status-pill ${item.status?.toLowerCase() || 'confirmed'}`}>{item.status}</span>
                  <small>
                    {item.status === 'CANCELLED'
                      ? `Refund: ${formatCurrency(item.refundAmount)}`
                      : formatCurrency(item.totalFare)}
                  </small>
                </div>
                <div className="row-actions">
                  <button className="icon-text-button" onClick={() => openBooking(item._id)}>View</button>
                  {item.status === 'CONFIRMED' && (
                    <button className="danger-text" onClick={() => handleCancel(item._id)}>Cancel</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TicketPage({ booking, onBack, cancelBooking }) {
  if (!booking) return null;

  const trip = booking.trip;
  const routeSource = trip?.route?.source || 'Origin';
  const routeDest = trip?.route?.destination || 'Destination';
  const travelDateText = trip?.travelDate ? formatDate(trip.travelDate) : 'Date unavailable';
  const busName = trip?.bus?.name || 'Bus';
  const departureTime = trip?.departureTime || 'N/A';

  return (
    <section className="content-section ticket-section">
      <button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Back to bookings</button>
      <div className="ticket-actions">
        <button className="outline-button" onClick={() => window.print()}>
          <Download size={16} /> Print ticket
        </button>
        {booking.status === 'CONFIRMED' && (
          <button className="danger-button" onClick={() => cancelBooking(booking._id)}>
            Cancel booking
          </button>
        )}
      </div>
      <article className="ticket-card">
        <div className="ticket-header">
          <div>
            <p className="eyebrow">BusBooker e-ticket</p>
            <h1>{routeSource} <span>→</span> {routeDest}</h1>
          </div>
          <div className="ticket-pnr">
            <span>PNR</span>
            <strong>{booking.pnr}</strong>
          </div>
        </div>
        <div className="ticket-info-grid">
          <div>
            <span>Travel date</span>
            <strong>{travelDateText}</strong>
          </div>
          <div>
            <span>Departure</span>
            <strong>{departureTime}</strong>
          </div>
          <div>
            <span>Bus</span>
            <strong>{busName}</strong>
          </div>
          <div>
            <span>Fare</span>
            <strong>{formatCurrency(booking.totalFare)}</strong>
          </div>
        </div>
        <div className="ticket-passengers">
          <h2>Passenger details</h2>
          {booking.passengers?.map((passenger) => (
            <div className="ticket-passenger" key={passenger.seatNumber}>
              <span className="seat-badge">{passenger.seatNumber}</span>
              <div>
                <strong>{passenger.name}</strong>
                <small>{passenger.age} years · {passenger.gender} · {passenger.phone}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="ticket-footer">
          <span className={`status-pill ${booking.status?.toLowerCase() || 'confirmed'}`}>{booking.status}</span>
          {booking.status === 'CANCELLED' && (
            <span className="refund-label">Refund {booking.refundStatus}: {formatCurrency(booking.refundAmount)}</span>
          )}
        </div>
      </article>
    </section>
  );
}

function AdminPage({ setNotice, notice }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(false);

  const initialBusForm = { busNumber: '', name: '', totalSeats: 32, amenities: 'AC, Wi-Fi' };
  const initialRouteForm = { name: '', source: '', destination: '', stops: '', distanceKm: '' };
  const initialTripForm = { bus: '', route: '', travelDate: defaultDate, departureTime: '08:00', arrivalTime: '14:00', price: 500 };

  const [busForm, setBusForm] = useState(initialBusForm);
  const [routeForm, setRouteForm] = useState(initialRouteForm);
  const [tripForm, setTripForm] = useState(initialTripForm);
  const [editing, setEditing] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [dashboard, busData, routeData, tripData, bookingData] = await Promise.all([
        apiRequest('/admin/dashboard'),
        apiRequest('/admin/buses'),
        apiRequest('/admin/routes'),
        apiRequest('/trips'),
        apiRequest('/bookings/all')
      ]);
      setStats(dashboard.stats);
      setBuses(busData.buses || []);
      setRoutes(routeData.routes || []);
      setTrips(tripData.trips || []);
      setBookings(bookingData.bookings || []);

      if (!tripForm.bus && busData.buses?.[0]) {
        setTripForm((current) => ({ ...current, bus: busData.buses[0]._id }));
      }
      if (!tripForm.route && routeData.routes?.[0]) {
        setTripForm((current) => ({ ...current, route: routeData.routes[0]._id }));
      }
    } catch (error) {
      showError(error, setNotice);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function cancelEditing() {
    setEditing(null);
    setBusForm(initialBusForm);
    setRouteForm(initialRouteForm);
    setTripForm((current) => ({
      ...initialTripForm,
      bus: buses[0]?._id || current.bus,
      route: routes[0]?._id || current.route
    }));
  }

  async function saveBus(event) {
    event.preventDefault();
    try {
      const amenitiesArray = Array.isArray(busForm.amenities)
        ? busForm.amenities
        : String(busForm.amenities || '').split(',').map((item) => item.trim()).filter(Boolean);

      const body = {
        busNumber: busForm.busNumber,
        name: busForm.name,
        totalSeats: Number(busForm.totalSeats),
        amenities: amenitiesArray
      };

      await apiRequest(editing?.type === 'bus' ? `/admin/buses/${editing.id}` : '/admin/buses', {
        method: editing?.type === 'bus' ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      setBusForm(initialBusForm);
      setEditing(null);
      setNotice({ type: 'success', text: 'Bus saved successfully' });
      loadData();
    } catch (error) {
      showError(error, setNotice);
    }
  }

  async function saveRoute(event) {
    event.preventDefault();
    try {
      const stopsArray = Array.isArray(routeForm.stops)
        ? routeForm.stops
        : String(routeForm.stops || '').split(',').map((item) => item.trim()).filter(Boolean);

      const body = {
        name: routeForm.name,
        source: routeForm.source,
        destination: routeForm.destination,
        stops: stopsArray,
        distanceKm: Number(routeForm.distanceKm || 0)
      };

      await apiRequest(editing?.type === 'route' ? `/admin/routes/${editing.id}` : '/admin/routes', {
        method: editing?.type === 'route' ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      setRouteForm(initialRouteForm);
      setEditing(null);
      setNotice({ type: 'success', text: 'Route saved successfully' });
      loadData();
    } catch (error) {
      showError(error, setNotice);
    }
  }

  async function saveTrip(event) {
    event.preventDefault();
    try {
      await apiRequest(editing?.type === 'trip' ? `/trips/${editing.id}` : '/trips', {
        method: editing?.type === 'trip' ? 'PUT' : 'POST',
        body: JSON.stringify({ ...tripForm, price: Number(tripForm.price) })
      });
      setEditing(null);
      setTripForm((current) => ({
        ...initialTripForm,
        bus: current.bus,
        route: current.route
      }));
      setNotice({ type: 'success', text: 'Trip schedule saved successfully' });
      loadData();
    } catch (error) {
      showError(error, setNotice);
    }
  }

  async function remove(path, message, itemType) {
    if (!window.confirm(`Are you sure you want to delete this ${itemType || 'record'}?`)) return;
    try {
      await apiRequest(path, { method: 'DELETE' });
      setNotice({ type: 'success', text: message });
      loadData();
    } catch (error) {
      showError(error, setNotice);
    }
  }

  function editBus(bus) {
    setBusForm({
      busNumber: bus.busNumber || '',
      name: bus.name || '',
      totalSeats: bus.totalSeats || 32,
      amenities: Array.isArray(bus.amenities) ? bus.amenities.join(', ') : (bus.amenities || '')
    });
    setEditing({ type: 'bus', id: bus._id });
    setTab('buses');
  }

  function editRoute(route) {
    setRouteForm({
      name: route.name || '',
      source: route.source || '',
      destination: route.destination || '',
      stops: Array.isArray(route.stops) ? route.stops.join(', ') : (route.stops || ''),
      distanceKm: route.distanceKm || ''
    });
    setEditing({ type: 'route', id: route._id });
    setTab('routes');
  }

  function editTrip(trip) {
    setTripForm({
      bus: trip.bus?._id || trip.bus || '',
      route: trip.route?._id || trip.route || '',
      travelDate: trip.travelDate ? trip.travelDate.slice(0, 10) : defaultDate,
      departureTime: trip.departureTime || '08:00',
      arrivalTime: trip.arrivalTime || '14:00',
      price: trip.price || 500,
      status: trip.status || 'scheduled'
    });
    setEditing({ type: 'trip', id: trip._id });
    setTab('trips');
  }

  async function showManifest(tripId) {
    if (!tripId) return;
    try {
      const data = await apiRequest(`/bookings/manifest/${tripId}`);
      setManifest(data);
    } catch (error) {
      showError(error, setNotice);
    }
  }

  const navItems = [
    ['dashboard', 'Overview', LayoutDashboard],
    ['buses', 'Buses', BusFront],
    ['routes', 'Routes', MapPin],
    ['trips', 'Trips', CalendarDays],
    ['bookings', 'Bookings', Ticket]
  ];

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-title">
          <LayoutDashboard size={20} />
          <div>
            <strong>Operations</strong>
            <small>Admin console</small>
          </div>
        </div>
        <nav>
          {navItems.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => {
                setTab(id);
                setManifest(null);
                setEditing(null);
              }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="admin-help">
          <ShieldCheck size={17} />
          <span>Manage trips, seats, and bookings from one place.</span>
        </div>
      </aside>

      <div className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h1>{navItems.find(([id]) => id === tab)?.[1] || 'Overview'}</h1>
          </div>
          <span className="admin-live"><i></i> Live data</span>
        </div>

        {loading && <Loading />}
        {tab === 'dashboard' && <AdminDashboard stats={stats} trips={trips} />}
        {tab === 'buses' && (
          <AdminBuses
            buses={buses}
            form={busForm}
            setForm={setBusForm}
            save={saveBus}
            editing={editing}
            edit={editBus}
            remove={remove}
            cancelEditing={cancelEditing}
          />
        )}
        {tab === 'routes' && (
          <AdminRoutes
            routes={routes}
            form={routeForm}
            setForm={setRouteForm}
            save={saveRoute}
            editing={editing}
            edit={editRoute}
            remove={remove}
            cancelEditing={cancelEditing}
          />
        )}
        {tab === 'trips' && (
          <AdminTrips
            trips={trips}
            buses={buses}
            routes={routes}
            form={tripForm}
            setForm={setTripForm}
            save={saveTrip}
            editing={editing}
            edit={editTrip}
            remove={remove}
            cancelEditing={cancelEditing}
          />
        )}
        {tab === 'bookings' && (
          <AdminBookings
            bookings={bookings}
            showManifest={showManifest}
            manifest={manifest}
          />
        )}
      </div>
    </section>
  );
}

function AdminDashboard({ stats, trips }) {
  if (!stats) return null;
  const cards = [
    ['Customers', stats.customers, Users],
    ['Buses', stats.buses, BusFront],
    ['Trips', stats.trips, CalendarDays],
    ['Revenue', formatCurrency(stats.revenue), Ticket]
  ];

  return (
    <>
      <div className="stat-grid">
        {cards.map(([label, value, Icon]) => (
          <div className="stat-card" key={label}>
            <span className="stat-icon"><Icon size={19} /></span>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Occupancy overview</h2>
              <p>Confirmed seat usage across scheduled trips.</p>
            </div>
            <strong className="large-number">{stats.occupancyRate}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.min(stats.occupancyRate, 100)}%` }}></span>
          </div>
          <div className="occupancy-meta">
            <span>{stats.confirmedBookings} confirmed bookings</span>
            <span>Healthy operations</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming trips</h2>
              <p>Latest schedules in the system.</p>
            </div>
          </div>
          {trips.length === 0 ? (
            <p className="occupancy-meta">No trips configured yet.</p>
          ) : (
            trips.slice(0, 4).map((trip) => {
              const routeLabel = trip.route ? `${trip.route.source} → ${trip.route.destination}` : 'Route unavailable';
              const dateLabel = trip.travelDate ? formatDate(trip.travelDate) : 'Date unavailable';
              return (
                <div className="mini-trip" key={trip._id}>
                  <span>{dateLabel}</span>
                  <strong>{routeLabel}</strong>
                  <small>{trip.departureTime || 'N/A'}</small>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function AdminBuses({ buses, form, setForm, save, editing, edit, remove, cancelEditing }) {
  const isEditing = editing?.type === 'bus';

  return (
    <div className="admin-management">
      <form className="admin-form panel" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <h2>{isEditing ? 'Edit bus' : 'Add a bus'}</h2>
            <p>Set the seats and amenities shown to customers.</p>
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Bus number</label>
            <input
              required
              placeholder="e.g. BB-101"
              value={form.busNumber}
              onChange={(event) => setForm({ ...form, busNumber: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Bus name</label>
            <input
              required
              placeholder="e.g. CityLine Express"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Total seats</label>
            <input
              required
              type="number"
              min="1"
              max="80"
              placeholder="Total seats"
              value={form.totalSeats}
              onChange={(event) => setForm({ ...form, totalSeats: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Amenities</label>
            <input
              placeholder="AC, Wi-Fi, Charging"
              value={form.amenities}
              onChange={(event) => setForm({ ...form, amenities: event.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="primary-button">
            <Plus size={16} /> {isEditing ? 'Update bus' : 'Save bus'}
          </button>
          {isEditing && (
            <button type="button" className="outline-button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>All buses</h2>
            <p>{buses.length} buses configured</p>
          </div>
        </div>
        {buses.length === 0 ? (
          <EmptyState title="No buses configured" text="Add your first bus using the form on the left." />
        ) : (
          buses.map((bus) => (
            <div className="data-row" key={bus._id}>
              <div>
                <strong>{bus.name}</strong>
                <small>{bus.busNumber} · {bus.totalSeats} seats · {Array.isArray(bus.amenities) ? bus.amenities.join(', ') : 'Standard'}</small>
              </div>
              <div className="row-actions">
                <button className="icon-text-button" onClick={() => edit(bus)}>Edit</button>
                <button
                  className="icon-button danger"
                  onClick={() => remove(`/admin/buses/${bus._id}`, 'Bus deleted', 'bus')}
                  aria-label="Delete bus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminRoutes({ routes, form, setForm, save, editing, edit, remove, cancelEditing }) {
  const isEditing = editing?.type === 'route';

  return (
    <div className="admin-management">
      <form className="admin-form panel" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <h2>{isEditing ? 'Edit route' : 'Add a route'}</h2>
            <p>Define the source, destination, and intermediate stops.</p>
          </div>
        </div>
        <div className="form-field">
          <label>Route name</label>
          <input
            required
            placeholder="e.g. Bengaluru to Chennai"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Source city</label>
            <input
              required
              placeholder="e.g. Bengaluru"
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Destination city</label>
            <input
              required
              placeholder="e.g. Chennai"
              value={form.destination}
              onChange={(event) => setForm({ ...form, destination: event.target.value })}
            />
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Stops (comma separated)</label>
            <input
              placeholder="e.g. Hosur, Vellore"
              value={form.stops}
              onChange={(event) => setForm({ ...form, stops: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Distance (km)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 350"
              value={form.distanceKm}
              onChange={(event) => setForm({ ...form, distanceKm: event.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="primary-button">
            <Plus size={16} /> {isEditing ? 'Update route' : 'Save route'}
          </button>
          {isEditing && (
            <button type="button" className="outline-button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>All routes</h2>
            <p>{routes.length} routes configured</p>
          </div>
        </div>
        {routes.length === 0 ? (
          <EmptyState title="No routes configured" text="Add your first route using the form on the left." />
        ) : (
          routes.map((route) => (
            <div className="data-row" key={route._id}>
              <div>
                <strong>{route.source} → {route.destination}</strong>
                <small>{route.name} · {Array.isArray(route.stops) && route.stops.length ? route.stops.join(', ') : 'Direct'}{route.distanceKm ? ` · ${route.distanceKm} km` : ''}</small>
              </div>
              <div className="row-actions">
                <button className="icon-text-button" onClick={() => edit(route)}>Edit</button>
                <button
                  className="icon-button danger"
                  onClick={() => remove(`/admin/routes/${route._id}`, 'Route deleted', 'route')}
                  aria-label="Delete route"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminTrips({ trips, buses, routes, form, setForm, save, editing, edit, remove, cancelEditing }) {
  const isEditing = editing?.type === 'trip';

  return (
    <div className="admin-management">
      <form className="admin-form panel" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <h2>{isEditing ? 'Edit schedule' : 'Create a trip'}</h2>
            <p>Connect a bus and route with a date, time, and price.</p>
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Assigned bus</label>
            <select
              required
              value={form.bus}
              onChange={(event) => setForm({ ...form, bus: event.target.value })}
            >
              <option value="">Select bus</option>
              {buses.map((bus) => (
                <option key={bus._id} value={bus._id}>{bus.name} ({bus.busNumber})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Assigned route</label>
            <select
              required
              value={form.route}
              onChange={(event) => setForm({ ...form, route: event.target.value })}
            >
              <option value="">Select route</option>
              {routes.map((route) => (
                <option key={route._id} value={route._id}>{route.source} → {route.destination}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Travel date</label>
            <input
              required
              type="date"
              value={form.travelDate}
              onChange={(event) => setForm({ ...form, travelDate: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Ticket price (₹)</label>
            <input
              required
              type="number"
              min="0"
              placeholder="e.g. 500"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </div>
        </div>
        <div className="two-fields">
          <div className="form-field">
            <label>Departure time</label>
            <input
              required
              type="time"
              value={form.departureTime}
              onChange={(event) => setForm({ ...form, departureTime: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Arrival time</label>
            <input
              required
              type="time"
              value={form.arrivalTime}
              onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="primary-button">
            <Plus size={16} /> {isEditing ? 'Update schedule' : 'Save schedule'}
          </button>
          {isEditing && (
            <button type="button" className="outline-button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Trip schedules</h2>
            <p>{trips.length} trips configured</p>
          </div>
        </div>
        {trips.length === 0 ? (
          <EmptyState title="No trip schedules" text="Create your first trip schedule using the form on the left." />
        ) : (
          trips.map((trip) => {
            const routeLabel = trip.route ? `${trip.route.source} → ${trip.route.destination}` : 'Route unavailable';
            const busLabel = trip.bus?.name || 'Bus details unavailable';
            const dateLabel = trip.travelDate ? formatDate(trip.travelDate) : 'Date unavailable';

            return (
              <div className="data-row" key={trip._id}>
                <div>
                  <strong>{routeLabel}</strong>
                  <small>{busLabel} · {dateLabel} · {trip.departureTime || 'N/A'} · {formatCurrency(trip.price)}</small>
                </div>
                <div className="row-actions">
                  <button className="icon-text-button" onClick={() => edit(trip)}>Edit</button>
                  <button
                    className="icon-button danger"
                    onClick={() => remove(`/trips/${trip._id}`, 'Trip deleted', 'trip schedule')}
                    aria-label="Delete trip"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AdminBookings({ bookings, showManifest, manifest }) {
  return (
    <div className="panel table-panel admin-bookings">
      <div className="panel-heading">
        <div>
          <h2>All bookings</h2>
          <p>Confirmed tickets and cancellation records.</p>
        </div>
      </div>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings recorded" text="Customer bookings will appear here once booked." />
      ) : (
        bookings.map((booking) => {
          const routeLabel = booking.trip?.route
            ? `${booking.trip.route.source} → ${booking.trip.route.destination}`
            : 'Route details unavailable';
          const seatsLabel = Array.isArray(booking.seats) ? booking.seats.join(', ') : 'N/A';
          const tripId = booking.trip?._id || booking.trip;

          return (
            <div className="data-row" key={booking._id}>
              <div>
                <strong>{booking.pnr} · {booking.user?.name || 'Guest Customer'}</strong>
                <small>{routeLabel} · Seats: {seatsLabel}</small>
              </div>
              <div className="booking-status">
                <span className={`status-pill ${booking.status?.toLowerCase() || 'confirmed'}`}>{booking.status}</span>
                <small>{formatCurrency(booking.totalFare)}</small>
              </div>
              {tripId && (
                <button className="icon-text-button" onClick={() => showManifest(tripId)}>Manifest</button>
              )}
            </div>
          );
        })
      )}

      {manifest && (
        <div className="manifest-box">
          <div className="panel-heading">
            <div>
              <h2>Passenger manifest</h2>
              <p>
                {manifest.trip?.route ? `${manifest.trip.route.source} → ${manifest.trip.route.destination}` : 'Trip'} ·{' '}
                {manifest.occupancy?.booked ?? 0}/{manifest.occupancy?.total ?? 0} seats booked
              </p>
            </div>
          </div>
          {manifest.passengers?.length === 0 ? (
            <p className="occupancy-meta" style={{ padding: '12px 0' }}>No confirmed passengers for this trip yet.</p>
          ) : (
            manifest.passengers.map((passenger) => (
              <div className="manifest-row" key={`${passenger.pnr}-${passenger.seatNumber}`}>
                <b>Seat {passenger.seatNumber}</b>
                <span>{passenger.name}</span>
                <span>{passenger.phone}</span>
                <small>{passenger.pnr}</small>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Loading() { return <div className="loading"><span></span> Loading...</div>; }
function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Ticket size={26} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export default App;
