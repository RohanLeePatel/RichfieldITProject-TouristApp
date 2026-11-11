import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile for sign-up. Shown only when VITE_TURNSTILE_SITE_KEY is
// set (the backend checks the token with its TURNSTILE_SECRET_KEY). Tokens are
// single-use and last 5 minutes, so the parent bumps resetKey after any failed
// submit to get a fresh one.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
export const captchaEnabled = Boolean(SITE_KEY);

let scriptPromise = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      scriptPromise = null; // let "Try again" load it afresh
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const MESSAGES = {
  expired: "The check expired. Complete it again to continue.",
  error: "The check couldn't be completed.",
  unavailable: "The check couldn't load. Check your connection.",
};

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const box = useRef(null);
  const widgetId = useRef(null);
  const tokenHandler = useRef(onToken);
  const [status, setStatus] = useState("loading"); // loading | done | expired | error | unavailable
  const [attempt, setAttempt] = useState(0); // bumped by "Try again" when the script itself failed

  useEffect(() => {
    tokenHandler.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    const clear = (next) => {
      setStatus(next);
      tokenHandler.current("");
    };
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current) return;
        widgetId.current = turnstile.render(box.current, {
          sitekey: SITE_KEY,
          action: "register",
          callback: (token) => {
            setStatus("done");
            tokenHandler.current(token);
          },
          "expired-callback": () => clear("expired"),
          "timeout-callback": () => clear("expired"),
          "error-callback": () => clear("error"),
        });
      })
      .catch(() => !cancelled && clear("unavailable"));
    return () => {
      cancelled = true;
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [attempt]);

  const retry = () => {
    tokenHandler.current("");
    setStatus("loading");
    if (widgetId.current != null) window.turnstile.reset(widgetId.current);
    else setAttempt((n) => n + 1);
  };

  // the parent's "that token was refused" signal: start a fresh challenge
  useEffect(() => {
    if (resetKey && widgetId.current != null) {
      window.turnstile.reset(widgetId.current);
      tokenHandler.current("");
    }
  }, [resetKey]);

  const message = MESSAGES[status];
  return (
    <div className="captcha-check">
      <div ref={box} />
      {message && (
        <p className="captcha-message" role="alert">
          {message}{" "}
          <button type="button" className="captcha-retry" onClick={retry}>Try again</button>
        </p>
      )}
    </div>
  );
}
