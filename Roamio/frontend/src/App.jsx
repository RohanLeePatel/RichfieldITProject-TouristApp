import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Family from "./pages/Family.jsx";

import Translator from "./pages/Translator.jsx";
import Weather from "./pages/Weather.jsx";
import Recommendations from "./pages/Recommendations.jsx";

import TripsList from "./pages/TripsList.jsx";
import TripDetail from "./pages/TripDetail.jsx";
import TripBudget from "./pages/TripBudget.jsx";
import Calendar from "./pages/Calendar.jsx";
import Invite from "./pages/Invite.jsx";
import Join from "./pages/Join.jsx";

import AppShell from "./components/layout/AppShell.jsx";
import { useAuthStore } from "./store/authStore.js";

// =========================================================
// PROTECTED ROUTE
// =========================================================

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated
  );

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

// =========================================================
// APP
// =========================================================

function App() {
  return (
    <BrowserRouter>
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
          <Route path="/weather" element={<Weather />} />
          <Route path="/translator" element={<Translator />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* an invite link: public, so an invitee can see it before signing in */}
        <Route path="/invite/:token" element={<Invite />} />
        {/* a shareable trip/group link (join code) */}
        <Route path="/join/:code" element={<Join />} />

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

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;