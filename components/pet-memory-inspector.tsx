"use client";

import { useEffect, useState } from "react";

import type { PetMemoryItem, PetProfile } from "@/lib/types";

type Props = {
  pets: PetProfile[];
};

export function PetMemoryInspector({ pets }: Props) {
  const [selectedPetId, setSelectedPetId] = useState<string>(pets[0]?.id ?? "");
  const [memories, setMemories] = useState<PetMemoryItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!selectedPetId) {
      setMemories([]);
      return;
    }

    async function loadMemories() {
      setIsLoading(true);
      setStatus(null);

      try {
        const response = await fetch(`/api/pets/${selectedPetId}/memory`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          message?: string;
          memories?: PetMemoryItem[];
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "Unable to load memories.");
        }

        setMemories(payload.memories ?? []);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Unable to load memories."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMemories();
  }, [selectedPetId]);

  if (pets.length === 0) {
    return (
      <div className="memory-empty">
        Create a pet persona first, then the memory inspector can show what it
        has learned from conversation.
      </div>
    );
  }

  async function handleBath() {
    setIsClearing(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/pets/${selectedPetId}/memory`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to clear memories.");
      }

      setMemories([]);
      setStatus(payload.message ?? "Personality bath complete.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to clear memories."
      );
    } finally {
      setIsClearing(false);
    }
  }

  async function handleRefresh() {
    if (!selectedPetId) {
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/pets/${selectedPetId}/memory`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        message?: string;
        memories?: PetMemoryItem[];
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to load memories.");
      }

      setMemories(payload.memories ?? []);
      setStatus("Refreshed learned memories.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to load memories."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="memory-shell">
      <div className="memory-toolbar">
        <label className="memory-label">
          Pet persona
          <select
            onChange={(event) => setSelectedPetId(event.target.value)}
            value={selectedPetId}
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.petName} the {pet.animalType}
              </option>
            ))}
          </select>
        </label>

        <button
          className="secondary-button"
          disabled={isClearing || isLoading}
          onClick={handleRefresh}
          type="button"
        >
          Refresh memories
        </button>

        <button
          className="secondary-button"
          disabled={isClearing || isLoading}
          onClick={handleBath}
          type="button"
        >
          {isClearing ? "Bathing..." : "Give personality bath"}
        </button>
      </div>

      <p className="helper-text">
        Learned memories come only from what the owner tells the pet or what the
        conversation establishes over time.
      </p>

      {status ? <div className="status-banner">{status}</div> : null}

      {isLoading ? (
        <div className="memory-empty">Loading learned memories...</div>
      ) : memories.length === 0 ? (
        <div className="memory-empty">
          No long-term memories yet. Teach the pet a few stable facts and they
          will appear here.
        </div>
      ) : (
        <div className="memory-grid">
          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <p className="memory-key">
                {memory.subject}.{memory.key}
              </p>
              <p className="memory-value">{memory.value}</p>
              <p className="memory-meta">
                {memory.category} · {memory.source} · confidence{" "}
                {memory.confidence.toFixed(2)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
