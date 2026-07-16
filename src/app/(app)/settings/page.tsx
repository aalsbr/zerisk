import { getGovernance, getAudit } from "@/lib/store";
import { SettingsView } from "@/components/pages/settings-view";

export default function SettingsPage() {
  const governance = getGovernance();
  const audit = getAudit().map((a) => ({
    id: a.id,
    at: a.at,
    actor: a.actor,
    action: a.action,
    detail: a.detail,
  }));

  return <SettingsView governance={{ ...governance }} audit={audit} />;
}
