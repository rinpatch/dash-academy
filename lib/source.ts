import { docs } from "fumadocs-mdx:collections/server";
import { loader, type InferPageType } from "fumadocs-core/source";
import { DEFAULT_ESTIMATED_MINUTES, estimateMinutes } from "@/lib/reading-time";

export const source = loader({
  baseUrl: "/learn",
  source: docs.toFumadocsSource(),
});

/**
 * Reading the source file only works while the page is being prerendered, so fall back to the
 * default rather than failing the render if a lesson is ever served dynamically.
 */
export async function lessonMinutes(page: InferPageType<typeof source>): Promise<number> {
  if (page.data.estimatedMinutes) return page.data.estimatedMinutes;
  try {
    return estimateMinutes(await page.data.getText("raw"));
  } catch {
    return DEFAULT_ESTIMATED_MINUTES;
  }
}
