import React, { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageHeaderProps {
  title: string;
  description: string;
  icon: ReactNode;
  buttonText?: string;
  buttonIcon?: ReactNode;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  buttonDisabledTooltip?: string;
  secondaryButtonText?: string;
  secondaryButtonIcon?: ReactNode;
  onSecondaryClick?: () => void;
  secondaryDisabled?: boolean;
  secondaryDisabledTooltip?: string;
}

export const PageHeader = React.memo(function PageHeader({
  title,
  description,
  icon,
  buttonText,
  buttonIcon,
  onButtonClick,
  buttonDisabled = false,
  buttonDisabledTooltip = "You don't have permission",
  secondaryButtonText,
  secondaryButtonIcon,
  onSecondaryClick,
  secondaryDisabled = false,
  secondaryDisabledTooltip = "You don't have permission",
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap gap-5 items-center justify-between relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-6 md:p-8 text-white w-full">
      <div>
        <h1 className="flex items-center text-2xl md:text-3xl font-bold mb-2">
          {icon}
          {title}
        </h1>
        <p className="text-white/80 max-w-lg">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {secondaryButtonText && onSecondaryClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={onSecondaryClick}
                    disabled={secondaryDisabled}
                    variant="ghost"
                    className="bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {secondaryButtonIcon}
                    {secondaryButtonText}
                  </Button>
                </div>
              </TooltipTrigger>
              {secondaryDisabled && (
                <TooltipContent>
                  <p>{secondaryDisabledTooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        {buttonText && onButtonClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={onButtonClick}
                    disabled={buttonDisabled}
                    className="bg-white text-emerald-600 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {buttonIcon}
                    {buttonText}
                  </Button>
                </div>
              </TooltipTrigger>
              {buttonDisabled && (
                <TooltipContent>
                  <p>{buttonDisabledTooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
});
