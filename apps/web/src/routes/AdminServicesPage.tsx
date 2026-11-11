import type { AdminServiceDto, ServiceCategory } from "@nailsbychao/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useAdminServices } from "@/features/admin/api";
import { adminFormError } from "@/features/admin/errors";
import { normalizeSlug } from "@/features/admin/slug";
import {
  Field,
  fieldClass,
  Notice,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/admin/ui";
import { apiFetch } from "@/lib/api";
import { formatDuration, formatPrice } from "@/lib/format";

type Draft = {
  name: string;
  slug: string;
  description: string;
  category: ServiceCategory;
  durationMinutes: string;
  priceKes: string;
  displayOrder: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  name: "",
  slug: "",
  description: "",
  category: "nails",
  durationMinutes: "60",
  priceKes: "",
  displayOrder: "0",
  isActive: true,
};

function toBody(draft: Draft) {
  return {
    name: draft.name.trim(),
    slug: normalizeSlug(draft.slug),
    description: draft.description.trim() || null,
    category: draft.category,
    durationMinutes: Number(draft.durationMinutes),
    priceMinor: Math.round(Number(draft.priceKes) * 100),
    displayOrder: Number(draft.displayOrder),
    isActive: draft.isActive,
    currency: "KES",
  };
}

export function AdminServicesPage() {
  const query = useAdminServices();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/admin/services", {
        auth: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(draft)),
      });
      setDraft(EMPTY);
      setFormKey((key) => key + 1);
      setMessage("Service created.");
      await queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (caught) {
      setError(adminFormError(caught, "The service was not saved."));
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Services</h1>
      <Panel title="New service">
        <form onSubmit={create} className="grid gap-3">
          <ServiceFields key={formKey} draft={draft} onChange={setDraft} autoSlug />
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="ok">{message}</Notice> : null}
          <button type="submit" className={primaryButtonClass}>
            Create service
          </button>
        </form>
      </Panel>
      {query.isPending ? <p className="text-muted">Loading services…</p> : null}
      {query.isError ? <Notice tone="error">Couldn't load services.</Notice> : null}
      <ul className="grid gap-3">
        {query.data?.items.map((service) => (
          <ServiceEditor key={service.id} service={service} />
        ))}
      </ul>
    </>
  );
}

function ServiceFields({
  draft,
  onChange,
  autoSlug = false,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  autoSlug?: boolean;
}) {
  const [slugEdited, setSlugEdited] = useState(!autoSlug);

  function setName(name: string) {
    onChange({
      ...draft,
      name,
      slug: slugEdited ? draft.slug : normalizeSlug(name),
    });
  }

  function setSlug(slug: string) {
    setSlugEdited(true);
    onChange({ ...draft, slug });
  }

  return (
    <>
      <Field label="Name">
        <input
          className={fieldClass}
          required
          value={draft.name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Slug">
        <input
          className={fieldClass}
          required
          value={draft.slug}
          onChange={(event) => setSlug(event.target.value)}
        />
      </Field>
      <Field label="Description">
        <textarea
          className={`${fieldClass} py-2`}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </Field>
      <Field label="Category">
        <select
          className={fieldClass}
          value={draft.category}
          onChange={(event) =>
            onChange({ ...draft, category: event.target.value as ServiceCategory })
          }
        >
          <option value="nails">Nails</option>
          <option value="makeup">Makeup</option>
        </select>
      </Field>
      <Field label="Duration (minutes)">
        <input
          className={fieldClass}
          type="number"
          min={1}
          required
          value={draft.durationMinutes}
          onChange={(event) => onChange({ ...draft, durationMinutes: event.target.value })}
        />
      </Field>
      <Field label="Price (KES)">
        <input
          className={fieldClass}
          type="number"
          min={0}
          step="1"
          required
          value={draft.priceKes}
          onChange={(event) => onChange({ ...draft, priceKes: event.target.value })}
        />
      </Field>
      <Field label="Display order">
        <input
          className={fieldClass}
          type="number"
          min={0}
          required
          value={draft.displayOrder}
          onChange={(event) => onChange({ ...draft, displayOrder: event.target.value })}
        />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
        />
        Active for new bookings
      </label>
    </>
  );
}

function ServiceEditor({ service }: { service: AdminServiceDto }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({
    name: service.name,
    slug: service.slug,
    description: service.description ?? "",
    category: service.category,
    durationMinutes: String(service.durationMinutes),
    priceKes: String(service.priceMinor / 100),
    displayOrder: String(service.displayOrder),
    isActive: service.isActive,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const body = toBody(draft);
      await apiFetch(`/admin/services/${encodeURIComponent(service.id)}`, {
        auth: true,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDraft({ ...draft, slug: body.slug });
      setMessage("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (caught) {
      setError(adminFormError(caught, "The service was not saved."));
    }
  }

  return (
    <li>
      <details className="rounded-card border border-border bg-surface p-4">
        <summary className="cursor-pointer font-semibold">
          {service.name}
          <span className="ml-2 text-sm font-normal text-muted">
            {formatPrice(service.priceMinor, service.currency)} ·{" "}
            {formatDuration(service.durationMinutes)}
            {service.isActive ? "" : " · inactive"}
          </span>
        </summary>
        <form onSubmit={save} className="mt-4 grid gap-3">
          <ServiceFields draft={draft} onChange={setDraft} />
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="ok">{message}</Notice> : null}
          <button type="submit" className={secondaryButtonClass}>
            Save changes
          </button>
        </form>
      </details>
    </li>
  );
}
