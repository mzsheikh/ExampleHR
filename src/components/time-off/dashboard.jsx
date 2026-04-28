"use client";
import { RefreshCcw } from "lucide-react";
import { useTimeOffDashboard } from "@/lib/time-off/use-time-off";
import { EmployeeView } from "./employee-view";
import { ManagerView } from "./manager-view";
export function TimeOffDashboard() {
    const dashboard = useTimeOffDashboard();
    const showEmployee = dashboard.state.personaView === "all" || dashboard.state.personaView === "employee";
    const showManager = dashboard.state.personaView === "all" || dashboard.state.personaView === "manager";
    const hasData = dashboard.state.balances.length > 0 || dashboard.state.requests.length > 0;
    return (<main className="appShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">ExampleHR</p>
          <h1>Time Off</h1>
        </div>
        <div className="topActions">
          <div className={`syncBadge sync-${dashboard.state.status}`}>{dashboard.state.syncLabel}</div>
          {dashboard.state.toast ? (<div className={`toast toast-${dashboard.state.toast.tone}`}>{dashboard.state.toast.message}</div>) : null}
          <button type="button" onClick={() => void dashboard.refresh()} title="Reconcile with HCM">
            <RefreshCcw size={17}/>
            Reconcile
          </button>
        </div>
      </header>

      <nav className="personaNav" aria-label="Persona views">
        <button className={dashboard.state.personaView === "all" ? "active" : ""} type="button" onClick={() => dashboard.setPersonaView("all")}>
          Both views
        </button>
        <button className={dashboard.state.personaView === "employee" ? "active" : ""} type="button" onClick={() => dashboard.setPersonaView("employee")}>
          Employee view
        </button>
        <button className={dashboard.state.personaView === "manager" ? "active" : ""} type="button" onClick={() => dashboard.setPersonaView("manager")}>
          Manager view
        </button>
      </nav>

      {dashboard.state.status === "loading" && !hasData ? (<section className="panel loadingPanel">Loading HCM balances...</section>) : (<div className={`dashboardGrid view-${dashboard.state.personaView}`}>
          {showEmployee ? (<EmployeeView balances={dashboard.state.balances} requests={dashboard.state.requests} selectedLocationId={dashboard.state.selectedLocationId} form={dashboard.form} mode={dashboard.mode} busy={dashboard.isPending} onSelectLocation={dashboard.selectLocation} onFormChange={dashboard.setForm} onModeChange={dashboard.setMode} onSubmit={dashboard.submitRequest} onBonus={dashboard.applyBonus}/>) : null}
          {showManager ? (<ManagerView balances={dashboard.state.balances} requests={dashboard.state.requests} busy={dashboard.isPending} onDecision={dashboard.decide}/>) : null}
        </div>)}
    </main>);
}
