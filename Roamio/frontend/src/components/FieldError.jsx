// The message under a field that failed its check; renders nothing when fine.
// Pair it with aria-invalid and aria-describedby={id} on the input.
export default function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" style={{ color: "#e05252", fontSize: "0.75rem", lineHeight: "1.5", margin: "6px 0 0" }}>
      {message}
    </p>
  );
}
