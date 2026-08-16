import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Login */}
        <Route
          path="/"
          element={<Login />}
        />

        {/* Register */}
        <Route
          path="/register"
          element={<Register />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

      </Routes>

    </BrowserRouter>
  );
}