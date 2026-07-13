import { defineDocs } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/academy",
  docs: {
    schema: pageSchema.extend({
      module: z.number().int().min(1).max(17),
      tier: z.enum(["concepts", "sdk", "projects"]),
      estimatedMinutes: z.number().int().positive(),
      verification: z.enum(["quiz", "testnet", "hybrid"]),
      prerequisites: z.array(z.number().int().min(1).max(17)).default([]),
    }),
  },
});
