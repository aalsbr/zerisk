import { getAssumptions } from "@/lib/store";
import { DEFAULT_IMPACT } from "@/lib/financial";
import { FinancialView } from "@/components/pages/financial-view";

export default function FinancialPage() {
  const assumptions = getAssumptions();
  return <FinancialView initialAssumptions={assumptions} impact={DEFAULT_IMPACT} />;
}
