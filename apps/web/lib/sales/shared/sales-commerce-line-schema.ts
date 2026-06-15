import { z } from "zod";

export const salesCommerceLineUomSchema = z.object({
  uom_code: z.string().trim().min(1).max(32).optional(),
});
