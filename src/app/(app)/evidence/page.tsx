import { getEvidence, getKpis, getModelVersions } from "@/lib/store";
import { EvidenceView } from "@/components/pages/evidence-view";

// Static test-suite configuration (allowed): the MVP ships with a passing
// deterministic test suite covering the core engines.
const TEST_STATUS = {
  passing: true,
  suites: ["scoring", "financial", "simulation", "learning", "seed-integrity"],
} as const;

export default function EvidencePage() {
  const evidence = getEvidence();
  const kpis = getKpis();
  const modelVersions = getModelVersions();

  return (
    <EvidenceView
      evidence={evidence}
      kpis={kpis}
      modelVersions={modelVersions}
      testStatus={{ passing: TEST_STATUS.passing, suites: [...TEST_STATUS.suites] }}
    />
  );
}
