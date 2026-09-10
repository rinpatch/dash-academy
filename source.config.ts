import { defineDocs } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/academy",
  docs: {
    schema: pageSchema.extend({
      module: z.number().int().min(1).max(19),
      tier: z.enum(["concepts", "sdk", "projects"]),
      // Concepts lessons omit this and let lib/reading-time derive it from the file.
      estimatedMinutes: z.number().int().positive().optional(),
      exp: z.number().int().positive(),
      verification: z.enum(["none", "quiz", "testnet", "hybrid"]),
      prerequisites: z.array(z.number().int().min(1).max(19)).default([]),
      // Stub lessons carry status: draft by hand. The factory rewrites the whole file when it
      // authors a lesson, so the flag disappears on its own once real content lands.
      status: z.enum(["draft", "published"]).default("published"),
    }),
  },
});
