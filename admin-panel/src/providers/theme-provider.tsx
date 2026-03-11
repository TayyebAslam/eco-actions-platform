"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
    mode: ThemeMode;
    theme: ResolvedTheme;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: "system",
    theme: "light",
    setMode: () => { },
});

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [mode, setModeState] = useState<ThemeMode>("system");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
    const [mounted, setMounted] = useState(false);
    const isTransitioning = useRef(false);

    // Initialize mode from localStorage
    useEffect(() => {
        setMounted(true);
        const savedMode = localStorage.getItem("theme-mode") as ThemeMode | null;
        if (savedMode && ["light", "dark", "system"].includes(savedMode)) {
            setModeState(savedMode);
            // Set initial theme without animation
            const initialTheme = savedMode === "system" ? getSystemTheme() : savedMode;
            setResolvedTheme(initialTheme);
            applyThemeClass(initialTheme);
        } else {
            const initialTheme = getSystemTheme();
            setResolvedTheme(initialTheme);
            applyThemeClass(initialTheme);
        }
    }, []);

    const applyThemeClass = (theme: ResolvedTheme) => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    };

    const animateThemeChange = useCallback((newTheme: ResolvedTheme) => {
        if (isTransitioning.current || !mounted) return;
        if (newTheme === resolvedTheme) return;

        isTransitioning.current = true;
        const goingToDark = newTheme === "dark";

        // Create overlay with the NEW theme's background
        const overlay = document.createElement("div");
        overlay.className = "theme-transition-overlay";
        overlay.style.backgroundColor = goingToDark ? "hsl(222.2, 84%, 4.9%)" : "hsl(0, 0%, 100%)";
        document.body.appendChild(overlay);

        // Apply theme immediately and start animation together
        applyThemeClass(newTheme);
        setResolvedTheme(newTheme);

        requestAnimationFrame(() => {
            overlay.classList.add("transitioning");
        });

        // Remove overlay after animation
        setTimeout(() => {
            overlay.remove();
            isTransitioning.current = false;
        }, 400);
    }, [mounted, resolvedTheme]);

    // Handle system theme changes
    useEffect(() => {
        if (!mounted) return undefined;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (mode === "system") {
                const newTheme = getSystemTheme();
                animateThemeChange(newTheme);
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [mode, mounted, animateThemeChange]);

    const setMode = useCallback((newMode: ThemeMode) => {
        if (!mounted) return;

        setModeState(newMode);
        localStorage.setItem("theme-mode", newMode);

        // Calculate new resolved theme
        const newResolvedTheme = newMode === "system" ? getSystemTheme() : newMode;

        // Animate the change
        animateThemeChange(newResolvedTheme);
    }, [mounted, animateThemeChange]);

    // Prevent flash of wrong theme
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ mode, theme: resolvedTheme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
}
