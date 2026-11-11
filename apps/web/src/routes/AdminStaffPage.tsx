import type { WorkingHoursDto } from "@nailsbychao/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useAdminServices, useAdminStaff, useStaffHours, useTimeOff } from "@/features/admin/api";
import { adminFormError } from "@/features/admin/errors";
import { WEEKDAYS } from "@/features/admin/status";
import {
  Field,
  fieldClass,
  Notice,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/admin/ui";
import { apiFetch } from "@/lib/api";
import { formatDay, formatTime, studioDateOf } from "@/lib/datetime";

type HourDraft = {
  rowKey: string;
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  isActive: boolean;
};

export function AdminStaffPage() {
  const staff = useAdminStaff();
  const services = useAdminServices();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    staff.data?.items.find((member) => member.id === selectedId) ?? staff.data?.items[0];

  return (
    <>
      <h1 className="text-2xl font-semibold">Staff</h1>
      <CreateStaff />
      {staff.isPending ? <p className="text-muted">Loading staff…</p> : null}
      {staff.isError ? <Notice tone="error">Couldn't load staff.</Notice> : null}
      {staff.data && staff.data.items.length > 0 ? (
        <Field label="Staff member">
          <select
            className={fieldClass}
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {staff.data.items.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {selected ? (
        <StaffEditor
          key={selected.id}
          staffId={selected.id}
          name={selected.name}
          bio={selected.bio ?? ""}
          isActive={selected.isActive}
          serviceIds={selected.serviceIds}
          services={
            services.data?.items.map((service) => ({ id: service.id, name: service.name })) ?? []
          }
        />
      ) : null}
    </>
  );
}

function CreateStaff() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/staff", {
        auth: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isActive: true }),
      });
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    } catch (caught) {
      setError(adminFormError(caught, "The staff member was not saved."));
    }
  }

  return (
    <Panel title="Add someone">
      <form onSubmit={onSubmit} className="grid gap-3">
        <Field label="Name">
          <input
            className={fieldClass}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className={primaryButtonClass}>
          Add staff
        </button>
      </form>
    </Panel>
  );
}

function StaffEditor({
  staffId,
  name,
  bio,
  isActive,
  serviceIds,
  services,
}: {
  staffId: string;
  name: string;
  bio: string;
  isActive: boolean;
  serviceIds: string[];
  services: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const hours = useStaffHours(staffId);
  const timeOff = useTimeOff(staffId);
  const [profile, setProfile] = useState({ name, bio, isActive });
  const [assigned, setAssigned] = useState(serviceIds);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/staff/${encodeURIComponent(staffId)}`, {
        auth: true,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio.trim() || null,
          isActive: profile.isActive,
        }),
      });
      await apiFetch(`/admin/staff/${encodeURIComponent(staffId)}/services`, {
        auth: true,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: assigned }),
      });
      setMessage("Staff saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    } catch (caught) {
      setError(adminFormError(caught, "The staff member was not saved."));
    }
  }

  return (
    <>
      <Panel title="Profile and services">
        <form onSubmit={saveProfile} className="grid gap-3">
          <Field label="Name">
            <input
              className={fieldClass}
              required
              value={profile.name}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            />
          </Field>
          <Field label="Bio">
            <textarea
              className={`${fieldClass} py-2`}
              value={profile.bio}
              onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.isActive}
              onChange={(event) => setProfile({ ...profile, isActive: event.target.checked })}
            />
            Active for new bookings
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Services they perform</legend>
            {services.map((service) => (
              <label key={service.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assigned.includes(service.id)}
                  onChange={(event) =>
                    setAssigned((current) =>
                      event.target.checked
                        ? [...current, service.id]
                        : current.filter((id) => id !== service.id),
                    )
                  }
                />
                {service.name}
              </label>
            ))}
          </fieldset>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="ok">{message}</Notice> : null}
          <button type="submit" className={secondaryButtonClass}>
            Save profile
          </button>
        </form>
      </Panel>
      {hours.isSuccess ? (
        <HoursEditor
          key={`${staffId}-${hours.dataUpdatedAt}`}
          staffId={staffId}
          hours={hours.data}
        />
      ) : hours.isPending ? (
        <p className="text-sm text-muted">Loading hours…</p>
      ) : (
        <Notice tone="error">Couldn't load working hours.</Notice>
      )}
      <TimeOffEditor
        staffId={staffId}
        items={timeOff.data?.items ?? []}
        pending={timeOff.isPending}
      />
    </>
  );
}

function HoursEditor({ staffId, hours }: { staffId: string; hours: WorkingHoursDto[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<HourDraft[]>(
    hours.map((hour) => ({
      rowKey: crypto.randomUUID(),
      weekday: hour.weekday,
      startTime: hour.startTime,
      endTime: hour.endTime,
      effectiveFrom: hour.effectiveFrom,
      isActive: hour.isActive,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/staff/${encodeURIComponent(staffId)}/hours`, {
        auth: true,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: rows.map(({ rowKey: _rowKey, ...row }) => ({
            ...row,
            startTime: row.startTime.slice(0, 5),
            endTime: row.endTime.slice(0, 5),
            effectiveUntil: null,
          })),
        }),
      });
      setMessage("Working hours saved. Availability uses them immediately.");
      await queryClient.invalidateQueries({ queryKey: ["admin-hours", staffId] });
    } catch (caught) {
      setError(adminFormError(caught, "The hours were not saved."));
    }
  }

  return (
    <Panel title="Weekly hours (Nairobi)">
      <form onSubmit={save} className="grid gap-3">
        {rows.map((row, index) => (
          <div key={row.rowKey} className="grid gap-2 sm:grid-cols-4">
            <select
              aria-label={`Shift ${index + 1} day`}
              className={fieldClass}
              value={row.weekday}
              onChange={(event) => updateRow(index, { weekday: Number(event.target.value) })}
            >
              {WEEKDAYS.map((label, weekday) => (
                <option key={label} value={weekday}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label={`Shift ${index + 1} start time`}
              className={fieldClass}
              type="time"
              required
              value={row.startTime}
              onChange={(event) => updateRow(index, { startTime: event.target.value })}
            />
            <input
              aria-label={`Shift ${index + 1} end time`}
              className={fieldClass}
              type="time"
              required
              value={row.endTime}
              onChange={(event) => updateRow(index, { endTime: event.target.value })}
            />
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setRows(rows.filter((_, item) => item !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() =>
            setRows([
              ...rows,
              {
                rowKey: crypto.randomUUID(),
                weekday: 1,
                startTime: "08:00",
                endTime: "20:00",
                effectiveFrom: "2026-01-01",
                isActive: true,
              },
            ])
          }
        >
          Add a shift
        </button>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="ok">{message}</Notice> : null}
        <button type="submit" className={primaryButtonClass}>
          Save hours
        </button>
      </form>
    </Panel>
  );

  function updateRow(index: number, patch: Partial<HourDraft>) {
    setRows(rows.map((row, item) => (item === index ? { ...row, ...patch } : row)));
  }
}

function TimeOffEditor({
  staffId,
  items,
  pending,
}: {
  staffId: string;
  items: { id: string; startAt: string; endAt: string; reason: string | null }[];
  pending: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    startDate: "",
    startTime: "08:00",
    endDate: "",
    endTime: "20:00",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/time-off", {
        auth: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          startDate: form.startDate,
          startTime: form.startTime.slice(0, 5),
          endDate: form.endDate,
          endTime: form.endTime.slice(0, 5),
          reason: form.reason.trim() || null,
        }),
      });
      setForm({ ...form, reason: "" });
      await queryClient.invalidateQueries({ queryKey: ["admin-time-off", staffId] });
    } catch (caught) {
      setError(adminFormError(caught, "Time off was not saved."));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiFetch(`/admin/time-off/${encodeURIComponent(id)}`, { auth: true, method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin-time-off", staffId] });
    } catch (caught) {
      setError(adminFormError(caught, "Time off was not removed."));
    }
  }

  return (
    <Panel title="Time off (Nairobi)">
      {pending ? <p className="text-sm text-muted">Loading time off…</p> : null}
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {formatDay(studioDateOf(item.startAt))} {formatTime(item.startAt)} –{" "}
              {formatDay(studioDateOf(item.endAt))} {formatTime(item.endAt)}
              {item.reason ? ` · ${item.reason}` : ""}
            </span>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void remove(item.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts">
          <input
            className={fieldClass}
            type="date"
            required
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          />
        </Field>
        <Field label="Start time">
          <input
            className={fieldClass}
            type="time"
            required
            value={form.startTime}
            onChange={(event) => setForm({ ...form, startTime: event.target.value })}
          />
        </Field>
        <Field label="Ends">
          <input
            className={fieldClass}
            type="date"
            required
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
          />
        </Field>
        <Field label="End time">
          <input
            className={fieldClass}
            type="time"
            required
            value={form.endTime}
            onChange={(event) => setForm({ ...form, endTime: event.target.value })}
          />
        </Field>
        <Field label="Reason">
          <input
            className={fieldClass}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" className={primaryButtonClass}>
          Add time off
        </button>
      </form>
    </Panel>
  );
}
