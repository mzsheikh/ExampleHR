"use client";

import { Send, Sparkles } from "lucide-react";
import { CURRENT_EMPLOYEE_ID } from "@/lib/time-off/sample-data";
import type { BalanceCell, HcmMode, LocationId, RequestFormState, TimeOffRequest } from "@/lib/time-off/types";
import { BalanceCard } from "./balance-card";
import { StatusPill } from "./status-pill";

type Props = {
  balances: BalanceCell[];
  requests: TimeOffRequest[];
  selectedLocationId: LocationId;
  form: RequestFormState;
  mode: HcmMode;
  busy?: boolean;
  onSelectLocation: (locationId: LocationId) => void;
  onFormChange: (form: RequestFormState) => void;
  onModeChange: (mode: HcmMode) => void;
  onSubmit: () => void;
  onBonus: () => void;
};

const modes: Array<{ value: HcmMode; label: string }> = [
  { value: "normal", label: "Normal HCM" },
  { value: "conflict", label: "Conflict" },
  { value: "silent_wrong", label: "Silent wrong" },
  { value: "slow", label: "Slow HCM" },
  { value: "invalid_dimension", label: "Invalid dimension" }
];

export function EmployeeView({
  balances,
  requests,
  selectedLocationId,
  form,
  mode,
  busy,
  onSelectLocation,
  onFormChange,
  onModeChange,
  onSubmit,
  onBonus
}: Props) {
  const employeeBalances = balances.filter((balance) => balance.employeeId === CURRENT_EMPLOYEE_ID);
  const recentRequests = requests.filter((request) => request.employeeId === CURRENT_EMPLOYEE_ID).slice(0, 4);
  const selectedBalance = employeeBalances.find((balance) => balance.locationId === selectedLocationId);
  const canSubmit = selectedBalance && form.days > 0 && form.startsOn && form.endsOn;

  return (
    <section className="panel">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Employee</p>
          <h2>Avery Johnson</h2>
        </div>
        <button className="iconButton" type="button" onClick={onBonus} title="Trigger anniversary bonus">
          <Sparkles size={18} />
        </button>
      </div>

      <div className="balanceGrid">
        {employeeBalances.map((balance) => (
          <BalanceCard
            key={`${balance.employeeId}-${balance.locationId}`}
            balance={balance}
            selected={balance.locationId === selectedLocationId}
            onSelect={() => onSelectLocation(balance.locationId)}
          />
        ))}
      </div>

      <div className="requestForm">
        <label>
          Days
          <input
            min="1"
            max="30"
            type="number"
            value={form.days}
            onChange={(event) => onFormChange({ ...form, days: Number(event.target.value) })}
          />
        </label>
        <label>
          Starts
          <input
            type="date"
            value={form.startsOn}
            onChange={(event) => onFormChange({ ...form, startsOn: event.target.value })}
          />
        </label>
        <label>
          Ends
          <input
            type="date"
            value={form.endsOn}
            onChange={(event) => onFormChange({ ...form, endsOn: event.target.value })}
          />
        </label>
        <label className="wide">
          Reason
          <input
            value={form.reason}
            onChange={(event) => onFormChange({ ...form, reason: event.target.value })}
            placeholder="Reason"
          />
        </label>
        <label className="wide">
          HCM simulation
          <select value={mode} onChange={(event) => onModeChange(event.target.value as HcmMode)}>
            {modes.map((candidate) => (
              <option key={candidate.value} value={candidate.value}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <button className="primaryButton" type="button" onClick={onSubmit} disabled={!canSubmit || busy}>
          <Send size={17} />
          Submit as pending
        </button>
      </div>

      <div className="requestList">
        {recentRequests.length === 0 ? (
          <p className="empty">No employee requests yet.</p>
        ) : (
          recentRequests.map((request) => (
            <article className="requestRow" key={request.id}>
              <div>
                <strong>
                  {request.days} day{request.days === 1 ? "" : "s"} in {request.locationName}
                </strong>
                <span>
                  {request.startsOn} to {request.endsOn}
                </span>
              </div>
              <StatusPill status={request.status} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
