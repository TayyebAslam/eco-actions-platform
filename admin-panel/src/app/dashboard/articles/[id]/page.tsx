"use client";
import { ArticleFormView } from "@/components/views/dashboard/articles/form/ArticleFormView";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const articleId = parseInt(id);
  const router = useRouter();

  useEffect(() => {
    if (isNaN(articleId)) {
      router.push("/dashboard/articles");
    }
  }, [articleId, router]);

  if (isNaN(articleId)) {
    return null; // or a loading state
  }

  return <ArticleFormView articleId={articleId} />;
}
