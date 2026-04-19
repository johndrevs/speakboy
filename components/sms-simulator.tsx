"use client";

import { FormEvent, useEffect, useState } from "react";

import type { PetProfile, ThreadMessage } from "@/lib/types";

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
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setHistory([]);
    setReplyPreview(null);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setStatus(null);
    setReplyPreview(null);

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
        history?: ThreadMessage[];
      };

      if (!response.ok || !payload.history) {
        throw new Error(payload.message ?? "Unable to simulate message.");
      }

      setHistory(payload.history);
      setReplyPreview(payload.reply ?? null);
      setStatus(payload.message ?? "Simulated SMS exchange created.");
      setMessage("");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Unable to simulate message.";
      setStatus(nextMessage);
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

        <p className="helper-text">
          This uses the same persona reply engine and message history logic as
          the Twilio webhook, but keeps the demo fully inside SpeakBoy.
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
          {replyPreview ? (
            <p className="simulator-preview">Latest reply: {replyPreview}</p>
          ) : null}
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
