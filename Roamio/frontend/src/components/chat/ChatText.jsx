// The assistant answers in light Markdown (bullets, numbered lists, **bold**).
// This draws just those as React elements - never as HTML - so a reply can't
// inject markup, and anything else stays plain text.

import { Link } from "react-router-dom";

// Links the assistant may point to - app pages only, never an outside address
// or a path it made up. Anything else is shown as plain text.
const APP_PATH = /^\/(trips(\/\d+(\?tab=(plan|safety|money|people|documents))?)?|weather|calendar|dashboard|translator\?[\w%.~+=&-]*)$/;

const bold = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part
  );

// [label](/path) -> an in-app link, then **bold** inside everything else
const inline = (text) =>
  text.split(/(\[[^\]]{1,80}\]\(\/[^)\s]{0,300}\))/g).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
    if (!link) return <span key={index}>{bold(part)}</span>;
    return APP_PATH.test(link[2]) ? (
      <Link key={index} className="chat-inline-link" to={link[2]}>{link[1]}</Link>
    ) : (
      <span key={index}>{link[1]}</span>
    );
  });

function toBlocks(text) {
  const blocks = [];
  let gap = true; // a blank line starts a new paragraph

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      gap = true;
      continue;
    }

    const bullet = line.match(/^\s*[*-]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    const heading = line.match(/^\s*#{1,6}\s+(.*)/);
    const last = blocks[blocks.length - 1];

    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      const item = (bullet || numbered)[1];
      if (last?.type === type) last.items.push(item);
      else blocks.push({ type, items: [item] });
      gap = false;
    } else if (heading) {
      blocks.push({ type: "p", lines: [`**${heading[1].replace(/\*\*/g, "")}**`] });
      gap = true;
    } else if (last?.type === "p" && !gap) {
      last.lines.push(line.trim());
    } else {
      blocks.push({ type: "p", lines: [line.trim()] });
      gap = false;
    }
  }
  return blocks;
}

export default function ChatText({ text }) {
  return toBlocks(text).map((block, index) => {
    if (block.type === "p") {
      return (
        <p key={index}>
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {inline(line)}
            </span>
          ))}
        </p>
      );
    }
    const List = block.type;
    return (
      <List key={index}>
        {block.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </List>
    );
  });
}
