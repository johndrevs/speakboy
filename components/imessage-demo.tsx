"use client";

import { FormEvent, useEffect, useState } from "react";

import type { PetProfile, ThreadMessage } from "@/lib/types";

type Props = {
  pets: PetProfile[];
};

const defaultFromNumber = "+13125550000";

export function IMessageDemo({ pets }: Props) {
  const [selectedPetId, setSelectedPetId] = useState<string>(pets[0]?.id ?? "");
  const [fromNumber, setFromNumber] = useState(defaultFromNumber);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ThreadMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setHistory([]);
    setMessage("");
    setStatus(null);
  }, [selectedPetId]);

  if (pets.length === 0) {
    return (
      <div className="iphone-demo-empty">
        Create a pet persona first so the iMessage demo has someone to text.
      </div>
    );
  }

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    setIsSending(true);
    setStatus(null);

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
        history?: ThreadMessage[];
      };

      if (!response.ok || !payload.history) {
        throw new Error(payload.message ?? "Unable to simulate message.");
      }

      setHistory(payload.history);
      setMessage("");
      setStatus(payload.message ?? "Sent.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to simulate message."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="imessage-app-shell">
      <div className="imessage-screen">
        <div className="imessage-statusbar">
          <span>9:41</span>
          <span>5G</span>
        </div>

        <div className="imessage-header">
          <div className="imessage-header-top">Messages</div>
          <div className="imessage-contact">
            <div className="imessage-avatar">{selectedPet.petName[0]}</div>
            <div className="imessage-contact-meta">
              <select
                aria-label="Select pet conversation"
                className="imessage-pet-select"
                onChange={(event) => setSelectedPetId(event.target.value)}
                value={selectedPet.id}
              >
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.petName}
                  </option>
                ))}
              </select>
              <span>{selectedPet.twilioNumber}</span>
            </div>
          </div>
        </div>

        <div className="imessage-thread">
          {history.length === 0 ? (
            <div className="imessage-empty">
              <p>Today</p>
              <span>
                Start the thread by sending {selectedPet.petName} a text.
              </span>
            </div>
          ) : (
            history.map((entry, index) => (
              <div
                className={`imessage-bubble ${entry.role === "assistant" ? "incoming" : "outgoing"}`}
                key={`${entry.role}-${index}-${entry.body}`}
              >
                {entry.body}
              </div>
            ))
          )}
        </div>

        <form className="imessage-composer" onSubmit={handleSubmit}>
          <input
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`Text ${selectedPet.petName}...`}
            value={message}
          />
          <button disabled={isSending} type="submit">
            {isSending ? "..." : "↑"}
          </button>
        </form>

        <input
          aria-hidden="true"
          className="imessage-hidden-input"
          onChange={(event) => setFromNumber(event.target.value)}
          tabIndex={-1}
          value={fromNumber}
        />
        {status ? <div className="imessage-status-toast">{status}</div> : null}
      </div>
    </div>
  );
}
