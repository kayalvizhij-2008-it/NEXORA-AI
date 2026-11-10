import { Bot, Sparkles } from "lucide-react";
import type { Assistant, ChatEntry } from "../types";

export function ChatInterface({ messages, assistant, progress }: {
  messages: ChatEntry[];
  assistant?: Assistant;
  progress: string;
}) {
  return (
    <div className="chat-log" aria-live="polite">
      {!messages.length && (
        <div className="chat-welcome">
          <div className="hero-mark"><Sparkles size={24} /></div>
          <h2>What would you like your agents to do?</h2>
          <p>Choose an assistant, describe the task, and watch its actual graph execution unfold.</p>
        </div>
      )}
      {messages.map((message) => (
        <article className={`chat-message message-${message.role}`} key={message.id}>
          <span className={`message-avatar ${message.role === "user" ? "user-avatar" : ""}`}>
            {message.role === "user" ? "You" : <Bot size={17} />}
          </span>
          <div className="message-body">
            <div className="message-label">
              {message.role === "user" ? "YOU" : message.assistant || assistant?.name || "ASSISTANT"}
              {message.status === "running" && <span className="running-inline"><span className="typing-indicator"><i /><i /><i /></span>{progress || "Working"}</span>}
            </div>
            <p>{message.content || (message.status === "running" ? <span className="typing-indicator"><i /><i /><i /></span> : "")}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
