import {
  Plane,
  Users,
  Sparkles,
  MapPin,
  CalendarDays,
  ArrowRight,
  Compass,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Languages,
  FileText,
  Route,
  SlidersHorizontal,
  MessageCircle,
  Menu,
  X,
} from "lucide-react";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../store/authStore.js";

import heroImage from "../assets/landing/hero-capetown.jpg";
import ctaImage from "../assets/landing/cta-safari.jpg";
import beachImage from "../assets/landing/beach.jpg";
import kyotoImage from "../assets/landing/kyoto.jpg";
import santoriniImage from "../assets/landing/santorini.jpg";
import marrakechImage from "../assets/landing/marrakech.jpg";
import baliImage from "../assets/landing/bali.jpg";
import mountainsImage from "../assets/landing/mountains.jpg";
import bayImage from "../assets/landing/bay.jpg";
import cityImage from "../assets/landing/city.jpg";
import machuPicchuImage from "../assets/landing/machupicchu.jpg";
import maldivesImage from "../assets/landing/maldives.jpg";
import icelandImage from "../assets/landing/iceland.jpg";
import dubaiImage from "../assets/landing/dubai.jpg";
import petraImage from "../assets/landing/petra.jpg";
import sydneyImage from "../assets/landing/sydney.jpg";
import rioImage from "../assets/landing/rio.jpg";
import howBgImage from "../assets/landing/bg-how-friends.jpg";
import faqBgImage from "../assets/landing/bg-faq-pool.jpg";
import recommendImage from "../assets/landing/feat-recommend.jpg";
import assistantImage from "../assets/landing/feat-ai-assistant.jpg";
import itineraryImage from "../assets/landing/feat-itinerary.jpg";
import vaultImage from "../assets/landing/feat-vault.jpg";
import weatherImage from "../assets/landing/feat-weather.jpg";
import translatorImage from "../assets/landing/feat-translator.jpg";

import useTheme from "../components/recommendations/useTheme.js";
import "../styles/landing.css";

// Photos: Unsplash (free to use under the Unsplash License), except for the
// generated AI Assistant image. Use each photo and place once on the page.

// =========================================================
// CONTENT
// =========================================================

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

const DESTINATIONS = [
  { image: santoriniImage, place: "Santorini", country: "Greece", kind: "Island sunsets" },
  { image: machuPicchuImage, place: "Machu Picchu", country: "Peru", kind: "Inca trails" },
  { image: marrakechImage, place: "Marrakech", country: "Morocco", kind: "Markets & mountains" },
  { image: maldivesImage, place: "Maldives", country: "Indian Ocean", kind: "Overwater escapes" },
  { image: baliImage, place: "Bali", country: "Indonesia", kind: "Temples & lakes" },
  { image: icelandImage, place: "Iceland", country: "Nordic island", kind: "Waterfalls & wild roads" },
  { image: dubaiImage, place: "Dubai", country: "UAE", kind: "Skylines & desert" },
  { image: bayImage, place: "Ha Long Bay", country: "Vietnam", kind: "Islands & cruises" },
  { image: petraImage, place: "Petra", country: "Jordan", kind: "Ancient wonders" },
  { image: sydneyImage, place: "Sydney", country: "Australia", kind: "Harbour city" },
  { image: mountainsImage, place: "Lago di Braies", country: "Italy", kind: "Lakes & mountains" },
  { image: rioImage, place: "Rio de Janeiro", country: "Brazil", kind: "Beaches & peaks" },
  { image: cityImage, place: "Paris", country: "France", kind: "City break" },
];

// how long each destination stays put before the carousel moves on
const CAROUSEL_INTERVAL_MS = 3200;

const STEPS = [
  {
    icon: Users,
    title: "Add your group",
    text: "Bring in everyone who's coming - adults, kids and anyone with accessibility needs.",
  },
  {
    icon: SlidersHorizontal,
    title: "Share what matters",
    text: "Set your travel budget, the experiences you're after and how fast you like to explore.",
  },
  {
    icon: Sparkles,
    title: "Get ranked destinations",
    text: "Roamio ranks places against the whole group and explains why each one made the list.",
  },
];

const FEATURES = [
  {
    icon: Compass,
    image: recommendImage,
    title: "Smart recommendations",
    text: "Destinations ranked against your group's budget, interests, pace and accessibility.",
  },
  {
    icon: MessageCircle,
    image: assistantImage,
    title: "AI Assistant",
    text: "Ask travel questions and get suggestions for what to see, what to pack and how to get around.",
  },
  {
    icon: Route,
    image: itineraryImage,
    title: "Day-by-day itinerary",
    text: "Turn a destination into a plan with landmarks laid out on a map.",
  },
  {
    icon: FileText,
    image: vaultImage,
    title: "Trip document vault",
    text: "Keep tickets, bookings and IDs with the trip they belong to.",
  },
  {
    icon: CloudSun,
    image: weatherImage,
    title: "Destination weather",
    text: "Check live conditions and the forecast before you pack.",
  },
  {
    icon: Languages,
    image: translatorImage,
    title: "Travel translator",
    text: "Get by in the local language with quick, travel-ready phrases.",
  },
];

// illustrative numbers for the product preview card
const MATCH_REASONS = [
  { label: "Fits the group budget", value: 96 },
  { label: "Temples, food & culture", value: 91 },
  { label: "Relaxed pace for the kids", value: 88 },
];

const FAQS = [
  {
    q: "How does Roamio choose destinations?",
    a: "You tell Roamio about your group - budget, interests, travel pace and accessibility needs - and it ranks destinations against all of it at once, instead of just one person's wishlist.",
  },
  {
    q: "Can I see why a destination was suggested?",
    a: "Yes. Every recommendation comes with a plain-language explanation of how it matched your group, so it's easy to talk through the options together.",
  },
  {
    q: "Who is Roamio for?",
    a: "Families, friend groups and anyone planning a trip with more than one opinion to keep happy. It works just as well for smaller trips.",
  },
  {
    q: "Where do I keep tickets and bookings?",
    a: "Each trip has its own document vault, so flight tickets, hotel bookings and other paperwork stay with the trip they belong to.",
  },
  {
    q: "What else can Roamio help with once I've chosen?",
    a: "Build a day-by-day itinerary, check the weather at your destination, keep everything on a calendar and use the travel translator while you're away.",
  },
];

// =========================================================
// SCROLL REVEAL
// =========================================================

// Adds .is-visible to every [data-reveal] element once it scrolls into view.
function useScrollReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = root.querySelectorAll("[data-reveal]");

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [rootRef]);
}

// =========================================================
// DESTINATION CAROUSEL
// =========================================================

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;

    const onChange = () => setReduce(query.matches);
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduce;
}

// Auto-advances one card at a time and rewinds to the start at the end, so
// every destination appears once (a looping marquee needs duplicates).
// Pauses on hover, keyboard focus, touch, or when off-screen.
function DestinationCarousel({ items }) {
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const resumeAtRef = useRef(0);

  const reduceMotion = usePrefersReducedMotion();

  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const [progress, setProgress] = useState(0);

  const playing = !hovering && !focused && inView && !reduceMotion;

  const step = useCallback(
    (direction) => {
      const track = trackRef.current;
      const card = track?.querySelector("li");
      if (!card) return;

      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const max = track.scrollWidth - track.clientWidth;
      const behavior = reduceMotion ? "auto" : "smooth";

      if (direction > 0 && track.scrollLeft >= max - 4) {
        track.scrollTo({ left: 0, behavior });
      } else if (direction < 0 && track.scrollLeft <= 4) {
        track.scrollTo({ left: max, behavior });
      } else {
        track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior });
      }
    },
    [reduceMotion]
  );

  // autoplay
  useEffect(() => {
    if (!playing) return undefined;

    const timer = setInterval(() => {
      // give a swipe/scroll a few seconds before taking over again
      if (Date.now() < resumeAtRef.current) return;
      step(1);
    }, CAROUSEL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [playing, step]);

  // only run while the carousel is on screen
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 }
    );

    observer.observe(wrap);

    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const track = trackRef.current;
    const max = track.scrollWidth - track.clientWidth;
    setProgress(max > 0 ? track.scrollLeft / max : 0);
  };

  const holdAutoplay = () => {
    resumeAtRef.current = Date.now() + 6000;
  };

  const goTo = (direction) => {
    holdAutoplay();
    step(direction);
  };

  return (
    <div
      className="landing-carousel"
      ref={wrapRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Destination ideas"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >

      <div className="landing-container landing-carousel-head" data-reveal>

        <div>
          <p className="landing-kicker">Destination ideas</p>
          <h2>Where will your group go next?</h2>
        </div>

        <div className="landing-carousel-controls">
          <button
            type="button"
            onClick={() => goTo(-1)}
            aria-label="Previous destination"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label="Next destination"
          >
            <ChevronRight size={20} />
          </button>
        </div>

      </div>

      <ul
        className="landing-carousel-track"
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={holdAutoplay}
        onWheel={holdAutoplay}
        onTouchStart={holdAutoplay}
        data-reveal
      >
        {items.map((d, i) => (
          <li
            key={d.place}
            className="landing-destination"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}: ${d.place}`}
          >
            <img
              src={d.image}
              alt={`${d.place}, ${d.country}`}
              loading="lazy"
              draggable="false"
            />

            <div className="landing-destination-caption">
              <span>{d.kind}</span>
              <strong>{d.place}</strong>
              <em>
                <MapPin size={13} />
                {d.country}
              </em>
            </div>
          </li>
        ))}
      </ul>

      <div className="landing-container">
        <div className="landing-carousel-progress" aria-hidden="true">
          <span style={{ width: `${Math.max(progress, 0.04) * 100}%` }} />
        </div>
      </div>

    </div>
  );
}

// =========================================================
// LANDING
// =========================================================

export default function Landing() {
  const { theme } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pageRef = useRef(null);

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useScrollReveal(pageRef);

  // solid nav once the hero starts scrolling away
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div
      className="landing-page"
      data-theme={theme}
      ref={pageRef}
    >

      {/* =====================================================
          NAV
      ===================================================== */}

      <header className={`landing-nav ${scrolled || menuOpen ? "is-solid" : ""}`}>

        <div className="landing-container landing-nav-inner">

          <a href="#top" className="landing-logo" aria-label="Roamio, back to top" onClick={closeMenu}>
            <span className="landing-logo-icon">
              <Plane size={18} />
            </span>
            Roamio
          </a>

          <nav
            className={`landing-nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Main"
          >
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}

            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-btn landing-btn-primary landing-nav-cta" onClick={closeMenu}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-nav-login" onClick={closeMenu}>
                  Log in
                </Link>

                <Link to="/register" className="landing-btn landing-btn-primary landing-nav-cta" onClick={closeMenu}>
                  Get started
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="landing-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

        </div>

      </header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="landing-hero" id="top">

        <div
          className="landing-hero-bg"
          style={{ backgroundImage: `url(${heroImage})` }}
          aria-hidden="true"
        />

        <div className="landing-hero-overlay" aria-hidden="true" />

        <div className="landing-container landing-hero-inner">

          <div className="landing-hero-copy">

            <p className="landing-eyebrow landing-anim" style={{ "--delay": "0.1s" }}>
              <Sparkles size={14} />
              Group travel, sorted
            </p>

            <h1 className="landing-anim" style={{ "--delay": "0.2s" }}>
              Plan a trip your whole{" "}
              <span className="landing-highlight">group</span>
              <br />
              agrees on.
            </h1>

            <p className="landing-hero-sub landing-anim" style={{ "--delay": "0.35s" }}>
              Roamio ranks destinations against what everyone wants - budget,
              interests, pace and accessibility - and tells you why each one
              matched.
            </p>

            <div className="landing-hero-actions landing-anim" style={{ "--delay": "0.5s" }}>
              <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
                Plan a group trip
                <ArrowRight size={18} />
              </Link>

              <a href="#how-it-works" className="landing-btn landing-btn-glass landing-btn-lg">
                See how it works
              </a>
            </div>

            <ul className="landing-hero-points landing-anim" style={{ "--delay": "0.65s" }}>
              <li><Check size={15} /> Built for groups</li>
              <li><Check size={15} /> Explained recommendations</li>
              <li><Check size={15} /> Everything in one place</li>
            </ul>

          </div>

          {/* floating product preview */}

          <div className="landing-hero-visual" aria-hidden="true">

            <div className="landing-float-card landing-match-card">
              <img src={beachImage} alt="" />

              <div className="landing-match-body">
                <div className="landing-match-top">
                  <div>
                    <strong>Zanzibar</strong>
                    <span><MapPin size={12} /> Tanzania</span>
                  </div>

                  <span className="landing-match-score">94% match</span>
                </div>

                <ul>
                  <li><Check size={13} /> Within budget</li>
                  <li><Check size={13} /> Beaches & food</li>
                  <li><Check size={13} /> Relaxed pace</li>
                </ul>
              </div>
            </div>

            <div className="landing-float-card landing-group-card">
              <div className="landing-avatars">
                <span className="tone-a">AK</span>
                <span className="tone-b">LB</span>
                <span className="tone-c">TM</span>
                <span className="tone-d">+2</span>
              </div>

              <div>
                <strong>5 travellers</strong>
                <span>Everyone's in</span>
              </div>
            </div>

            <div className="landing-float-card landing-date-card">
              <CalendarDays size={18} />

              <div>
                <strong>12 days to go</strong>
                <span>Bags packed?</span>
              </div>
            </div>

          </div>

        </div>

        <a href="#destinations" className="landing-scroll-cue" aria-label="Scroll down">
          <span />
        </a>

      </section>

      {/* =====================================================
          DESTINATIONS
      ===================================================== */}

      <section className="landing-section landing-destinations" id="destinations">
        <DestinationCarousel items={DESTINATIONS} />
      </section>

      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section className="landing-section landing-photo-section" id="how-it-works">

        <div
          className="landing-section-bg"
          style={{ backgroundImage: `url(${howBgImage})` }}
          aria-hidden="true"
        />

        <div className="landing-container">

          <div className="landing-section-head" data-reveal>
            <p className="landing-kicker">How it works</p>
            <h2>Plan your next trip in three simple steps</h2>
          </div>

          <ol className="landing-steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li
                className="landing-step"
                key={title}
                data-reveal
                style={{ "--delay": `${i * 0.12}s` }}
              >
                <span className="landing-step-number">{i + 1}</span>

                <div className="landing-step-icon">
                  <Icon size={22} />
                </div>

                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>

        </div>

      </section>

      {/* =====================================================
          WHY IT MATCHED (preview)
      ===================================================== */}

      <section className="landing-section landing-section-tinted">

        <div className="landing-container landing-split">

          <div className="landing-split-copy" data-reveal>
            <p className="landing-kicker">Recommendations you can trust</p>

            <h2>See exactly why a destination made the list</h2>

            <p>
              No black box. Every suggestion shows how it scores against your
              group's budget, interests and pace, so the decision is easy to
              explain - and easy to agree on.
            </p>

            <ul className="landing-checklist">
              <li><Check size={16} /> Ranked for the whole group, not one person</li>
              <li><Check size={16} /> Accessibility needs taken into account</li>
              <li><Check size={16} /> Compare favourites side by side</li>
            </ul>
          </div>

          <div className="landing-preview" data-reveal style={{ "--delay": "0.15s" }}>

            <div className="landing-preview-image">
              <img src={kyotoImage} alt="Yasaka Pagoda on a quiet street in Kyoto" loading="lazy" />

              <span className="landing-preview-rank">#1 for your group</span>
            </div>

            <div className="landing-preview-body">
              <div className="landing-preview-title">
                <div>
                  <h3>Kyoto</h3>
                  <span><MapPin size={13} /> Japan · 6 nights</span>
                </div>

                <span className="landing-match-score">92% match</span>
              </div>

              <ul className="landing-bars">
                {MATCH_REASONS.map((reason) => (
                  <li key={reason.label}>
                    <div>
                      <span>{reason.label}</span>
                      <strong>{reason.value}%</strong>
                    </div>

                    <span className="landing-bar">
                      <span style={{ "--value": `${reason.value}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section className="landing-section" id="features">

        <div className="landing-container">

          <div className="landing-section-head" data-reveal>
            <p className="landing-kicker">Features</p>
            <h2>Everything your trip needs, in one place</h2>
            <p>From picking the destination to the day you land.</p>
          </div>

          <div className="landing-features">
            {FEATURES.map(({ icon: Icon, image, title, text }, i) => (
              <article
                className="landing-feature"
                key={title}
                data-reveal
                style={{ "--delay": `${(i % 3) * 0.1}s` }}
              >
                <img
                  className="landing-feature-photo"
                  src={image}
                  alt=""
                  loading="lazy"
                />

                <div className="landing-feature-body">
                  <div className="landing-feature-icon">
                    <Icon size={22} />
                  </div>

                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>

        </div>

      </section>

      {/* =====================================================
          FAQ
      ===================================================== */}

      <section className="landing-section landing-photo-section" id="faq">

        <div
          className="landing-section-bg"
          style={{ backgroundImage: `url(${faqBgImage})` }}
          aria-hidden="true"
        />

        <div className="landing-container landing-faq-wrap">

          <div className="landing-section-head" data-reveal>
            <p className="landing-kicker">FAQ</p>
            <h2>Questions, answered</h2>
          </div>

          <div className="landing-faq" data-reveal>
            {FAQS.map((item, i) => {
              const open = openFaq === i;

              return (
                <div className={`landing-faq-item ${open ? "is-open" : ""}`} key={item.q}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`faq-answer-${i}`}
                      id={`faq-question-${i}`}
                      onClick={() => setOpenFaq(open ? -1 : i)}
                    >
                      {item.q}
                      <ChevronDown size={20} />
                    </button>
                  </h3>

                  <div
                    className="landing-faq-answer"
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                  >
                    <div>
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </section>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="landing-cta">

        <div
          className="landing-cta-bg"
          style={{ backgroundImage: `url(${ctaImage})` }}
          aria-hidden="true"
        />

        <div className="landing-container landing-cta-inner" data-reveal>
          <h2>Your next group adventure starts here</h2>

          <p>Set up your group in minutes and see where you could go.</p>

          <div className="landing-hero-actions">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Create your account
              <ArrowRight size={18} />
            </Link>

            <Link to="/login" className="landing-btn landing-btn-glass landing-btn-lg">
              I already have an account
            </Link>
          </div>
        </div>

      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="landing-footer">

        <div className="landing-container landing-footer-inner">

          <div>
            <a href="#top" className="landing-logo" aria-label="Roamio, back to top">
              <span className="landing-logo-icon">
                <Plane size={18} />
              </span>
              Roamio
            </a>

            <p>Plan a trip everyone in the group agrees on.</p>
          </div>

          <nav className="landing-footer-links" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
            <Link to="/login">Log in</Link>
            <Link to="/register">Sign up</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>

        </div>

        <div className="landing-container landing-footer-bottom">
          <span>© {new Date().getFullYear()} Roamio</span>
          <span>Photos from Unsplash</span>
        </div>

      </footer>

    </div>
  );
}
