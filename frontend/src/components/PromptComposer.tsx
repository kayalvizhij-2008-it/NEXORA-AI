import { ArrowRight, Bot, ChevronDown, LoaderCircle } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import type { Assistant } from "../types";

export function PromptComposer({ value, onChange, onSubmit, assistants, assistantId, onAssistantChange, busy }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  assistants: Assistant[];
  assistantId: string;
  onAssistantChange: (assistantId: string) => void;
  busy: boolean;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  return (
    <form className="composer" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="command-prompt">Describe the task for your agent</label>
      <textarea id="command-prompt" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Describe a task for your agent…" rows={3} disabled={busy || !assistants.length} onKeyDown={onKeyDown} />
      <div className="composer-footer">
        <label className="assistant-picker"><Bot size={15} /><select aria-label="Select assistant" value={assistantId} onChange={(event) => onAssistantChange(event.target.value)} disabled={!assistants.length}>{assistants.length ? assistants.map((assistant) => <option key={assistant.assistant_id} value={assistant.assistant_id}>{assistant.name}</option>) : <option value="">No assistants available</option>}</select><ChevronDown size={13} /></label>
        <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
        <button className="send-button" type="submit" disabled={!value.trim() || busy || !assistants.some((assistant) => assistant.assistant_id === assistantId)} aria-label="Submit task">{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}</button>
      </div>
    </form>
  );
}
