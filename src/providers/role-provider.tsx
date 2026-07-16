"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/types";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("EXECUTIVE");

  useEffect(() => {
    const stored = window.localStorage.getItem("fl-role") as Role | null;
    // Intentional mount-time preference hydration (see language-provider).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setRoleState(stored);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    window.localStorage.setItem("fl-role", r);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
