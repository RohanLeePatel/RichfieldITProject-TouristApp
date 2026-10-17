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
import Calendar from "./pages/Calendar.jsx";

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
            FAMILY / TRAVEL GROUP
        ================================================= */}

        <Route
          path="/family"
          element={
            <ProtectedRoute>
              <Family />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            TRIPS
        ================================================= */}

        <Route
          path="/trips"
          element={
            <ProtectedRoute>
              <TripsList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trips/:tripId"
          element={
            <ProtectedRoute>
              <TripDetail />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            CALENDAR
        ================================================= */}

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            EXPLORE
        ================================================= */}

        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            WEATHER
        ================================================= */}

        <Route
          path="/weather"
          element={
            <ProtectedRoute>
              <Weather />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            TRANSLATOR
        ================================================= */}

        <Route
          path="/translator"
          element={
            <ProtectedRoute>
              <Translator />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            RECOMMENDATIONS
        ================================================= */}

        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            SETTINGS
        ================================================= */}

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
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