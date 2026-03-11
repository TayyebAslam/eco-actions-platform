"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { articlesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Eye, Calendar, User, Award, Building2, Globe, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import DOMPurify from 'dompurify';
import { usePermissions } from "@/hooks/usePermissions";

interface ArticleViewContentProps {
  articleId: number;
}

function ArticleViewContentInner({ articleId }: ArticleViewContentProps) {
  const router = useRouter();
  const { canEdit } = usePermissions();
  const [thumbnailError, setThumbnailError] = useState(false);
  const hasEditPermission = canEdit("articles");

  // Fetch article data
  const { data: articleData, isLoading, error } = useQuery({
    queryKey: ["article", articleId],
    queryFn: async () => {
      const response = await articlesApi.getById(articleId);
      return response.data.data;
    },
    enabled: !!articleId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-destructive">Error loading article: {(error as any)?.message || "Unknown error"}</p>
        <Button onClick={() => router.push("/dashboard/articles")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Articles
        </Button>
      </div>
    );
  }

  if (!articleData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">Article not found</p>
        <Button onClick={() => router.push("/dashboard/articles")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Articles
        </Button>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="mr-2 h-8 w-8" />}
        title="View Article"
        description="Read article content and details"
        buttonIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        buttonText="Back to Articles"
        onButtonClick={() => router.push("/dashboard/articles")}
      />

      {/* Article Metadata */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{articleData.title}</CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>By {articleData.author_first_name && articleData.author_last_name ? `${articleData.author_first_name} ${articleData.author_last_name}` : articleData.author_first_name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{articleData.created_at ? formatDate(articleData.created_at) : "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>{articleData.views_count || 0} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <Badge variant="secondary">+{articleData.points} points</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* School Info */}
          <div className="flex items-center gap-2 text-sm">
            {articleData.school_id ? (
              <>
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">School-specific article (ID: {articleData.school_id})</span>
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Global article (All schools)</span>
              </>
            )}
          </div>

          {/* Thumbnail */}
          {articleData.thumbnail_image && (
            <div className="relative w-full max-w-96 h-64 max-[460px]:h-52 rounded-lg overflow-hidden bg-muted">
              {thumbnailError ? (
                <div className="flex h-full w-full items-center justify-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={articleData.thumbnail_image}
                  alt={articleData.title}
                  className="w-full h-full object-cover"
                  onError={() => setThumbnailError(true)}
                />
              )}
            </div>
          )}

          {/* Article Content */}
          <div className="border-t pt-4">
            <div
              className="article-content prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(articleData.content || "") }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/articles")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
        {hasEditPermission && (
          <Button
            onClick={() => router.push(`/dashboard/articles/${articleId}`)}
          >
            Edit Article
          </Button>
        )}
      </div>
    </div>
  );
}

export function ArticleViewContent({ articleId }: ArticleViewContentProps) {
  return <ArticleViewContentInner articleId={articleId} />;
}
