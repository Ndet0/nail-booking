import type { AdminGalleryImageDto } from "@nailsbychao/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { useAdminGallery } from "@/features/admin/api";
import {
  Field,
  fieldClass,
  Notice,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/admin/ui";
import { ApiError, apiFetch } from "@/lib/api";

export function AdminGalleryPage() {
  const query = useAdminGallery();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/admin/gallery", { auth: true, method: "POST", body: form });
      event.currentTarget.reset();
      setMessage("Image uploaded. It stays hidden until you publish it.");
      await queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The image was not uploaded.");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Gallery</h1>
      <Panel title="Upload">
        <form onSubmit={upload} className="grid gap-3">
          <Field label="Image">
            <input
              className={fieldClass}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </Field>
          <Field label="Alt text">
            <input className={fieldClass} name="altText" required maxLength={200} />
          </Field>
          <Field label="Title">
            <input className={fieldClass} name="title" maxLength={80} />
          </Field>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="ok">{message}</Notice> : null}
          <button type="submit" className={primaryButtonClass}>
            Upload
          </button>
        </form>
      </Panel>
      {query.isPending ? <p className="text-muted">Loading gallery…</p> : null}
      {query.isError ? <Notice tone="error">Couldn't load the gallery.</Notice> : null}
      <ul className="grid gap-4">
        {query.data?.items.map((image) => (
          <GalleryItem key={image.id} image={image} />
        ))}
      </ul>
    </>
  );
}

function GalleryItem({ image }: { image: AdminGalleryImageDto }) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = useState(image.altText);
  const [title, setTitle] = useState(image.title ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(image.displayOrder));
  const [isPublished, setIsPublished] = useState(image.isPublished);
  const [error, setError] = useState<string | null>(null);
  const preview = useAuthedImage(image.id);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(`/admin/gallery/${encodeURIComponent(image.id)}`, {
        auth: true,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altText,
          title: title.trim() || null,
          displayOrder: Number(displayOrder),
          isPublished,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      await queryClient.invalidateQueries({ queryKey: ["gallery"] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The image was not saved.");
    }
  }

  async function remove() {
    setError(null);
    try {
      await apiFetch(`/admin/gallery/${encodeURIComponent(image.id)}`, {
        auth: true,
        method: "DELETE",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      await queryClient.invalidateQueries({ queryKey: ["gallery"] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The image was not removed.");
    }
  }

  return (
    <li className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[8rem_1fr]">
      {preview ? (
        <img src={preview} alt="" className="aspect-square w-full rounded-card object-cover" />
      ) : (
        <div className="aspect-square rounded-card bg-background" />
      )}
      <form onSubmit={save} className="grid gap-3">
        <Field label="Alt text">
          <input
            className={fieldClass}
            required
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
          />
        </Field>
        <Field label="Title">
          <input
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Display order">
          <input
            className={fieldClass}
            type="number"
            min={0}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          Published on the public site
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={secondaryButtonClass}>
            Save
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </form>
    </li>
  );
}

function useAuthedImage(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetch(`/api/v1/admin/gallery/${encodeURIComponent(id)}/image`, { credentials: "include" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}
