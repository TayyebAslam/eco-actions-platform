"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { levelsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  Zap,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Target,
  Tag,
  Layers,
  Plus,
  Divide,
  Lightbulb
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";

function LevelsContent() {
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();

  const applyFormulaMutation = useMutation({
    mutationFn: (data: {
      total_levels: number;
      base_min_xp: number;
      initial_gap: number;
      tier_size: number;
      base_increment: number;
      growth_divisor: number;
      title_prefix: string;
    }) => levelsApi.applyFormula(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levels"] });
      toast.success("Levels created successfully using formula");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to apply formula");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<TrendingUp className="mr-2 h-8 w-8" />}
        title="Levels"
        description="Configure XP thresholds for level progression using mathematical formula"
      />

      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Apply Level Formula</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate multiple levels automatically using a mathematical formula. This will create levels based on the parameters below.
              </p>
            </div>

            <ApplyFormulaForm
              onApply={(data) => applyFormulaMutation.mutate(data)}
              isLoading={applyFormulaMutation.isPending}
              disabled={!canCreate("levels")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ApplyFormulaForm({
  onApply,
  isLoading,
  disabled,
}: {
  onApply: (data: {
    total_levels: number;
    base_min_xp: number;
    initial_gap: number;
    tier_size: number;
    base_increment: number;
    growth_divisor: number;
    title_prefix: string;
  }) => void;
  isLoading: boolean;
  disabled: boolean;
}) {
  const [formData, setFormData] = useState({
    total_levels: "100",
    base_min_xp: "0",
    initial_gap: "100",
    tier_size: "20",
    base_increment: "10",
    growth_divisor: "50",
    title_prefix: "Level",
  });
  const [showHints, setShowHints] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.total_levels || parseInt(formData.total_levels) < 1) {
      newErrors.total_levels = "Total levels must be at least 1";
    }
    
    if (!formData.base_min_xp || parseInt(formData.base_min_xp) < 0) {
      newErrors.base_min_xp = "Base min XP must be 0 or greater";
    }
    
    if (!formData.initial_gap || parseInt(formData.initial_gap) < 1) {
      newErrors.initial_gap = "Initial gap must be at least 1";
    }
    
    if (!formData.tier_size || parseInt(formData.tier_size) < 1) {
      newErrors.tier_size = "Tier size must be at least 1";
    }
    
    if (!formData.base_increment || parseInt(formData.base_increment) < 1) {
      newErrors.base_increment = "Base increment must be at least 1";
    }
    
    if (!formData.growth_divisor || parseInt(formData.growth_divisor) < 1) {
      newErrors.growth_divisor = "Growth divisor must be at least 1";
    }
    
    if (!formData.title_prefix.trim()) {
      newErrors.title_prefix = "Title prefix is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    onApply({
      total_levels: parseInt(formData.total_levels),
      base_min_xp: parseInt(formData.base_min_xp),
      initial_gap: parseInt(formData.initial_gap),
      tier_size: parseInt(formData.tier_size),
      base_increment: parseInt(formData.base_increment),
      growth_divisor: parseInt(formData.growth_divisor),
      title_prefix: formData.title_prefix,
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Total Levels</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The total number of levels to generate. Higher numbers create more levels but may impact performance.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.total_levels}
                onChange={(e) => {
                  setFormData({ ...formData, total_levels: e.target.value });
                  if (errors.total_levels) {
                    setErrors(prev => ({ ...prev, total_levels: "" }));
                  }
                }}
                placeholder="100"
                min="1"
                disabled={disabled}
                className={errors.total_levels ? "border-red-500" : ""}
              />
              {errors.total_levels && (
                <p className="text-sm text-red-500 mt-1">{errors.total_levels}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Base Min XP</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The starting XP requirement for Level 1. Usually 0 for beginners.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.base_min_xp}
                onChange={(e) => {
                  setFormData({ ...formData, base_min_xp: e.target.value });
                  if (errors.base_min_xp) {
                    setErrors(prev => ({ ...prev, base_min_xp: "" }));
                  }
                }}
                placeholder="0"
                min="0"
                disabled={disabled}
                className={errors.base_min_xp ? "border-red-500" : ""}
              />
              {errors.base_min_xp && (
                <p className="text-sm text-red-500 mt-1">{errors.base_min_xp}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Initial Gap</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The XP difference between the first few levels. This gap increases as levels progress.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.initial_gap}
                onChange={(e) => {
                  setFormData({ ...formData, initial_gap: e.target.value });
                  if (errors.initial_gap) {
                    setErrors(prev => ({ ...prev, initial_gap: "" }));
                  }
                }}
                placeholder="100"
                min="1"
                disabled={disabled}
                className={errors.initial_gap ? "border-red-500" : ""}
              />
              {errors.initial_gap && (
                <p className="text-sm text-red-500 mt-1">{errors.initial_gap}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Tier Size</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How many levels belong to each tier. Every N levels, the difficulty increases more rapidly.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.tier_size}
                onChange={(e) => {
                  setFormData({ ...formData, tier_size: e.target.value });
                  if (errors.tier_size) {
                    setErrors(prev => ({ ...prev, tier_size: "" }));
                  }
                }}
                placeholder="20"
                min="1"
                disabled={disabled}
                className={errors.tier_size ? "border-red-500" : ""}
              />
              {errors.tier_size && (
                <p className="text-sm text-red-500 mt-1">{errors.tier_size}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Base Increment</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The base amount by which the XP gap increases each level. Multiplied by tier and growth factor.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.base_increment}
                onChange={(e) => {
                  setFormData({ ...formData, base_increment: e.target.value });
                  if (errors.base_increment) {
                    setErrors(prev => ({ ...prev, base_increment: "" }));
                  }
                }}
                placeholder="10"
                min="1"
                disabled={disabled}
                className={errors.base_increment ? "border-red-500" : ""}
              />
              {errors.base_increment && (
                <p className="text-sm text-red-500 mt-1">{errors.base_increment}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Growth Divisor</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex items-center justify-center">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Controls how fast the XP requirements grow. Lower values = faster growth, higher values = slower growth.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                value={formData.growth_divisor}
                onChange={(e) => {
                  setFormData({ ...formData, growth_divisor: e.target.value });
                  if (errors.growth_divisor) {
                    setErrors(prev => ({ ...prev, growth_divisor: "" }));
                  }
                }}
                placeholder="50"
                min="1"
                disabled={disabled}
                className={errors.growth_divisor ? "border-red-500" : ""}
              />
              {errors.growth_divisor && (
                <p className="text-sm text-red-500 mt-1">{errors.growth_divisor}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Title Prefix</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="flex items-center justify-center">
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>The text that appears before each level number (e.g., "Level 1", "Champion 5").</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={formData.title_prefix}
              onChange={(e) => {
                setFormData({ ...formData, title_prefix: e.target.value });
                if (errors.title_prefix) {
                  setErrors(prev => ({ ...prev, title_prefix: "" }));
                }
              }}
              placeholder="Level"
              disabled={disabled}
              className={errors.title_prefix ? "border-red-500" : ""}
            />
            {errors.title_prefix && (
              <p className="text-sm text-red-500 mt-1">{errors.title_prefix}</p>
            )}
          </div>
          <div className="flex space-y-2 justify-end">
            <Button type="submit" variant="secondary" disabled={isLoading || disabled} className="flex items-center justify-center">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Zap className="mr-2 h-4 w-4" />
              Apply Formula
            </Button>
          </div>
          </form>
       
         

      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowHints(!showHints)}
          className="w-full flex items-center justify-center"
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          {showHints ? "Hide" : "Show"} Formula Hints
          {showHints ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>

        {showHints && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Level Formula Explanation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">How the Formula Works:</h4>
                <div className="bg-muted p-3 rounded-md font-mono text-sm">
                  <div>minXp = base_min_xp</div>
                  <div>xpGap = initial_gap</div>
                  <div></div>
                  <div>for each level:</div>
                  <div>&nbsp;&nbsp;create level with minXp</div>
                  <div>&nbsp;&nbsp;minXp += xpGap</div>
                  <div>&nbsp;&nbsp;tier = floor((level-1) / tier_size) + 1</div>
                  <div>&nbsp;&nbsp;growthFactor = 1 + level / growth_divisor</div>
                  <div>&nbsp;&nbsp;xpGap += round(base_increment × tier × growthFactor)</div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Total Levels
                  </h5>
                  <p className="text-sm text-muted-foreground">The total number of levels to generate. Higher numbers create more levels but may impact performance.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Base Min XP
                  </h5>
                  <p className="text-sm text-muted-foreground">The starting XP requirement for Level 1. Usually 0 for beginners.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Initial Gap
                  </h5>
                  <p className="text-sm text-muted-foreground">The XP difference between the first few levels. This gap increases as levels progress.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-500" />
                    Tier Size
                  </h5>
                  <p className="text-sm text-muted-foreground">How many levels belong to each tier. Every N levels, the difficulty increases more rapidly.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4 text-destructive" />
                    Base Increment
                  </h5>
                  <p className="text-sm text-muted-foreground">The base amount by which the XP gap increases each level. Multiplied by tier and growth factor.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Divide className="h-4 w-4 text-indigo-500" />
                    Growth Divisor
                  </h5>
                  <p className="text-sm text-muted-foreground">Controls how fast the XP requirements grow. Lower values = faster growth, higher values = slower growth.</p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm flex items-center gap-2">
                    <Tag className="h-4 w-4 text-orange-500" />
                    Title Prefix
                  </h5>
                  <p className="text-sm text-muted-foreground">The text that appears before each level number (e.g., "Level 1", "Champion 5").</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  Pro Tips:
                </h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start with small values and test the level progression</li>
                  <li>• Lower growth divisor = harder endgame levels</li>
                  <li>• Higher tier size = more gradual difficulty increase</li>
                  <li>• The formula automatically updates student levels when applied</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function LevelsView() {
  return (
    <PermissionGuard moduleKey="levels">
      <LevelsContent />
    </PermissionGuard>
  );
}
