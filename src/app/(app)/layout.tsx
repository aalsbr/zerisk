import { AppShell } from "@/components/layout/app-shell";
import { getDataset } from "@/lib/store";
import { isCopilotOnline } from "@/lib/openai";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { insights } = getDataset();
  const notifications = insights
    .filter((i) => i.status === "NEW")
    .slice(0, 6)
    .map((i) => ({ id: i.id, title: i.titleAr, severity: i.severity }));
  // Fallback if all read
  const notif = notifications.length
    ? notifications
    : insights.slice(0, 5).map((i) => ({ id: i.id, title: i.titleAr, severity: i.severity }));

  return (
    <AppShell copilotOnline={isCopilotOnline()} notifications={notif}>
      {children}
    </AppShell>
  );
}
