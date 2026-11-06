import type {
  AppointmentLocation,
  BookingDto,
  CreateBookingInput,
  ServiceDto,
} from "@nailsbychao/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatDay, formatTime } from "@/lib/datetime";
import { formatDuration, formatPrice } from "@/lib/format";
import { createBooking } from "./api";
import { CHANGE_POLICY } from "./policy";

export type BookingDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type FieldName = keyof BookingDetails;
type FieldErrors = Partial<Record<FieldName, string>>;

/** Matches the API limit on `customerNotes`. */
const NOTES_MAX = 500;
const FIELD_ORDER: FieldName[] = ["name", "phone", "email", "address", "notes"];
const API_FIELDS: Record<string, FieldName> = {
  customerName: "name",
  customerPhone: "phone",
  customerEmail: "email",
  address: "address",
  customerNotes: "notes",
};

type Props = {
  step: 1 | 2 | 3;
  service: ServiceDto;
  date: string;
  startAt: string;
  location: AppointmentLocation;
  details: BookingDetails;
  onDetailsChange: (details: BookingDetails) => void;
  onContinue: () => void;
  onBack: () => void;
  onShowDetails: () => void;
  onBooked: (booking: BookingDto) => void;
  onSlotTaken: () => void;
};

export function BookingForm({
  step,
  service,
  date,
  startAt,
  location,
  details,
  onDetailsChange,
  onContinue,
  onBack,
  onShowDetails,
  onBooked,
  onSlotTaken,
}: Props) {
  const queryClient = useQueryClient();
  const idempotencyKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocus = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: { body: CreateBookingInput; key: string }) =>
      createBooking(input.body, input.key),
    retry: false,
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ["availability", service.id] });
      onBooked(booking);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "slot_taken") {
        onSlotTaken();
        return;
      }
      if (error instanceof ApiError && error.code === "idempotency_conflict") {
        idempotencyKey.current = null;
      }
      const fieldErrors = error instanceof ApiError ? apiFieldErrors(error.details) : {};
      if (Object.keys(fieldErrors).length > 0) {
        revealFieldErrors(fieldErrors);
        return;
      }
      setFormError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  function update(field: FieldName, value: string) {
    const next = { ...details, [field]: value };
    onDetailsChange(next);
    if (errors[field]) setErrors({ ...errors, [field]: validateField(field, next, location) });
  }

  function checkField(field: FieldName) {
    setErrors({ ...errors, [field]: validateField(field, details, location) });
  }

  const focusFirstInvalid = useCallback((fieldErrors: FieldErrors) => {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#booking-${first}`)?.focus();
  }, []);

  function revealFieldErrors(fieldErrors: FieldErrors) {
    setErrors(fieldErrors);
    if (step === 2) {
      focusFirstInvalid(fieldErrors);
      return;
    }
    pendingFocus.current = true;
    onShowDetails();
  }

  useEffect(() => {
    if (step !== 2 || !pendingFocus.current) return;
    pendingFocus.current = false;
    focusFirstInvalid(errors);
  }, [step, errors, focusFirstInvalid]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1 || submitting.current) return;

    const nextErrors = validateAll(details, location);
    if (Object.keys(nextErrors).length > 0) {
      revealFieldErrors(nextErrors);
      return;
    }
    setErrors({});

    if (step === 2) {
      onContinue();
      return;
    }

    submitting.current = true;
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    setFormError(null);

    const body: CreateBookingInput = {
      serviceId: service.id,
      startAt,
      location,
      customerName: details.name.trim(),
      customerPhone: details.phone.trim(),
    };
    const email = details.email.trim();
    if (email) body.customerEmail = email;
    if (location === "house_call") body.address = details.address.trim();
    const notes = details.notes.trim();
    if (notes) body.customerNotes = notes;
    mutation.mutate({ body, key: idempotencyKey.current });
  }

  const where = location === "house_call" ? "House call" : "At the studio in Juja";

  if (step === 1) return null;

  function fieldProps(field: FieldName) {
    return {
      id: `booking-${field}`,
      value: details[field],
      error: errors[field],
      onChange: (value: string) => update(field, value),
      onBlur: () => checkField(field),
    };
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="grid gap-6 rounded-card border border-border bg-surface p-5"
    >
      {step === 2 ? (
        <>
          <p className="font-semibold">
            {formatDay(date)}, {formatTime(startAt)}{" "}
            <span className="font-normal text-muted">· {where}</span>
          </p>

          <FieldSet legend="How Chao reaches you">
            <TextField {...fieldProps("name")} label="Name" autoComplete="name" required />
            <TextField
              {...fieldProps("phone")}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint="A Kenyan number, like 0712 345 678. Chao will call or text this number."
              required
            />
            <TextField
              {...fieldProps("email")}
              label="Email"
              type="email"
              autoComplete="email"
              hint="Optional. Chao can reach you here as well."
            />
          </FieldSet>

          <FieldSet legend="About the appointment">
            {location === "house_call" && (
              <TextField
                {...fieldProps("address")}
                label="Address"
                autoComplete="street-address"
                hint="Where Chao should come, with any landmark or gate details."
                required
              />
            )}
            <NotesField {...fieldProps("notes")} />
          </FieldSet>
        </>
      ) : (
        <Review
          service={service}
          date={date}
          startAt={startAt}
          where={where}
          location={location}
          details={details}
        />
      )}

      {step === 3 && <p className="text-sm text-muted">{CHANGE_POLICY}</p>}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="grid gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {step === 2 ? "Continue" : mutation.isPending ? "Requesting…" : "Request booking"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={mutation.isPending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-5 font-semibold hover:border-accent disabled:opacity-60"
        >
          Back
        </button>
      </div>
    </form>
  );
}

function Review({
  service,
  date,
  startAt,
  where,
  location,
  details,
}: {
  service: ServiceDto;
  date: string;
  startAt: string;
  where: string;
  location: AppointmentLocation;
  details: BookingDetails;
}) {
  const email = details.email.trim();
  const notes = details.notes.trim();
  return (
    <dl className="grid gap-4">
      <ReviewItem label="Service">
        <span className="font-semibold">{service.name}</span>
        <span className="mt-1 block text-sm text-muted">
          {formatPrice(service.priceMinor, service.currency)} ·{" "}
          {formatDuration(service.durationMinutes)}
        </span>
      </ReviewItem>
      <ReviewItem label="When">
        {formatDay(date)}, {formatTime(startAt)}
        <span className="font-normal text-muted"> · Nairobi time</span>
      </ReviewItem>
      <ReviewItem label="Where">
        {where}
        {location === "house_call" && (
          <span className="mt-1 block text-sm text-muted">{details.address.trim()}</span>
        )}
      </ReviewItem>
      <ReviewItem label="Contact">
        <span className="block">{details.name.trim()}</span>
        <span className="block">{details.phone.trim()}</span>
        {email && <span className="block">{email}</span>}
      </ReviewItem>
      {notes && <ReviewItem label="Notes">{notes}</ReviewItem>}
    </dl>
  );
}

function ReviewItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function validateField(
  field: FieldName,
  details: BookingDetails,
  location: AppointmentLocation,
): string | undefined {
  const value = details[field].trim();
  switch (field) {
    case "name":
      return value ? undefined : "Enter your name.";
    case "phone":
      if (!value) return "Enter your phone number.";
      return isKenyanPhone(value) ? undefined : "Use a Kenyan phone number, like 0712 345 678.";
    case "email":
      return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? undefined
        : "Use a valid email address.";
    case "address":
      return location !== "house_call" || value
        ? undefined
        : "Enter the address for the house call.";
    case "notes":
      return value.length <= NOTES_MAX ? undefined : `Keep notes under ${NOTES_MAX} characters.`;
  }
}

function validateAll(details: BookingDetails, location: AppointmentLocation): FieldErrors {
  const result: FieldErrors = {};
  for (const field of FIELD_ORDER) {
    const message = validateField(field, details, location);
    if (message) result[field] = message;
  }
  return result;
}

/** Mirrors the API's phone rule so most mistakes show before submitting. */
function isKenyanPhone(value: string): boolean {
  return /^(?:\+254|254|0)[17]\d{8}$/.test(value.replace(/[\s()-]/g, ""));
}

function apiFieldErrors(details: unknown): FieldErrors {
  const fieldErrors = (details as { fieldErrors?: Record<string, string[] | undefined> } | null)
    ?.fieldErrors;
  const result: FieldErrors = {};
  if (!fieldErrors) return result;
  for (const [apiField, messages] of Object.entries(fieldErrors)) {
    const field = API_FIELDS[apiField];
    if (field && messages?.[0]) result[field] = messages[0];
  }
  return result;
}

function FieldSet({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

type FieldProps = {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

function TextField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  onBlur,
  type = "text",
  required = false,
  autoComplete,
  inputMode,
}: FieldProps & {
  label: string;
  hint?: string;
  type?: "text" | "tel" | "email";
  required?: boolean;
  autoComplete?: string;
  inputMode?: "tel";
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={inputClass(error)}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function NotesField({ id, value, error, onChange, onBlur }: FieldProps) {
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} label="Notes for Chao" />
      <FieldHint id={hintId}>
        Nail shape and length, design ideas, allergies, or anything Chao should know.
      </FieldHint>
      <textarea
        id={id}
        name={id}
        rows={4}
        maxLength={NOTES_MAX}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, countId, errorId)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${inputClass(error)} resize-y py-2`}
      />
      <div className="mt-1 flex justify-between gap-3">
        {error ? <FieldError id={errorId}>{error}</FieldError> : <span />}
        <p id={countId} className="shrink-0 text-xs text-muted tabular-nums">
          {value.length}/{NOTES_MAX}
        </p>
      </div>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required = false,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold">
      {label}
      {required ? "" : <span className="font-normal text-muted"> (optional)</span>}
    </label>
  );
}

function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-0.5 text-xs text-muted">
      {children}
    </p>
  );
}

function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {children}
    </p>
  );
}

function describedBy(...ids: (string | undefined)[]): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(" ") : undefined;
}

function inputClass(error: string | undefined): string {
  return `mt-1.5 min-h-11 w-full rounded-card border bg-background px-3 ${
    error ? "border-danger" : "border-border"
  }`;
}
