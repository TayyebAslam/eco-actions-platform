"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft, Home } from "lucide-react";

interface AccessDeniedViewProps {
  moduleName?: string;
  message?: string;
}

export function AccessDeniedView({ moduleName, message }: AccessDeniedViewProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-border">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>

          <p className="text-muted-foreground mb-4">
            {message || (
              <>
                You don't have permission to access the{" "}
                <span className="font-semibold text-foreground">
                  {moduleName || "this"}
                </span>{" "}
                module.
              </>
            )}
          </p>

          <div className="bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
            Your permissions may have been updated. Contact your administrator if you need access to this module.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
