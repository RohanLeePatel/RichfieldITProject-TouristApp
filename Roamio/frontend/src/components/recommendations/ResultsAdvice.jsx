import { Lightbulb, Scale, Wallet, Accessibility as AccessibilityIcon } from "lucide-react";

// The Weather page's "Advice for your trip" panel is the best thing on the
// site because it turns readings into a decision ("a packable rain jacket is
// worth the space"). Results had no equivalent: they reported what matched and
// left the traveller to work out what to do about it.
//
// Everything here is derived from the response already on screen - nothing is
// fetched, and nothing is claimed that the data cannot support.

const MEANINGFUL_SCORE_GAP = 0.03;

export function buildAdvice(data) {
  const tips = [];
  const results = data.results || [];
  const excluded = data.excluded || [];

  // Gates name the requirement that stopped a candidate, so these counts are
  // read off the engine's own reasons rather than guessed at.
  const overBudget = excluded.filter((item) => /budget/i.test(item.reason)).length;
  const inaccessible = excluded.filter((item) => /wheelchair|accessib/i.test(item.reason)).length;

  if (overBudget >= 3) {
    tips.push({
      id: "budget",
      icon: Wallet,
      text: `${overBudget} destinations were ruled out on daily cost alone. Nudging your budget up would bring them back into the running.`,
    });
  }

  if (inaccessible >= 2) {
    tips.push({
      id: "access",
      icon: AccessibilityIcon,
      text: `${inaccessible} destinations were ruled out on step-free access. They are still listed below if you want to look anyway.`,
    });
  }

  // A tight cluster at the top is a real finding: the ranking is not telling
  // the traveller much, and comparing beats trusting the order.
  if (results.length >= 3) {
    const top = results[0].total_score;
    const close = results.filter((item) => top - item.total_score < MEANINGFUL_SCORE_GAP);
    if (close.length >= 3) {
      tips.push({
        id: "cluster",
        icon: Scale,
        text: `Your top ${close.length} are within ${Math.round(MEANINGFUL_SCORE_GAP * 100)}% of each other, so the order between them means little. Shortlist a few and compare them side by side.`,
      });
    }
  }

  if (results.length > 0 && results.length < 3) {
    tips.push({
      id: "thin",
      icon: Lightbulb,
      text: `Only ${results.length} destination${results.length === 1 ? "" : "s"} cleared your requirements. Relaxing one of them would widen the search.`,
    });
  }

  return tips;
}

export default function ResultsAdvice({ data }) {
  const tips = buildAdvice(data);
  if (tips.length === 0) return null;

  return (
    <aside className="results-advice" aria-label="What to do next">
      <p className="results-advice-title">
        <Lightbulb size={15} /> What this means for your trip
      </p>
      <ul>
        {tips.map(({ id, icon: Icon, text }) => (
          <li key={id}>
            <Icon size={15} aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
