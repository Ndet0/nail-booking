import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { type AppEnv, getConfig } from "./env";
import { notFound, onError } from "./middleware/error-handler";
import { servicesRoutes } from "./modules/services/services.routes";
import { healthRoutes } from "./routes/health";

export const app = new Hono<AppEnv>().basePath("/api/v1");

app.use(requestId());
app.use(
  cors({
    origin: (origin, c) => (getConfig(c.env).CORS_ORIGINS.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Idempotency-Key"],
    maxAge: 600,
  }),
);

app.route("/health", healthRoutes);
app.route("/services", servicesRoutes);

app.notFound(notFound);
app.onError(onError);
