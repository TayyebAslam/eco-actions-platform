"use client";

import { useState, useEffect } from "react";
import { sessionsApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Shield,
} from "lucide-react";

interface Session {
  id: number;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: string;
  created_at: string;
  is_current: boolean;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />;
    case "tablet":
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

export function ActiveSessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await sessionsApi.getAll();
      setSessions(response.data.data.sessions);
    } catch {
      toast.error("Failed to load active sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions across different devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
              <Skeleton className="h-9 w-[80px]" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage your active sessions across different devices
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 dark:scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 dark:hover:scrollbar-thumb-muted-foreground/50">
        {sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No active sessions found
          </p>
        ) : (
          <>
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {getDeviceIcon(session.device_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {session.device_name || "Unknown Device"}
                    </p>
                    {session.is_current && (
                      <Badge variant="secondary" className="shrink-0">
                        This device
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last active {formatRelativeTime(session.last_activity_at)}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
