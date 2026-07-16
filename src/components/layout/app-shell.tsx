"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  children,
  copilotOnline,
  notifications,
}: {
  children: React.ReactNode;
  copilotOnline: boolean;
  notifications: { id: string; title: string; severity: string }[];
}) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-navy-700/60 bg-navy-900/40 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-navy-950/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="fixed inset-y-0 z-50 w-64 border-e border-navy-700 bg-navy-900 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ insetInlineStart: 0 }}
            >
              <SidebarContent onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setDrawer(true)}
          copilotOnline={copilotOnline}
          notifications={notifications}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
