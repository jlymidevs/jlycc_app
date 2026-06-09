import { z } from "zod";

export const portalTokenSchema = z.string().min(10);
