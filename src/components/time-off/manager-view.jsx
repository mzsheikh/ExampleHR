"use client";
import { Check, ShieldCheck, X } from "lucide-react";
import { summarizeBalanceContext } from "@/lib/time-off/reconciliation";
import { StatusPill } from "./status-pill";
export function ManagerView({ balances, requests, busy, onDecision }) {
    const reviewable = requests.filter((request) => request.status === "pending" || request.status === "needs_review");
    return (<section className="panel managerPanel">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">Manager</p>
          <h2>Decision queue</h2>
        </div>
        <ShieldCheck size={22} aria-hidden/>
      </div>

      {reviewable.length === 0 ? (<p className="empty">No pending requests need a decision.</p>) : (<div className="decisionList">
          {reviewable.map((request) => {
                const balance = balances.find((candidate) => candidate.employeeId === request.employeeId && candidate.locationId === request.locationId);
                return (<article className="decisionCard" key={request.id}>
                <div className="decisionMain">
                  <div>
                    <strong>{request.employeeName}</strong>
                    <span>
                      {request.days} day{request.days === 1 ? "" : "s"} in {request.locationName}
                    </span>
                    <small>
                      {request.startsOn} to {request.endsOn}
                    </small>
                  </div>
                  <StatusPill status={request.status}/>
                </div>

                <div className="balanceContext">
                  <span>Decision-time context</span>
                  <strong>{balance ? summarizeBalanceContext(balance) : "Missing HCM cell"}</strong>
                </div>

                <div className="decisionActions">
                  <button type="button" onClick={() => onDecision(request.id, "deny")} disabled={busy}>
                    <X size={16}/>
                    Deny
                  </button>
                  <button className="primaryButton" type="button" onClick={() => onDecision(request.id, "approve")} disabled={busy}>
                    <Check size={16}/>
                    Verify and approve
                  </button>
                  <button type="button" onClick={() => onDecision(request.id, "approve", "conflict")} disabled={busy}>
                    Simulate conflict
                  </button>
                </div>
              </article>);
            })}
        </div>)}
    </section>);
}
