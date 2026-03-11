"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import api, { authApi, profileApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Mail,
  Loader2,
  Camera,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, validatePassword } from "@/lib/utils";
import { ActiveSessionsList } from "@/components/sessions/ActiveSessionsList";
import { SessionManagementModal } from "@/components/modals/SessionManagementModal";

export function ProfileView() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const response = await api.get("/profile");
      return response.data.data;
    },
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPG, PNG, or GIF)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploadingImage(true);
    try {
      const response = await profileApi.updateImage(file);
      // Update AuthContext so navbar updates immediately
      if (response.data?.data?.avatar_url) {
        updateUser({ avatar_url: response.data.data.avatar_url });
      }
      toast.success("Profile image updated successfully");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile image");
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const userName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || user?.email || "User";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user?.avatar_url || profile?.avatar_url} className="object-cover" />

                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <input
                id="avatar-upload"
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/jpeg,image/jpg,image/png,image/gif"
                className="hidden"
                aria-label="Upload profile picture"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <h3 className="font-semibold text-lg truncate">{userName}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="pt-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
                {user?.job_title_name || user?.role?.replace(/_/g, " ")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Settings Tabs */}
        <Card className="lg:col-span-2">
          <Tabs defaultValue="general" className="w-full">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">
                  <User className="h-4 w-4 mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Shield className="h-4 w-4 mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              <TabsContent value="general" className="space-y-4 mt-0">
                <GeneralSettings profile={profile} isLoading={isLoading} />
              </TabsContent>

              <TabsContent value="security" className="space-y-4 mt-0">
                <SecuritySettings />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Additional Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Account Information</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user?.email || "-"}
            />
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Role"
              value={user?.job_title_name || user?.role?.replace(/_/g, " ") || "-"}
              capitalize
            />
           
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Quick Actions</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setIsChangeEmailOpen(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Change Email
            </Button>
            {user?.role !== "super_admin" && (
              <Button
                variant="outline"
                className="w-full justify-start text-destructive"
                onClick={() => setIsDeleteAccountOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <ActiveSessionsList />

      {/* Change Email Dialog */}
      <ChangeEmailDialog
        open={isChangeEmailOpen}
        onOpenChange={setIsChangeEmailOpen}
        currentEmail={user?.email || ""}
      />

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        open={isDeleteAccountOpen}
        onOpenChange={setIsDeleteAccountOpen}
      />
    </div>
  );
}

function GeneralSettings({ profile, isLoading }: { profile: any; isLoading: boolean }) {
  const { updateUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const data = new FormData();
      if (formData.first_name) data.append("first_name", formData.first_name);
      if (formData.last_name) data.append("last_name", formData.last_name);

      await api.put("/profile", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update AuthContext so navbar updates immediately
      const updates: { first_name?: string; last_name?: string } = {};
      if (formData.first_name) updates.first_name = formData.first_name;
      if (formData.last_name) updates.last_name = formData.last_name;
      updateUser(updates);

      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setFormData({ first_name: "", last_name: "" });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            placeholder={profile?.first_name || "Enter first name"}
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            placeholder={profile?.last_name || "Enter last name"}
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
            maxLength={50}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" 
        variant="secondary" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setFormData({ first_name: "", last_name: "" })}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SecuritySettings() {
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<{
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  }>({});
  const [isChanging, setIsChanging] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [sessionModal, setSessionModal] = useState<{
    isOpen: boolean;
    otherSessionCount: number;
  }>({
    isOpen: false,
    otherSessionCount: 0,
  });

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.current_password) {
      newErrors.current_password = "Current password is required";
    }

    const passwordValidation = validatePassword(formData.new_password);
    if (!passwordValidation.isValid) {
      newErrors.new_password = passwordValidation.error;
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = "Confirm password is required";
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsChanging(true);
    setErrors({});

    try {
      const response = await api.put("/auth/change-password", {
        currentPassword: formData.current_password,
        password: formData.new_password,
        confirmPassword: formData.confirm_password,
      });

      toast.success("Password changed successfully");
      setFormData({ current_password: "", new_password: "", confirm_password: "" });

      // Check if we should show session management modal
      if (response.data?.data?.showSessionModal && response.data?.data?.otherSessionCount > 0) {
        setSessionModal({
          isOpen: true,
          otherSessionCount: response.data.data.otherSessionCount,
        });
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to change password";
      // Check if it's a current password error
      if (errorMessage.toLowerCase().includes("current password")) {
        setErrors({ current_password: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current_password">Current Password</Label>
        <div className="relative">
          <Input
            id="current_password"
            type={showPassword.current ? "text" : "password"}
            placeholder="Enter current password"
            value={formData.current_password}
            onChange={(e) => {
              setFormData({ ...formData, current_password: e.target.value });
              if (errors.current_password) setErrors(prev => ({ ...prev, current_password: undefined }));
            }}
            className={`${formData.current_password ? "pr-10" : ""} ${errors.current_password ? "border-destructive" : ""}`}
          />
          {formData.current_password && (
            <button
              type="button"
              onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-opacity"
            >
              {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {errors.current_password && (
          <p className="text-sm text-destructive">{errors.current_password}</p>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="new_password">New Password</Label>
        <div className="relative">
          <Input
            id="new_password"
            type={showPassword.new ? "text" : "password"}
            placeholder="Enter new password"
            value={formData.new_password}
            onChange={(e) => {
              setFormData({ ...formData, new_password: e.target.value });
              if (errors.new_password) setErrors(prev => ({ ...prev, new_password: undefined }));
            }}
            className={`${formData.new_password ? "pr-10" : ""} ${errors.new_password ? "border-destructive" : ""}`}
          />
          {formData.new_password && (
            <button
              type="button"
              onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-opacity"
            >
              {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {errors.new_password ? (
          <p className="text-sm text-destructive">{errors.new_password}</p>
        ) : formData.new_password.length > 0 ? (
          <div className="space-y-1 mt-2">
            <p className="text-xs text-muted-foreground">Password must contain:</p>
            <ul className="text-xs space-y-0.5">
              <li className={formData.new_password.length >= 8 ? "text-green-600" : "text-muted-foreground"}>
                {formData.new_password.length >= 8 ? "✓" : "○"} At least 8 characters
              </li>
              <li className={/[A-Z]/.test(formData.new_password) ? "text-green-600" : "text-muted-foreground"}>
                {/[A-Z]/.test(formData.new_password) ? "✓" : "○"} One uppercase letter
              </li>
              <li className={/[a-z]/.test(formData.new_password) ? "text-green-600" : "text-muted-foreground"}>
                {/[a-z]/.test(formData.new_password) ? "✓" : "○"} One lowercase letter
              </li>
              <li className={/\d/.test(formData.new_password) ? "text-green-600" : "text-muted-foreground"}>
                {/\d/.test(formData.new_password) ? "✓" : "○"} One number
              </li>
              <li className={/[@$!%*?&#]/.test(formData.new_password) ? "text-green-600" : "text-muted-foreground"}>
                {/[@$!%*?&#]/.test(formData.new_password) ? "✓" : "○"} One special character (@$!%*?&#)
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm New Password</Label>
        <div className="relative">
          <Input
            id="confirm_password"
            type={showPassword.confirm ? "text" : "password"}
            placeholder="Confirm new password"
            value={formData.confirm_password}
            onChange={(e) => {
              setFormData({ ...formData, confirm_password: e.target.value });
              if (errors.confirm_password) setErrors(prev => ({ ...prev, confirm_password: undefined }));
            }}
            className={`${formData.confirm_password ? "pr-10" : ""} ${errors.confirm_password ? "border-destructive" : ""}`}
          />
          {formData.confirm_password && (
            <button
              type="button"
              onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-opacity"
            >
              {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {errors.confirm_password && (
          <p className="text-sm text-destructive">{errors.confirm_password}</p>
        )}
      </div>

      <Button type="submit" variant="secondary" disabled={isChanging}>
        {isChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Change Password
      </Button>

      {/* Session Management Modal */}
      <SessionManagementModal
        isOpen={sessionModal.isOpen}
        onClose={() => setSessionModal({ isOpen: false, otherSessionCount: 0 })}
        otherSessionCount={sessionModal.otherSessionCount}
        changeType="password"
      />
    </form>
  );
}

function InfoRow({
  icon,
  label,
  value,
  capitalize,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
  status?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span
        className={`text-sm font-medium ${capitalize ? "capitalize" : ""} ${status !== undefined
            ? status
              ? "text-green-600"
              : "text-destructive"
            : ""
          }`}
      >
        {value}
      </span>
    </div>
  );
}

function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    newEmail: "",
    otp: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const [sessionModal, setSessionModal] = useState<{
    isOpen: boolean;
    otherSessionCount: number;
  }>({
    isOpen: false,
    otherSessionCount: 0,
  });

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.newEmail.trim()) {
      newErrors.newEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.newEmail.trim())) {
      newErrors.newEmail = "Please enter a valid email address";
    } else if (formData.newEmail === currentEmail) {
      newErrors.newEmail = "New email must be different from current email";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.requestEmailChange({
        new_email: formData.newEmail,
      });

      toast.success("OTP sent to your current email address");
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmChange = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.otp) {
      newErrors.otp = "OTP is required";
    } else if (formData.otp.length !== 6) {
      newErrors.otp = "OTP must be 6 digits";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.confirmEmailChange({
        new_email: formData.newEmail,
        otp: formData.otp,
      });

      // Update user in localStorage
      if (response.data.data.user) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          user.email = response.data.data.user.email;
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      toast.success("Email changed successfully!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // Check if we should show session management modal
      if (response.data?.data?.showSessionModal && response.data?.data?.otherSessionCount > 0) {
        setSessionModal({
          isOpen: true,
          otherSessionCount: response.data.data.otherSessionCount,
        });
        // Don't close the dialog yet, let session modal handle it
        setStep(1);
        setFormData({ newEmail: "", otp: "" });
      } else {
        onOpenChange(false);
        setStep(1);
        setFormData({ newEmail: "", otp: "" });

        // Reload page to update user context
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setFormData({ newEmail: "", otp: "" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Change Email - Step 1" : "Change Email - Step 2"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Enter your new email address. We'll send an OTP to your current email."
              : "Enter the 6-digit OTP sent to your current email address."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleRequestOTP}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentEmail">Current Email</Label>
                <Input
                  id="currentEmail"
                  type="email"
                  value={currentEmail}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="Enter new email address"
                  value={formData.newEmail}
                  onChange={(e) => {
                    setFormData({ ...formData, newEmail: e.target.value });
                    if (errors.newEmail) {
                      setErrors(prev => ({ ...prev, newEmail: "" }));
                    }
                  }}
                  className={errors.newEmail ? "border-red-500" : ""}
                />
                {errors.newEmail && (
                  <p className="text-sm text-red-500 mt-1">{errors.newEmail}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleConfirmChange}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newEmailDisplay">New Email</Label>
                <Input
                  id="newEmailDisplay"
                  type="email"
                  value={formData.newEmail}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">
                  OTP Code
                  <span className="text-xs text-muted-foreground ml-2">
                    (Sent to {currentEmail})
                  </span>
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={formData.otp}
                  onChange={(e) => {
                    setFormData({ ...formData, otp: e.target.value.replace(/\D/g, "").slice(0, 6) });
                    if (errors.otp) {
                      setErrors(prev => ({ ...prev, otp: "" }));
                    }
                  }}
                  maxLength={6}
                  className={`text-center text-2xl tracking-widest ${errors.otp ? "border-red-500" : ""}`}
                />
                {errors.otp && (
                  <p className="text-sm text-red-500 mt-1">{errors.otp}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  OTP expires in 10 minutes
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" disabled={isLoading} className="flex-1 sm:flex-initial">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify OTP
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {/* Session Management Modal for Email Change */}
      <SessionManagementModal
        isOpen={sessionModal.isOpen}
        onClose={() => {
          setSessionModal({ isOpen: false, otherSessionCount: 0 });
          onOpenChange(false);
          // Reload page to update user context
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }}
        otherSessionCount={sessionModal.otherSessionCount}
        changeType="email"
      />
    </Dialog>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsDeleting(true);
    try {
      await profileApi.deleteAccount(password);
      toast.success("Account deleted successfully");
      
      // Logout and redirect to login
      await logout();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPassword("");
    setShowPassword(false);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Account</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account
            and remove all of your data from our servers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deletePassword">
                Confirm your password to continue
              </Label>
              <div className="relative">
                <Input
                  id="deletePassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: "" }));
                    }
                  }}
                  className={`${password ? "pr-10" : ""} ${errors.password ? "border-red-500" : ""}`}
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-opacity"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
