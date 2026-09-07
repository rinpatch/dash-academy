// Concepts lessons no longer carry a hand-written `estimatedMinutes`: the numbers drifted as
// lessons were edited, and a single words-per-minute constant ignored the code and the quiz.
// SDK lessons still declare one, because typing and testnet round-trips dominate their time and
// no text metric predicts them.

const WORDS_PER_MINUTE = 170;
const CODE_LINES_PER_MINUTE = 8;
const MINUTES_PER_QUIZ_QUESTION = 0.75;

/** Used when a lesson declares no estimate and its source cannot be read. */
export const DEFAULT_ESTIMATED_MINUTES = 10;

/** Minutes to read a lesson, work through its examples, and answer its quiz. */
export function estimateMinutes(mdx: string): number {
  const body = mdx.replace(/^---[\s\S]*?---/, "");

  let codeLines = 0;
  const withoutCode = body.replace(/```[\s\S]*?```/g, (block) => {
    codeLines += Math.max(0, block.split("\n").length - 2);
    return " ";
  });

  const questions = (body.match(/\bprompt:/g) ?? []).length;
  const prose = withoutCode.replace(/<LessonQuiz[\s\S]*?\/>/g, " ").replace(/<[^>]+>/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;

  const minutes =
    words / WORDS_PER_MINUTE +
    codeLines / CODE_LINES_PER_MINUTE +
    questions * MINUTES_PER_QUIZ_QUESTION;
  return Math.max(1, Math.round(minutes));
}
