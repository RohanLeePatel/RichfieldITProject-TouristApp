import ChatPanel from "../components/chat/ChatPanel.jsx";
import "../styles/chat.css";

export default function Chat() {
  return (
    <main className="chat-page">
      <h1>Trip assistant</h1>
      <ChatPanel showHistory />
    </main>
  );
}
