import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnchorProvider } from "fumadocs-core/toc";
import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { CourseTrackCard } from "@/components/lesson/course-track-card";
import { LessonNavList, type LessonSummary } from "@/components/lesson/lesson-nav-list";
import { LessonTabs } from "@/components/lesson/lesson-tabs";
import { NotesPanel } from "@/components/lesson/notes-panel";

type PageProps = { params: Promise<{ slug?: string[] }> };

export default async function AcademyLesson({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug ?? []);
  if (!page) notFound();

  const lessons: LessonSummary[] = source
    .getPages()
    .slice()
    .sort((a, b) => a.data.module - b.data.module)
    .map((lesson) => ({
      slug: lesson.slugs.join("/"),
      url: lesson.url,
      title: lesson.data.title,
      estimatedMinutes: lesson.data.estimatedMinutes,
      exp: lesson.data.exp,
    }));

  const Content = page.data.body;
  const lessonSlug = page.slugs.join("/");

  return (
    <AnchorProvider toc={page.data.toc}>
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[256px_1fr_352px] lg:gap-16 lg:py-12">
        <aside className="order-2 flex flex-col gap-4 lg:sticky lg:top-28 lg:order-1 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <CourseTrackCard totalLessons={lessons.length} />
          <LessonNavList lessons={lessons} currentUrl={page.url} toc={page.data.toc} />
        </aside>

        <main className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-foreground/4 px-4 py-2 text-sm font-medium">
              <span className="font-extrabold">{page.data.estimatedMinutes}</span> Min. Read
            </span>
            <span className="rounded-xl bg-primary/12 px-4 py-2 text-sm font-medium text-primary">
              <span className="font-extrabold">+ {page.data.exp}</span> Exp
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-extrabold sm:text-5xl">{page.data.title}</h1>
            {page.data.description && (
              <p className="max-w-2xl text-base font-medium text-foreground/64">
                {page.data.description}
              </p>
            )}
          </div>

          <LessonTabs
            overview={
              <DocsBody>
                <Content components={getMDXComponents()} />
              </DocsBody>
            }
          />
        </main>

        <aside className="order-3">
          <NotesPanel lessonSlug={lessonSlug} lessonTitle={page.data.title} />
        </aside>
      </div>
    </AnchorProvider>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug ?? []);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
