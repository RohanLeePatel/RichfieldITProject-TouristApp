import { useQuery } from "@tanstack/react-query";

import { fetchMe } from "../../api/account.js";
import { useAuthStore } from "../../store/authStore.js";
import { LANGUAGES } from "../../utils/translatorHelpers";

// The translator language chosen in Settings ("Translate into"), as a DeepL
// target code. Older accounts hold a bare "en", so fall back to the closest one.
// Shares the ["me", userId] query with the sidebar, so it costs no extra request.
export default function useDefaultLanguage() {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: me } = useQuery({ queryKey: ["me", userId], queryFn: fetchMe, enabled: userId != null, staleTime: 5 * 60_000 });
  const pref = String(me?.preferences?.language || "").toUpperCase();
  const match = LANGUAGES.find((l) => l.code === pref) || LANGUAGES.find((l) => l.code.split("-")[0] === pref);
  return match || LANGUAGES.find((l) => l.code === "EN-GB");
}
