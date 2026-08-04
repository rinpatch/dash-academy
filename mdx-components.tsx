import type { MDXComponents } from "mdx/types";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Callout } from "@/components/lesson/callout";
import { IdentityVerifier } from "@/components/lesson/identity-verifier";
import { LessonQuiz } from "@/components/lesson/lesson-quiz";

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    IdentityVerifier,
    LessonQuiz,
    ...components,
  };
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return getMDXComponents(components);
}
