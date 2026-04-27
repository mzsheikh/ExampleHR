import { CheckCircle2, RefreshCcw, TriangleAlert } from "lucide-react";
import { isBalanceStale, summarizeBalanceContext } from "@/lib/time-off/reconciliation";
import type { BalanceCell } from "@/lib/time-off/types";

type Props = {
  balance: BalanceCell;
  selected?: boolean;
  onSelect?: () => void;
};

export function BalanceCard({ balance, selected, onSelect }: Props) {
  const stale = isBalanceStale(balance);

  return (
    <button className={`balanceCard ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <div className="balanceTopline">
        <span>{balance.locationName}</span>
        {stale ? <TriangleAlert aria-label="stale" size={18} /> : <CheckCircle2 aria-label="fresh" size={18} />}
      </div>
      <strong>{balance.availableDays}</strong>
      <span className="muted">days available</span>
      <div className="balanceMeta">
        <span>{balance.pendingDays} pending</span>
        <span>v{balance.version}</span>
      </div>
      <div className="syncLine">
        <RefreshCcw size={14} aria-hidden />
        <span>{summarizeBalanceContext(balance)}</span>
      </div>
    </button>
  );
}
