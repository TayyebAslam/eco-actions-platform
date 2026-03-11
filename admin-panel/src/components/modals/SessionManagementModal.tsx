"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sessionsApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, LogOut, Monitor } from "lucide-react";

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherSessionCount: number;
  changeType: "password" | "email";
}

export const SessionManagementModal = React.memo(function SessionManagementModal({
  isOpen,
  onClose,
  otherSessionCount,
  changeType,
}: SessionManagementModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutAll = async () => {
    setIsLoading(true);
    try {
      await sessionsApi.respond("logout_all");
      toast.success(
        `Logged out from ${otherSessionCount} other device${otherSessionCount > 1 ? "s" : ""}`
      );
      onClose();
    } catch (error) {
      console.error("Failed to logout from other devices:", error);
      toast.error("Failed to logout from other devices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeepAll = async () => {
    setIsLoading(true);
    try {
      await sessionsApi.respond("keep_all");
      toast.success("All devices will remain signed in");
      onClose();
    } catch (error) {
      console.error("Failed to keep sessions:", error);
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    changeType === "password"
      ? "Password Changed Successfully"
      : "Email Changed Successfully";

  const description =
    changeType === "password"
      ? `Your password has been changed. You are currently signed in on ${otherSessionCount} other device${otherSessionCount > 1 ? "s" : ""}. Would you like to sign out from those devices?`
      : `Your email has been changed. You are currently signed in on ${otherSessionCount} other device${otherSessionCount > 1 ? "s" : ""}. Would you like to sign out from those devices?`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              For security, you may want to sign out from other devices if you
              suspect any unauthorized access.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleLogoutAll}
            disabled={isLoading}
            variant="destructive"
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Sign out from other devices
          </Button>
          <Button
            onClick={handleKeepAll}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            Keep all devices signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
