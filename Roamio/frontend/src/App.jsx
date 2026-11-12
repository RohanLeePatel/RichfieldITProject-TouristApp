import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { trackPageView } from "./analytics.js";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Family = lazy(() => import("./pages/Family.jsx"));

const Translator = lazy(() => import("./pages/Translator.jsx"));
const Weather = lazy(() => import("./pages/Weather.jsx"));
const Recommendations = lazy(() => import("./pages/Recommendations.jsx"));

const TripsList = lazy(() => import("./pages/TripsList.jsx"));
const TripDetail = lazy(() => import("./pages/TripDetail.jsx"));
const TripBudget = lazy(() => import("./pages/TripBudget.jsx"));
const Calendar = lazy(() => import("./pages/Calendar.jsx"));
const Chat = lazy(() => import("./pages/Chat.jsx"));
const Invite = lazy(() => import("./pages/Invite.jsx"));
const Join = lazy(() => import("./pages/Join.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const Legal = lazy(() => import("./pages/Legal.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

import OfflineBanner from "./components/layout/OfflineBanner.jsx";
import Toaster from "./components/layout/Toaster.jsx";
import ConfirmHost from "./components/layout/ConfirmHost.jsx";
import { fetchTrip } from "./api/trips.js";
import { cacheDocument, fetchDocuments } from "./api/tripDocuments.js";
import { useTripStore, defaultTrip } from "./store/tripStore.js";
import AppShell from "./components/layout/AppShell.jsx";
import AdminRoute from "./components/admin/AdminRoute.jsx";
import { useAuthStore } from "./store/authStore.js";

// =========================================================
// PROTECTED ROUTE
// =========================================================

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated
  );

  const location = useLocation();

  // remember the page asked for, so signing in lands there
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return children;
}

// =========================================================
// APP
// =========================================================

// Browser-tab names, so open tabs and history entries say which page they are
const DEFAULT_TITLE = document.title;
const PAGE_TITLES = {
  "/login": "Log in",
  "/register": "Create account",
  "/forgot-password": "Reset password",
  "/reset-password": "Reset password",
  "/dashboard": "Dashboard",
  "/trips": "My trips",
  "/calendar": "Calendar",
  "/weather": "Weather",
  "/translator": "Travel translator",
  "/chat": "Trip assistant",
  "/recommendations": "Plan a trip",
  "/family": "Travel groups",
  "/settings": "Settings",
  "/admin": "Admin dashboard",
  "/terms": "Terms and conditions",
  "/privacy": "Privacy policy",
};
function titleFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/trips/")) return pathname.endsWith("/budget") ? "Trip budget" : "Trip";
  if (pathname.startsWith("/invite/") || pathname.startsWith("/join/")) return "Invite";
  return null;
}

// Reports each route change to GA4 (the first load is reported here too)
function RouteTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    trackPageView(pathname, search);
  }, [pathname, search]);
  useEffect(() => {
    const title = titleFor(pathname);
    document.title = title ? `${title} - Roamio` : DEFAULT_TITLE;
  }, [pathname]);
  return null;
}

// While online and signed in, warm the offline copy of the active trip (itinerary
// included) so it is there even if the user never opened it before losing signal.
function OfflinePrefetch() {
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const trips = useTripStore((state) => state.trips);
  const loaded = useTripStore((state) => state.loaded);
  const activeId = useTripStore((state) => state.activeTripId);
  useEffect(() => {
    if (!signedIn) return;
    useTripStore.getState().load();
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn || !loaded || !navigator.onLine) return;
    const trip = trips.find((t) => String(t.id) === String(activeId)) || defaultTrip(trips);
    if (!trip) return;
    fetchTrip(trip.id).catch(() => {});
    // the files too (1 MB max each): a booking should open at the airport with no signal
    fetchDocuments(trip.id)
      .then((docs) => Promise.all(docs.map((d) => cacheDocument(trip.id, d.id))))
      .catch(() => {});
  }, [signedIn, loaded, trips, activeId]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <OfflineBanner />
      <OfflinePrefetch />
      <Toaster />
      <ConfirmHost />
      <Suspense fallback={<p role="status" style={{ padding: 24 }}>Loading...</p>}>
      <Routes>

        {/* =================================================
            AUTH
        ================================================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* =================================================
            DASHBOARD
        ================================================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            EVERY OTHER SIGNED-IN PAGE
            Rendered inside AppShell: the shared sidebar with the
            active-trip switcher, the page itself unchanged beside it.
        ================================================= */}

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/family" element={<Family />} />
          <Route path="/trips" element={<TripsList />} />
          <Route path="/trips/:tripId" element={<TripDetail />} />
          <Route path="/trips/:tripId/budget" element={<TripBudget />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/translator" element={<Translator />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/settings" element={<Settings />} />
          {/* admins only: AdminRoute asks the API, which decides who is one */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Route>

        {/* an invite link: public, so an invitee can see it before signing in */}
        <Route path="/invite/:token" element={<Invite />} />
        {/* a shareable trip/group link (join code) */}
        <Route path="/join/:code" element={<Join />} />

        {/* public, so they can be read before signing up */}
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />

        {/* the wizard used to live at two addresses */}
        <Route
          path="/explore"
          element={<Navigate to="/recommendations" replace />}
        />

        {/* =================================================
            DEFAULT ROUTE
        ================================================= */}

        <Route
          path="/"
          element={<Landing />}
        />

        {/* =================================================
            UNKNOWN ROUTES
        ================================================= */}

        <Route path="*" element={<NotFound />} />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;