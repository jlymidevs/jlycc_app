import { z } from "zod";

export const portalTokenSchema = z.string().min(10).regex(/^[A-Za-z0-9_-]+$/);
