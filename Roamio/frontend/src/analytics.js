// Google Analytics 4 loader. Does nothing unless VITE_GA_MEASUREMENT_ID is set
// to a G-XXXXXXX id, so local builds and forks stay quiet.
//
// The page view is sent by hand on each route change (see RouteTracker in
// App.jsx) so client-side navigation is counted, and /admin is never reported.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const VALID_ID = /^G-[A-Z0-9]+$/i;

let initialised = false;
let lastTrackedPath = null;

const isAdminPath = (pathname) => pathname === "/admin" || pathname.startsWith("/admin/");

export function initAnalytics() {
  if (initialised || !MEASUREMENT_ID || !VALID_ID.test(MEASUREMENT_ID)) return;
  initialised = true;

  // gtag.js expects the real `arguments` object, not an array, on the dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

export function trackPageView(pathname, search = "") {
  if (!initialised || isAdminPath(pathname)) return;

  const path = `${pathname}${search}`;
  // React StrictMode runs effects twice in development; don't count that as two views
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
