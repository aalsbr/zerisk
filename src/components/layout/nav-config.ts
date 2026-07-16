import {
  LayoutDashboard,
  Radio,
  ShieldAlert,
  SlidersHorizontal,
  FlaskConical,
  Lightbulb,
  Bot,
  Wallet,
  ClipboardCheck,
  Activity,
  Settings,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  key: string; // i18n key
  Icon: LucideIcon;
}

export interface NavGroup {
  key: string; // i18n key for group label
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    key: "nav.group.overview",
    items: [{ href: "/", key: "nav.dashboard", Icon: LayoutDashboard }],
  },
  {
    key: "nav.group.decisions",
    items: [
      { href: "/transactions", key: "nav.transactions", Icon: Radio },
      { href: "/investigations", key: "nav.investigations", Icon: ClipboardCheck },
    ],
  },
  {
    key: "nav.group.optimization",
    items: [
      { href: "/false-positives", key: "nav.falsePositives", Icon: ShieldAlert },
      { href: "/rules", key: "nav.rules", Icon: SlidersHorizontal },
      { href: "/simulation", key: "nav.simulation", Icon: FlaskConical },
      { href: "/monitoring", key: "nav.monitoring", Icon: Activity },
    ],
  },
  {
    key: "nav.group.value",
    items: [
      { href: "/insights", key: "nav.insights", Icon: Lightbulb },
      { href: "/copilot", key: "nav.copilot", Icon: Bot },
      { href: "/financial", key: "nav.financial", Icon: Wallet },
    ],
  },
  {
    key: "nav.group.platform",
    items: [
      // Integration Center hidden for now (route still exists at /integrations).
      // { href: "/integrations", key: "nav.integrations", Icon: Plug },
      { href: "/settings", key: "nav.settings", Icon: Settings },
      { href: "/why", key: "nav.why", Icon: Sparkles },
      { href: "/demo", key: "nav.demo", Icon: Presentation },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
