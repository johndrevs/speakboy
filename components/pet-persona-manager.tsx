"use client";

import { FormEvent, useMemo, useState } from "react";

import type { PetProfile } from "@/lib/types";

type PetFormValues = {
  ownerName: string;
  petName: string;
  animalType: string;
  personaStyle: string;
  backstory: string;
  twilioNumber: string;
};

const initialState: PetFormValues = {
  ownerName: "",
  petName: "",
  animalType: "",
  personaStyle: "",
  backstory: "",
  twilioNumber: ""
};

type Props = {
  initialPets: PetProfile[];
};

export function PetPersonaManager({ initialPets }: Props) {
  const [pets, setPets] = useState(initialPets);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PetFormValues>(initialState);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = editingPetId !== null;
  const submitLabel = useMemo(() => {
    if (isSaving) {
      return isEditing ? "Saving changes..." : "Saving pet...";
    }

    return isEditing ? "Update pet persona" : "Create pet thread";
  }, [isEditing, isSaving]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const endpoint = editingPetId ? `/api/pets/${editingPetId}` : "/api/pets";
      const method = editingPetId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      const payload = (await response.json()) as {
        message?: string;
        profile?: PetProfile;
      };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.message ?? "Unable to save pet.");
      }

      setPets((current) => {
        const nextPets = current.filter((pet) => pet.id !== payload.profile?.id);
        return [payload.profile as PetProfile, ...nextPets];
      });
      setStatus(payload.message ?? "Pet saved.");
      setFormData(initialState);
      setEditingPetId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save pet.";
      setStatus(message);
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(pet: PetProfile) {
    setEditingPetId(pet.id);
    setFormData({
      ownerName: pet.ownerName,
      petName: pet.petName,
      animalType: pet.animalType,
      personaStyle: pet.personaStyle,
      backstory: pet.backstory,
      twilioNumber: pet.twilioNumber
    });
    setStatus(`Editing ${pet.petName}.`);
  }

  function cancelEditing() {
    setEditingPetId(null);
    setFormData(initialState);
    setStatus("Edit cancelled.");
  }

  return (
    <div className="persona-manager">
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Owner name
          <input
            name="ownerName"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                ownerName: event.target.value
              }))
            }
            placeholder="Avery"
            required
            value={formData.ownerName}
          />
        </label>

        <label>
          Pet name
          <input
            name="petName"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                petName: event.target.value
              }))
            }
            placeholder="Mochi"
            required
            value={formData.petName}
          />
        </label>

        <label>
          Animal type
          <input
            name="animalType"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                animalType: event.target.value
              }))
            }
            placeholder="Dog"
            required
            value={formData.animalType}
          />
        </label>

        <label>
          Persona style
          <input
            name="personaStyle"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                personaStyle: event.target.value
              }))
            }
            placeholder="Overly sincere, dramatic, convinced socks are prey"
            required
            value={formData.personaStyle}
          />
        </label>

        <label>
          Backstory and rules
          <textarea
            name="backstory"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                backstory: event.target.value
              }))
            }
            placeholder="Lives in Chicago, loves window duty, never uses hashtags, avoids anything mean."
            required
            value={formData.backstory}
          />
        </label>

        <label>
          Twilio number
          <input
            name="twilioNumber"
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                twilioNumber: event.target.value
              }))
            }
            placeholder="+13125551212"
            required
            value={formData.twilioNumber}
          />
        </label>

        <div className="form-actions">
          <button disabled={isSaving} type="submit">
            {submitLabel}
          </button>
          {isEditing ? (
            <button
              className="secondary-button"
              onClick={cancelEditing}
              type="button"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <p className="helper-text">
          Next step: point your Twilio number&apos;s incoming message webhook at
          <code> /api/sms/webhook</code>.
        </p>

        {status ? <div className="status-banner">{status}</div> : null}
      </form>

      <div className="saved-pets-list">
        {pets.length === 0 ? (
          <div className="saved-pets-empty">
            No pet personas yet. Create one above, then point its Twilio number
            at <code>/api/sms/webhook</code>.
          </div>
        ) : (
          pets.map((pet) => (
            <article className="saved-pet-card" key={pet.id}>
              <div>
                <p className="saved-pet-name">
                  {pet.petName} <span>the {pet.animalType}</span>
                </p>
                <p className="saved-pet-meta">
                  Owner: {pet.ownerName} · Twilio: {pet.twilioNumber}
                </p>
              </div>
              <p className="saved-pet-description">{pet.personaStyle}</p>
              <p className="saved-pet-description">{pet.backstory}</p>
              <div className="saved-pet-actions">
                <button onClick={() => startEditing(pet)} type="button">
                  Edit persona
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
