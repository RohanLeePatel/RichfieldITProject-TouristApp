import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { acceptTerms, fetchMe } from "../../api/account.js";
import { useAuthStore } from "../../store/authStore.js";
import "../../styles/onboarding.css";

// Shown over a signed-in page to anyone who hasn't agreed to the wording of the
// Terms and Privacy Policy now in force (accounts made before consent was
// recorded, and everyone again after the wording changes). The server decides:
// /users/me says which version the user agreed to and which is current.
// The gate can't be skipped. The only choices are to agree or to sign out.
export default function TermsGate() {
  const userId = useAuthStore((state) => state.user?.id);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agreeRef = useRef(null);
  const [error, setError] = useState("");

  const { data: me } = useQuery({ queryKey: ["me", userId], queryFn: fetchMe, enabled: userId != null, staleTime: 5 * 60_000 });
  const needed = Boolean(me?.currentTermsVersion) && me.termsVersion !== me.currentTermsVersion;

  const agree = useMutation({
    mutationFn: acceptTerms,
    onSuccess: ({ termsVersion }) => queryClient.setQueryData(["me", userId], (old) => ({ ...old, termsVersion })),
    onError: (err) => setError(err.message || "We couldn't save that. Please try again."),
  });

  useEffect(() => {
    if (needed) agreeRef.current?.focus();
  }, [needed]);

  if (!needed) return null;

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="terms-gate" role="presentation">
      <div className="terms-gate-card" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <h2 id="terms-gate-title">We&apos;ve updated our Terms and Privacy Policy</h2>
        <p>
          Please read and agree to continue using Roamio. The Privacy Policy now lists the services that handle your
          information, including Google for the trip assistant, and explains how to ask us to delete your data.
        </p>
        <p>
          <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</Link>
          {" · "}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
        </p>

        {error && <p className="terms-gate-error" role="alert">{error}</p>}

        <div className="terms-gate-actions">
          <button type="button" className="terms-gate-secondary" onClick={signOut} disabled={agree.isPending}>
            Sign out
          </button>
          <button
            type="button"
            ref={agreeRef}
            className="terms-gate-primary"
            onClick={() => {
              setError("");
              agree.mutate();
            }}
            disabled={agree.isPending}
          >
            {agree.isPending ? "Saving..." : "I agree"}
          </button>
        </div>
      </div>
    </div>
  );
}
