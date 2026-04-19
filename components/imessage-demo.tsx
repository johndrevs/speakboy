"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import type { PetMemoryItem, PetProfile, ThreadMessage } from "@/lib/types";

type Props = {
  pets: PetProfile[];
};

const defaultFromNumber = "+13125550000";

export function IMessageDemo({ pets }: Props) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string>(pets[0]?.id ?? "");
  const [fromNumber, setFromNumber] = useState(defaultFromNumber);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ThreadMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [replySource, setReplySource] = useState<"openai" | "fallback" | null>(
    null
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastExtractedMemories, setLastExtractedMemories] = useState<
    Array<
      Pick<
        PetMemoryItem,
        "category" | "subject" | "key" | "value" | "source" | "confidence"
      >
    >
  >([]);

  useEffect(() => {
    if (!threadRef.current) {
      return;
    }

    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [history]);

  if (pets.length === 0) {
    return (
      <div className="iphone-demo-empty">
        Create a pet persona first so the iMessage demo has someone to text.
      </div>
    );
  }

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0];

  useEffect(() => {
    async function loadHistory() {
      setIsLoadingHistory(true);
      setMessage("");
      setReplySource(null);
      setLastExtractedMemories([]);
      setStatus(null);

      try {
        const params = new URLSearchParams({
          petId: selectedPet.id,
          fromNumber
        });
        const response = await fetch(`/api/simulate?${params.toString()}`);
        const payload = (await response.json()) as {
          message?: string;
          history?: ThreadMessage[];
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "Unable to load simulated thread.");
        }

        setHistory(payload.history ?? []);
      } catch (error) {
        setHistory([]);
        setStatus(
          error instanceof Error ? error.message : "Unable to load simulated thread."
        );
      } finally {
        setIsLoadingHistory(false);
      }
    }

    void loadHistory();
  }, [selectedPet.id, fromNumber]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    const outgoingMessage = message;
    const optimisticHistory: ThreadMessage[] = [
      ...history,
      {
        role: "user",
        body: outgoingMessage
      }
    ];

    setHistory(optimisticHistory);
    setIsSending(true);
    setStatus(null);
    setReplySource(null);
    setLastExtractedMemories([]);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          petId: selectedPet.id,
          fromNumber,
          message: outgoingMessage
        })
      });

      const payload = (await response.json()) as {
        message?: string;
        replySource?: "openai" | "fallback";
        history?: ThreadMessage[];
        extractedMemoryCount?: number;
        savedMemoryCount?: number;
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
      setMessage("");
      setReplySource(payload.replySource ?? null);
      setLastExtractedMemories(payload.extractedMemories ?? []);
      setStatus(payload.message ?? "Sent.");
    } catch (error) {
      setHistory((current) =>
        current.filter(
          (entry, index) =>
            !(
              index === current.length - 1 &&
              entry.role === "user" &&
              entry.body === outgoingMessage
            )
        )
      );
      setStatus(
        error instanceof Error ? error.message : "Unable to simulate message."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleResetThread() {
    setIsSending(true);
    setStatus(null);
    setReplySource(null);
    setLastExtractedMemories([]);

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
      setMessage("");
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
            <button
              aria-label="Reset current thread"
              className="imessage-reset-button"
              disabled={isSending}
              onClick={handleResetThread}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="imessage-thread" ref={threadRef}>
          {isLoadingHistory ? (
            <div className="imessage-empty">
              <p>Loading</p>
              <span>Pulling the existing thread into view.</span>
            </div>
          ) : history.length === 0 ? (
            <div className="imessage-empty">
              <p>Today</p>
              <span>
                Start the thread by sending {selectedPet.petName} a text.
              </span>
            </div>
          ) : (
            history.map((entry, index) => (
              <div
                className={`imessage-row ${entry.role === "assistant" ? "incoming" : "outgoing"}`}
                key={`${entry.role}-${index}-${entry.body}`}
              >
                <div
                  className={`imessage-bubble ${entry.role === "assistant" ? "incoming" : "outgoing"}`}
                >
                  {entry.body}
                </div>
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
        {status ? (
          <div className="imessage-status-toast">
            {status}
            {replySource
              ? ` (${replySource === "openai" ? "OpenAI" : "Fallback"})`
              : ""}
            {lastExtractedMemories.length > 0
              ? ` Learned: ${lastExtractedMemories
                  .map((memory) => `${memory.subject}.${memory.key}`)
                  .join(", ")}`
              : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
