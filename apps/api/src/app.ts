import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { type AppEnv, getConfig } from "./env";
import { notFound, onError } from "./middleware/error-handler";
import { adminRoutes } from "./modules/admin/admin.routes";
import { createAuth } from "./modules/auth/auth";
import { availabilityRoutes } from "./modules/availability/availability.routes";
import { bookingsRoutes } from "./modules/bookings/bookings.routes";
import { galleryRoutes } from "./modules/gallery/gallery.routes";
import { servicesRoutes } from "./modules/services/services.routes";
import { healthRoutes } from "./routes/health";

const api = new Hono<AppEnv>().basePath("/api/v1");

api.route("/health", healthRoutes);
api.route("/services", servicesRoutes);
api.route("/availability", availabilityRoutes);
api.route("/bookings", bookingsRoutes);
api.route("/gallery", galleryRoutes);
api.route("/admin", adminRoutes);

api.notFound(notFound);
api.onError(onError);

export const app = new Hono<AppEnv>();

app.use(requestId());
app.use(
  cors({
    origin: (origin, c) => (getConfig(c.env).CORS_ORIGINS.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Idempotency-Key"],
    maxAge: 600,
  }),
);

app.all("/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));
app.route("/", api);

app.notFound(notFound);
app.onError(onError);
