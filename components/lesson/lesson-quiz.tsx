"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useChallengeProgress } from "@/components/providers/progress-provider";
import type { QuizChallengeId } from "@/lib/progress";

type QuizQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
};

type QuizResult = {
  score: number;
  passed: boolean;
};

export function LessonQuiz({
  challengeId,
  questions,
  passingScore,
}: {
  challengeId: QuizChallengeId;
  questions: QuizQuestion[];
  passingScore: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const questionRef = useRef<HTMLLegendElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const shouldFocusQuestion = useRef(false);
  const { completion, isHydrated, complete } = useChallengeProgress(challengeId);

  const visibleAnswers =
    Object.keys(answers).length > 0 || retaking
      ? answers
      : completion?.evidence.answers ?? answers;
  const currentQuestion = questions[currentIndex];
  const selectedOptionId = visibleAnswers[currentQuestion.id];
  const isReview = reviewing && Boolean(completion);
  const isGraded = isReview || Boolean(graded[currentQuestion.id]);
  const isCorrect = selectedOptionId === currentQuestion.correctOptionId;
  const showResults =
    Boolean(result) ||
    (isHydrated && Boolean(completion) && !reviewing && !retaking);

  useEffect(() => {
    if (shouldFocusQuestion.current) {
      shouldFocusQuestion.current = false;
      questionRef.current?.focus();
    }
  }, [currentIndex]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function selectAnswer(optionId: string) {
    if (isGraded) return;
    setAnswers({ ...visibleAnswers, [currentQuestion.id]: optionId });
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOptionId || isGraded) return;

    setGraded((current) => ({ ...current, [currentQuestion.id]: true }));
    requestAnimationFrame(() => feedbackRef.current?.focus());
  }

  function goBack() {
    if (currentIndex === 0) return;
    shouldFocusQuestion.current = true;
    setCurrentIndex((index) => index - 1);
  }

  function continueQuiz() {
    if (!isGraded) return;

    if (currentIndex < questions.length - 1) {
      shouldFocusQuestion.current = true;
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (isReview) {
      setReviewing(false);
      setRetaking(false);
      return;
    }

    const score = questions.reduce(
      (total, question) =>
        total + Number(visibleAnswers[question.id] === question.correctOptionId),
      0,
    );
    const passed = score >= passingScore;
    setResult({ score, passed });

    if (passed) {
      complete({ score, total: questions.length, answers: visibleAnswers });
    }
  }

  function retakeQuiz() {
    setAnswers({});
    setGraded({});
    setCurrentIndex(0);
    setResult(null);
    setReviewing(false);
    setRetaking(true);
    shouldFocusQuestion.current = true;
    requestAnimationFrame(() => questionRef.current?.focus());
  }

  function reviewAnswers() {
    setCurrentIndex(0);
    setResult(null);
    setReviewing(true);
    setRetaking(false);
    shouldFocusQuestion.current = true;
    requestAnimationFrame(() => questionRef.current?.focus());
  }

  if (!isHydrated) {
    return <QuizSkeleton questionCount={questions.length} passingScore={passingScore} />;
  }

  if (showResults) {
    const score = result?.score ?? completion?.evidence.score ?? 0;
    const passed = result?.passed ?? Boolean(completion);

    return (
      <QuizResults
        ref={resultRef}
        passed={passed}
        score={score}
        total={questions.length}
        passingScore={passingScore}
        restored={!result && Boolean(completion)}
        onRetake={retakeQuiz}
        onReview={passed && completion ? reviewAnswers : undefined}
      />
    );
  }

  return (
    <section
      className="not-prose my-8 overflow-hidden rounded-3xl bg-card"
      aria-labelledby="quiz-title"
    >
      <header className="border-b border-foreground/12 px-5 py-5 sm:px-7">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="quiz-title" className="text-lg font-extrabold text-card-foreground">
              {isReview ? "Review your answers" : "Knowledge check"}
            </h2>
            <p className="mt-1 text-sm text-foreground/48">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium text-foreground/48">
            {passingScore} correct to pass
          </p>
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {questions.map((question, index) => (
            <span
              key={question.id}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                index <= currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="sr-only">
          Quiz progress: question {currentIndex + 1} of {questions.length}
        </span>
      </header>

      <form onSubmit={checkAnswer}>
        <div key={currentQuestion.id} className="quiz-step-enter px-5 py-7 sm:px-7 sm:py-8">
          <fieldset>
            <legend
              ref={questionRef}
              tabIndex={-1}
              className="max-w-2xl text-balance text-xl font-extrabold leading-7 text-card-foreground outline-none sm:text-2xl sm:leading-8"
            >
              {currentQuestion.prompt}
            </legend>

            <div className="mt-6 grid gap-3">
              {currentQuestion.options.map((option, index) => {
                const selected = selectedOptionId === option.id;
                const correct = option.id === currentQuestion.correctOptionId;
                const stateClass = isGraded
                  ? correct
                    ? "border-mint bg-mint/15"
                    : selected
                      ? "border-destructive bg-destructive/10"
                      : "border-foreground/12 opacity-65"
                  : selected
                    ? "border-primary bg-primary/10"
                    : "border-foreground/12 hover:border-foreground/24 hover:bg-muted/45";

                return (
                  <label
                    key={option.id}
                    className={`flex min-h-14 items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 text-card-foreground transition-[border-color,background-color,opacity] duration-200 ${
                      isGraded ? "cursor-default" : "cursor-pointer"
                    } ${stateClass}`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={option.id}
                      checked={selected}
                      disabled={isGraded}
                      onChange={() => selectAnswer(option.id)}
                      className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="mr-2 font-extrabold text-foreground/48" aria-hidden="true">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      {option.label}
                    </span>
                    {isGraded && correct && (
                      <span className="shrink-0 text-xs font-extrabold text-foreground">
                        Correct answer
                      </span>
                    )}
                    {isGraded && selected && !correct && (
                      <span className="shrink-0 text-xs font-extrabold text-destructive">
                        Your answer
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isGraded && (
            <div
              ref={feedbackRef}
              tabIndex={-1}
              role={isCorrect ? "status" : "alert"}
              className={`quiz-feedback-enter mt-6 border-t pt-5 outline-none ${
                isCorrect ? "border-mint/60" : "border-destructive/45"
              }`}
            >
              <p className="font-extrabold text-card-foreground">
                {isCorrect ? "That’s right." : "Not quite."}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/64">
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-foreground/12 bg-background px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={goBack}
            disabled={currentIndex === 0}
            className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
          >
            Back
          </button>

          {isGraded ? (
            <button
              type="button"
              onClick={continueQuiz}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {currentIndex === questions.length - 1
                ? isReview
                  ? "Finish review"
                  : "See results"
                : "Next question"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!selectedOptionId}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Check answer
            </button>
          )}
        </footer>
      </form>
    </section>
  );
}

function QuizResults({
  ref,
  passed,
  score,
  total,
  passingScore,
  restored,
  onRetake,
  onReview,
}: {
  ref: React.Ref<HTMLDivElement>;
  passed: boolean;
  score: number;
  total: number;
  passingScore: number;
  restored: boolean;
  onRetake: () => void;
  onReview?: () => void;
}) {
  return (
    <section
      className="not-prose my-8 overflow-hidden rounded-3xl bg-card"
      aria-labelledby="quiz-result-title"
    >
      <div ref={ref} tabIndex={-1} className="quiz-step-enter px-5 py-7 outline-none sm:px-7 sm:py-8">
        <p className="text-sm font-extrabold text-foreground/48">
          {passed ? "Quiz complete" : "Keep going"}
        </p>
        <h2 id="quiz-result-title" className="mt-2 text-balance text-2xl font-extrabold text-card-foreground">
          {passed ? "You passed the knowledge check." : "Review the lesson and try once more."}
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/64">
          {restored
            ? `Your saved score is ${score} of ${total}.`
            : passed
              ? `You answered ${score} of ${total} correctly. Saved on this device.`
              : `You answered ${score} of ${total} correctly. You need ${passingScore} correct answers to pass.`}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {passed ? (
            <>
              <button
                type="button"
                onClick={onRetake}
                className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try again
              </button>
              {onReview && (
                <button
                  type="button"
                  onClick={onReview}
                  className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Review answers
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onRetake}
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Retake quiz
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function QuizSkeleton({
  questionCount,
  passingScore,
}: {
  questionCount: number;
  passingScore: number;
}) {
  return (
    <section
      className="not-prose my-8 overflow-hidden rounded-3xl bg-card"
      aria-label="Loading quiz progress"
      aria-busy="true"
    >
      <div className="border-b border-foreground/12 px-5 py-5 sm:px-7">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold text-card-foreground">Knowledge check</p>
            <p className="mt-1 text-sm text-foreground/48">Restoring your progress…</p>
          </div>
          <p className="text-sm font-medium text-foreground/48">{passingScore} correct to pass</p>
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: questionCount }, (_, index) => (
            <span key={index} className="h-1.5 flex-1 rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="space-y-4 px-5 py-8 sm:px-7">
        <div className="h-6 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      </div>
    </section>
  );
}
