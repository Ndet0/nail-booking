import type { GalleryImageDto, Page } from "@nailsbychao/types";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function GallerySection() {
  const query = useQuery({
    queryKey: ["gallery"],
    queryFn: () => apiFetch<Page<GalleryImageDto>>("/gallery"),
  });

  if (query.isPending) {
    return (
      <section aria-busy="true" aria-label="Loading gallery" className="mb-12">
        <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="mb-12" aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" className="mb-4 text-2xl font-semibold">
          Gallery
        </h2>
        <p role="alert" className="text-sm text-danger">
          The gallery couldn't be loaded.
        </p>
      </section>
    );
  }
  if (query.data.items.length === 0) return null;

  return (
    <section className="mb-12" aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="mb-4 text-2xl font-semibold">
        Gallery
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {query.data.items.map((image) => (
          <li key={image.id}>
            <img
              src={image.imagePath}
              alt={image.altText}
              loading="lazy"
              className="aspect-square w-full rounded-card object-cover"
            />
            {image.title ? <p className="mt-2 text-sm text-muted">{image.title}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
