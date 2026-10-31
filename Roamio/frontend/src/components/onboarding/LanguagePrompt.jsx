import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages } from "lucide-react";

import { fetchMe, updateMe } from "../../api/account.js";
import { useAuthStore } from "../../store/authStore.js";
import useTips from "../../store/tipsStore.js";
import { LANGUAGES, baseCode } from "../../utils/translatorHelpers";
import "../../styles/onboarding.css";

// One-time Dashboard note asking which language to translate into (place names
// on the recommendations pages, and the Translator's default). English is
// already the default, so "Keep English" just dismisses it. It stays away from
// anyone who has already chosen another language in Settings.
export default function LanguagePrompt() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const { has, mark } = useTips();
  const [choice, setChoice] = useState("EN-GB");
  const [error, setError] = useState("");

  const { data: me } = useQuery({ queryKey: ["me", userId], queryFn: fetchMe, enabled: userId != null, staleTime: 5 * 60_000 });

  const save = useMutation({
    mutationFn: () => updateMe({ preferences: { language: choice } }),
    onSuccess: () => {
      queryClient.setQueryData(["me", userId], (old) => ({ ...old, preferences: { ...old?.preferences, language: choice } }));
      mark("tip:language");
    },
    onError: (err) => setError(err.message || "We couldn't save that. Please try again."),
  });

  const saved = baseCode(me?.preferences?.language || "EN");
  if (!me || has("tip:language") || saved !== "EN") return null;

  return (
    <aside className="tip tip-language" role="note" aria-label="Choose your language">
      <Languages size={18} aria-hidden="true" />
      <div className="tip-body">
        <p>
          <strong>Which language should we translate into?</strong> We use it for place names on your recommendations and as the Translator&apos;s default. It&apos;s English (British) for now, so you can keep that. You can change it any time in Settings.
        </p>
        <div className="tip-controls">
          <select
            aria-label="Language to translate into"
            value={choice}
            onChange={(event) => {
              setChoice(event.target.value);
              setError("");
            }}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>{language.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending || choice === "EN-GB"}>
            {save.isPending ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => mark("tip:language")} disabled={save.isPending}>Keep English</button>
        </div>
        {error && <p role="alert" className="tip-error">{error}</p>}
      </div>
    </aside>
  );
}
