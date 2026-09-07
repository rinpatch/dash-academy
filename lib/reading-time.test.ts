import { describe, expect, it } from "vitest";
import { estimateMinutes } from "@/lib/reading-time";

const frontmatter = "---\ntitle: Sample\ntier: concepts\n---\n\n";

describe("estimateMinutes", () => {
  it("ignores frontmatter and JSX markup", () => {
    const prose = "word ".repeat(170);
    expect(estimateMinutes(frontmatter + `<Callout>${prose}</Callout>`)).toBe(1);
  });

  it("charges for code and quiz questions on top of the prose", () => {
    const prose = "word ".repeat(170);
    const code = "```js\n" + "const x = 1;\n".repeat(8) + "```\n";
    const quiz = `<LessonQuiz challengeId="sample" questions={[\n  { prompt: "Why?" },\n  { prompt: "How?" },\n]} />`;
    expect(estimateMinutes(frontmatter + prose + code + quiz)).toBe(4);
  });

  it("never returns zero for a near-empty lesson", () => {
    expect(estimateMinutes(frontmatter + "Draft.")).toBe(1);
  });
});
