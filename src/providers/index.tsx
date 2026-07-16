"use client";

import { LanguageProvider } from "./language-provider";
import { RoleProvider } from "./role-provider";
import { ToastProvider } from "./toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <RoleProvider>
        <ToastProvider>{children}</ToastProvider>
      </RoleProvider>
    </LanguageProvider>
  );
}

export { useI18n } from "./language-provider";
export { useRole } from "./role-provider";
export { useToast } from "./toast-provider";
