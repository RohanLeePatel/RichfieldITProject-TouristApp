import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";

import useTheme from "../recommendations/useTheme.js";
import TermsGate from "../onboarding/TermsGate.jsx";
import AppSidebar from "./AppSidebar.jsx";
import "../../styles/dashboard.css";
import "../../styles/appShell.css";

// Every signed-in page except the Dashboard (which lays out its own header
// around the same AppSidebar) renders inside this: the shared sidebar on the
// left, the page unchanged on the right.
export default function AppShell() {
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell" data-theme={theme}>
      <AppSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <button type="button" className="app-shell-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="app-shell-main">
        <Outlet />
      </div>

      <TermsGate />
    </div>
  );
}
