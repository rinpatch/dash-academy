import { readFile } from "node:fs/promises";
import path from "node:path";

export function orderedLessons(lessons) {
  return [...new Map(lessons.map((lesson) => [lesson.module, lesson])).values()]
    .sort((a, b) => a.module - b.module);
}

export async function runSequentially(lessons, processLesson) {
  for (const lesson of orderedLessons(lessons)) {
    const status = await processLesson(lesson);
    if (!["passed", "local-passed"].includes(status)) break;
  }
}

export async function previousLessons(manifest, lesson, cwd) {
  const result = [];
  for (const previous of orderedLessons(manifest.lessons).filter((item) => item.module < lesson.module)) {
    const file = `content/academy/${previous.slug}.mdx`;
    try {
      result.push({ module: previous.module, file, text: await readFile(path.join(cwd, file), "utf8") });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      result.push({ module: previous.module, file, missing: true });
    }
  }
  return result;
}
