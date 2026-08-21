import type { ChallengeId } from "@/lib/progress";
import { challengeSpecs } from "@/lib/progress";

/**
 * Narrows request JSON to challenge ids we know.
 *
 * A client can claim a challenge it didn't do — quizzes are graded on the device — and that's
 * accepted, since app/api/verify is what checks the operations that matter. An unknown id
 * reaching the slot encoder is not accepted.
 */
export function parseCompletedChallengeIds(value: unknown): ChallengeId[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is ChallengeId => typeof id === "string" && id in challengeSpecs,
  );
}
