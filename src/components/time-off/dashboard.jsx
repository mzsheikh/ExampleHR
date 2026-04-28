"use client";
import { RefreshCcw } from "lucide-react";
import { useTimeOffDashboard } from "@/lib/time-off/use-time-off";
import { EmployeeView } from "./employee-view";
import { ManagerView } from "./manager-view";
export function TimeOffDashboard() {
    const dashboard = useTimeOffDashboard();
    return (<main className="appShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">ExampleHR</p>
          <h1>Time Off</h1>
        </div>
        <div className="topActions">
          {dashboard.state.toast ? (<div className={`toast toast-${dashboard.state.toast.tone}`}>{dashboard.state.toast.message}</div>) : null}
          <button type="button" onClick={() => void dashboard.refresh()} title="Reconcile with HCM">
            <RefreshCcw size={17}/>
            Reconcile
          </button>
        </div>
      </header>

      {dashboard.state.status === "loading" ? (<section className="panel loadingPanel">Loading HCM balances...</section>) : (<div className="dashboardGrid">
          <EmployeeView balances={dashboard.state.balances} requests={dashboard.state.requests} selectedLocationId={dashboard.state.selectedLocationId} form={dashboard.form} mode={dashboard.mode} busy={dashboard.isPending} onSelectLocation={dashboard.selectLocation} onFormChange={dashboard.setForm} onModeChange={dashboard.setMode} onSubmit={dashboard.submitRequest} onBonus={dashboard.applyBonus}/>
          <ManagerView balances={dashboard.state.balances} requests={dashboard.state.requests} busy={dashboard.isPending} onDecision={dashboard.decide}/>
        </div>)}
    </main>);
}
