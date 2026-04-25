"use client";

import { FormEvent, useEffect, useState } from "react";

import type { PetMemoryItem, PetProfile, ThreadMessage } from "@/lib/types";

type Props = {
  pets: PetProfile[];
};

const defaultFromNumber = "+13125550000";

export function SmsSimulator({ pets }: Props) {
  const [selectedPetId, setSelectedPetId] = useState<string>(pets[0]?.id ?? "");
  const [fromNumber, setFromNumber] = useState(defaultFromNumber);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ThreadMessage[]>([]);
  const [replyPreview, setReplyPreview] = useState<string | null>(null);
  const [replySource, setReplySource] = useState<"openai" | "fallback" | null>(
    null
  );
  const [extractedMemories, setExtractedMemories] = useState<
    Array<
      Pick<
        PetMemoryItem,
        "category" | "subject" | "key" | "value" | "source" | "confidence"
      >
    >
  >([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setHistory([]);
    setReplyPreview(null);
    setReplySource(null);
    setExtractedMemories([]);
    setStatus(null);
  }, [selectedPetId]);

  if (pets.length === 0) {
    return (
      <div className="simulator-empty">
        Create a pet persona first, then use the simulator to test a mock SMS
        conversation without Twilio.
      </div>
    );
  }

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0];
  const threadKey = `${fromNumber}:${selectedPet.twilioNumber}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setStatus(null);
    setReplyPreview(null);
    setReplySource(null);
    setExtractedMemories([]);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          petId: selectedPet.id,
          fromNumber,
          message
        })
      });

      const payload = (await response.json()) as {
        message?: string;
        reply?: string;
        replySource?: "openai" | "fallback";
        replyFallbackReason?: "missing_api_key" | "empty_output" | "openai_error" | null;
        replyErrorMessage?: string | null;
        history?: ThreadMessage[];
        extractedMemories?: Array<
          Pick<
            PetMemoryItem,
            "category" | "subject" | "key" | "value" | "source" | "confidence"
          >
        >;
      };

      if (!response.ok || !payload.history) {
        throw new Error(payload.message ?? "Unable to simulate message.");
      }

      setHistory(payload.history);
      setReplyPreview(payload.reply ?? null);
      setReplySource(payload.replySource ?? null);
      setExtractedMemories(payload.extractedMemories ?? []);
      setStatus(
        payload.message ??
          (payload.replySource === "fallback"
            ? `Fallback reply used (${payload.replyFallbackReason ?? "unknown_reason"}${payload.replyErrorMessage ? `: ${payload.replyErrorMessage}` : ""}).`
            : "Simulated SMS exchange created.")
      );
      setMessage("");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Unable to simulate message.";
      setStatus(nextMessage);
    } finally {
      setIsSending(false);
    }
  }

  async function handleResetThread() {
    setIsSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/simulate/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          petId: selectedPet.id,
          fromNumber
        })
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to reset thread.");
      }

      setHistory([]);
      setReplyPreview(null);
      setReplySource(null);
      setExtractedMemories([]);
      setStatus(payload.message ?? "Thread reset.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to reset thread."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="simulator-shell">
      <form className="simulator-form" onSubmit={handleSubmit}>
        <label>
          Pet persona
          <select
            onChange={(event) => setSelectedPetId(event.target.value)}
            value={selectedPet.id}
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.petName} the {pet.animalType}
              </option>
            ))}
          </select>
        </label>

        <label>
          Simulated sender number
          <input
            onChange={(event) => setFromNumber(event.target.value)}
            required
            value={fromNumber}
          />
        </label>

        <label>
          Incoming text
          <textarea
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Text ${selectedPet.petName} something...`}
            required
            value={message}
          />
        </label>

        <button disabled={isSending} type="submit">
          {isSending ? "Simulating..." : "Send simulated SMS"}
        </button>
        <button
          className="secondary-button"
          disabled={isSending}
          onClick={handleResetThread}
          type="button"
        >
          Reset thread
        </button>

        <p className="helper-text">
          This uses the same persona reply engine and message history logic as
          the Twilio webhook, but keeps the demo fully inside SpeakBoy.
        </p>
        <p className="helper-text">
          Active thread key: <code>{threadKey}</code>
        </p>

        {status ? <div className="status-banner">{status}</div> : null}
      </form>

      <div className="simulator-thread-card">
        <div className="simulator-thread-header">
          <div>
            <p className="section-label">Simulated thread</p>
            <h3>
              {selectedPet.petName} on SMS <span>{selectedPet.twilioNumber}</span>
            </h3>
          </div>
          <div className="simulator-preview-stack">
            {replySource ? (
              <p className="simulator-source-badge">
                Reply source: {replySource === "openai" ? "OpenAI" : "Fallback"}
              </p>
            ) : null}
            {replyPreview ? (
              <p className="simulator-preview">Latest reply: {replyPreview}</p>
            ) : null}
            {extractedMemories.length > 0 ? (
              <div className="simulator-memory-preview">
                {extractedMemories.map((memory) => (
                  <p key={`${memory.subject}-${memory.key}`}>
                    Learned {memory.subject}.{memory.key} = {memory.value} ({memory.source})
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="simulator-empty-thread">
            No simulated messages yet. Send a text to see how {selectedPet.petName} replies.
          </div>
        ) : (
          <div className="preview-thread simulator-thread">
            {history.map((entry, index) => (
              <div
                className={`bubble ${entry.role === "assistant" ? "outgoing" : "incoming"}`}
                key={`${entry.role}-${index}-${entry.body}`}
              >
                {entry.body}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
