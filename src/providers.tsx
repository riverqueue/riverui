"use client";

import { useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@services/queryClient";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SidebarSettingProvider } from "@contexts/SidebarSetting.provider";
import { RefreshSettingProvider } from "@contexts/RefreshSettings.provider";

function ThemeWatcher() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function onMediaChange() {
      const systemTheme = media.matches ? "dark" : "light";
      if (resolvedTheme === systemTheme) {
        setTheme("system");
      }
    }

    onMediaChange();
    media.addEventListener("change", onMediaChange);

    return () => {
      media.removeEventListener("change", onMediaChange);
    };
  }, [resolvedTheme, setTheme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange>
      <ThemeWatcher />
      <QueryClientProvider client={queryClient}>
        <SidebarSettingProvider>
          <RefreshSettingProvider>{children}</RefreshSettingProvider>
        </SidebarSettingProvider>
        <ReactQueryDevtools position="bottom" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
