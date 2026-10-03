import React, { useState, useEffect } from "react";
import { 
  GitBranch, Play, CheckCircle2, XCircle, Clock, ShieldCheck, 
  Download, FileText, AlertTriangle, ArrowRight, RefreshCw, 
  Sliders, Plus, Layers, UserCheck, Lock, Eye, Check, X
} from "lucide-react";
import { 
  api, ScenarioResponse, CorridorRouteSegment, Location, 
  SupplyAllocationItem, OperationalReportResponse 
} from "../api/client";
import { ScenarioRouteComparison } from "./ScenarioRouteComparison";

interface ScenarioSimulatorViewProps {
  locations: Location[];
  initialScenarioData?: any;
}

export const ScenarioSimulatorView: React.FC<ScenarioSimulatorViewProps> = ({
  locations,
  initialScenarioData
}) => {
  const [scenarios, setScenarios] = useState<ScenarioResponse[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioResponse | null>(null);
  const [corridors, setCorridors] = useState<CorridorRouteSegment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isActing, setIsActing] = useState<boolean>(false);

  // New Scenario Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>(`SCEN-TACTICAL-${Math.floor(100 + Math.random() * 900)}`);
  const [newTitle, setNewTitle] = useState<string>("Tactical Surge & Western Ghats Restriction");
  const [newDesc, setNewDesc] = useState<string>("Simulates unexpected severe monsoon weather with road closure and fuel surge.");
  const [newAuthor, setNewAuthor] = useState<string>("Captain Deshmukh");
  const [newRoadClosures, setNewRoadClosures] = useState<string[]>([]);
  const [newFuelMultiplier, setNewFuelMultiplier] = useState<number>(1.3);
  const [newMedMultiplier, setNewMedMultiplier] = useState<number>(1.2);
  const [newFleetFactor, setNewFleetFactor] = useState<number>(0.8);

  // Review / Commit Modals
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<"SUBMIT_REVIEW" | "APPROVE" | "REJECT">("SUBMIT_REVIEW");
  const [reviewerName, setReviewerName] = useState<string>("Colonel Joshi (Operations Commander)");
  const [reviewNotes, setReviewNotes] = useState<string>("");

  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [committedBy, setCommittedBy] = useState<string>("Major Rao (Logistics Operations Officer)");
  const [commitNotes, setCommitNotes] = useState<string>("Authorized operational plan commit for immediate morning dispatch.");

  // Report Modal
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportData, setReportData] = useState<OperationalReportResponse | null>(null);

  const fetchScenariosAndCorridors = async () => {
    try {
      setIsLoading(true);
      const [scenList, corrList] = await Promise.all([
        api.getScenarios(),
        api.getCorridors()
      ]);
      setScenarios(scenList);
      setCorridors(corrList);

      if (scenList.length > 0) {
        // If we don't have an active scenario or previous one is not in list, select the latest
        if (!activeScenario || !scenList.find(s => s.id === activeScenario.id)) {
          setActiveScenario(scenList[0]);
        } else {
          const fresh = scenList.find(s => s.id === activeScenario.id);
          if (fresh) setActiveScenario(fresh);
        }
      }
    } catch (err: any) {
      console.error("Error loading scenarios:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenariosAndCorridors();
  }, []);

  const handleCreateScenario = async () => {
    try {
      setIsActing(true);
      const demandMults: Record<string, number> = {};
      if (newFuelMultiplier !== 1.0) demandMults["FUEL"] = newFuelMultiplier;
      if (newMedMultiplier !== 1.0) demandMults["MEDICAL_SUPPLIES"] = newMedMultiplier;

      const created = await api.createScenario({
        scenario_code: newCode,
        title: newTitle,
        description: newDesc,
        author: newAuthor,
        scenario_inputs: {
          road_closures: newRoadClosures,
          demand_multipliers: demandMults,
          transport_capacity_factor: newFleetFactor
        }
      });
      setShowCreateModal(false);
      await fetchScenariosAndCorridors();
      setActiveScenario(created);
    } catch (err: any) {
      alert("Failed to create scenario: " + err.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleSimulateActive = async () => {
    if (!activeScenario) return;
    try {
      setIsSimulating(true);
      const simulated = await api.simulateScenario(activeScenario.id);
      setActiveScenario(simulated);
      await fetchScenariosAndCorridors();
    } catch (err: any) {
      alert("Simulation failed: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecuteReview = async () => {
    if (!activeScenario) return;
    try {
      setIsActing(true);
      const updated = await api.reviewScenario(activeScenario.id, {
        action: reviewAction,
        reviewer: reviewerName,
        notes: reviewNotes
      });
      setShowReviewModal(false);
      setActiveScenario(updated);
      await fetchScenariosAndCorridors();
    } catch (err: any) {
      alert("Review action failed: " + err.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleExecuteCommit = async () => {
    if (!activeScenario) return;
    try {
      setIsActing(true);
      const committed = await api.commitScenario(activeScenario.id, committedBy, commitNotes);
      setShowCommitModal(false);
      setActiveScenario(committed);
      await fetchScenariosAndCorridors();
      alert(`Scenario ${committed.scenario_code} committed successfully! Live logistics dispatches recorded.`);
    } catch (err: any) {
      alert("Commit failed: " + err.message);
    } finally {
      setIsActing(false);
    }
  };

  const handleOpenReportModal = async () => {
    try {
      const r = await api.getOperationalReport();
      setReportData(r);
      setShowReportModal(true);
    } catch (err: any) {
      alert("Error loading report: " + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="status-badge" style={{ backgroundColor: "#F0EAE1", color: "#6B6359" }}>DRAFT SANDBOX</span>;
      case "SIMULATED":
        return <span className="status-badge" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary-dark)" }}>SIMULATED</span>;
      case "UNDER_REVIEW":
        return <span className="status-badge" style={{ backgroundColor: "var(--status-watch-bg)", color: "var(--status-watch)", border: "1px solid var(--status-watch-border)" }}>UNDER REVIEW</span>;
      case "APPROVED":
        return <span className="status-badge" style={{ backgroundColor: "var(--status-stable-bg)", color: "var(--status-stable)", border: "1px solid var(--status-stable-border)" }}>APPROVED</span>;
      case "REJECTED":
        return <span className="status-badge" style={{ backgroundColor: "var(--status-critical-bg)", color: "var(--status-critical)", border: "1px solid var(--status-critical-border)" }}>REJECTED</span>;
      case "COMMITTED":
        return <span className="status-badge" style={{ backgroundColor: "var(--status-stable-bg)", color: "var(--status-stable)", border: "1px solid var(--status-stable-border)", fontWeight: 800 }}>COMMITTED TO DB</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Top Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        backgroundColor: "#FFFFFF",
        padding: "1.25rem 1.75rem",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--border-subtle)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              What-If Scenario Simulator & Optimization
            </h1>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "4px",
              fontSize: "0.72rem",
              fontWeight: 800,
              backgroundColor: "var(--primary-light)",
              color: "var(--primary-dark)",
              border: "1px solid var(--primary)",
              letterSpacing: "0.04em"
            }}>
              <Sliders size={13} />
              ISOLATED SANDBOX
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Model road closures, demand shocks & capacity drops. Human planner review and explicit authorization required before applying changes.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={handleOpenReportModal}
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <FileText size={14} />
            <span>Operational Report</span>
          </button>
          <a
            href={api.getCSVExportUrl()}
            download
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Plus size={14} />
            <span>New What-If Scenario</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Scenario Sidebar + Simulation Details */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.75rem", alignItems: "start" }}>
        {/* Left Column: Scenarios List */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--bg-card-light)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
              Scenario Catalog ({scenarios.length})
            </span>
            <button
              onClick={fetchScenariosAndCorridors}
              disabled={isLoading}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <RefreshCw size={13} className={isLoading ? "spin-animation" : ""} />
            </button>
          </div>

          <div style={{ maxHeight: "650px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {scenarios.map((scen) => {
              const isSelected = activeScenario?.id === scen.id;
              return (
                <div
                  key={scen.id}
                  onClick={() => setActiveScenario(scen)}
                  style={{
                    padding: "1rem 1.25rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--primary-light)" : "transparent",
                    borderLeft: isSelected ? "4px solid var(--primary)" : "4px solid transparent",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary-dark)" }}>
                      {scen.scenario_code}
                    </span>
                    {getStatusBadge(scen.workflow_status)}
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.3 }}>
                    {scen.title}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                    By {scen.author} &bull; {new Date(scen.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}

            {scenarios.length === 0 && (
              <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No scenarios configured yet. Click "New What-If Scenario" to simulate hypothetical shocks.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Scenario Simulation & Human Review Center */}
        {activeScenario ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Scenario Header Card & Stepper */}
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              padding: "1.5rem",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>
                      {activeScenario.scenario_code}
                    </span>
                    {getStatusBadge(activeScenario.workflow_status)}
                  </div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", margin: "0.35rem 0" }}>
                    {activeScenario.title}
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0, maxWidth: "750px" }}>
                    {activeScenario.description || "No description provided."}
                  </p>
                </div>

                {/* Workflow Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  {activeScenario.workflow_status === "DRAFT" && (
                    <button
                      onClick={handleSimulateActive}
                      disabled={isSimulating}
                      className="btn btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      <Play size={15} />
                      <span>{isSimulating ? "Simulating SciPy HiGHS LP..." : "Run Isolated Simulation"}</span>
                    </button>
                  )}

                  {activeScenario.workflow_status === "SIMULATED" && (
                    <>
                      <button
                        onClick={handleSimulateActive}
                        disabled={isSimulating}
                        className="btn btn-secondary btn-sm"
                        title="Re-run simulation"
                      >
                        <RefreshCw size={13} className={isSimulating ? "spin-animation" : ""} />
                        <span>Re-simulate</span>
                      </button>
                      <button
                        onClick={() => {
                          setReviewAction("SUBMIT_REVIEW");
                          setShowReviewModal(true);
                        }}
                        className="btn btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        <UserCheck size={15} />
                        <span>Submit for Human Review</span>
                      </button>
                    </>
                  )}

                  {activeScenario.workflow_status === "UNDER_REVIEW" && (
                    <>
                      <button
                        onClick={() => {
                          setReviewAction("APPROVE");
                          setShowReviewModal(true);
                        }}
                        className="btn btn-sm"
                        style={{ backgroundColor: "var(--status-stable)", color: "#FFFFFF", display: "flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        <Check size={14} />
                        <span>Approve Scenario</span>
                      </button>
                      <button
                        onClick={() => {
                          setReviewAction("REJECT");
                          setShowReviewModal(true);
                        }}
                        className="btn btn-sm"
                        style={{ backgroundColor: "var(--status-critical)", color: "#FFFFFF", display: "flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        <X size={14} />
                        <span>Reject Plan</span>
                      </button>
                    </>
                  )}

                  {activeScenario.workflow_status === "REJECTED" && (
                    <button
                      onClick={() => {
                        setReviewAction("SUBMIT_REVIEW");
                        setShowReviewModal(true);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>Resubmit for Review</span>
                    </button>
                  )}

                  {activeScenario.workflow_status === "APPROVED" && (
                    <button
                      onClick={() => setShowCommitModal(true)}
                      className="btn btn-primary"
                      style={{
                        backgroundColor: "#8C4722",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        boxShadow: "0 2px 8px rgba(140, 71, 34, 0.35)"
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Commit Plan to Live Records</span>
                    </button>
                  )}

                  {activeScenario.workflow_status === "COMMITTED" && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--status-stable)",
                      backgroundColor: "var(--status-stable-bg)",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "6px"
                    }}>
                      <CheckCircle2 size={16} />
                      <span>Executed into Database</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Human Review & Approval Workflow Timeline Stepper */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                backgroundColor: "var(--bg-card-light)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                fontSize: "0.75rem",
                textAlign: "center"
              }}>
                <div style={{ fontWeight: 700, color: "var(--status-stable)" }}>
                  1. DRAFT CONFIG
                </div>
                <div style={{ fontWeight: 700, color: activeScenario.workflow_status !== "DRAFT" ? "var(--status-stable)" : "var(--text-muted)" }}>
                  2. SIMULATED
                </div>
                <div style={{ fontWeight: 700, color: ["UNDER_REVIEW", "APPROVED", "COMMITTED"].includes(activeScenario.workflow_status) ? "var(--status-stable)" : (activeScenario.workflow_status === "REJECTED" ? "var(--status-critical)" : "var(--text-muted)") }}>
                  3. UNDER REVIEW
                </div>
                <div style={{ fontWeight: 700, color: ["APPROVED", "COMMITTED"].includes(activeScenario.workflow_status) ? "var(--status-stable)" : (activeScenario.workflow_status === "REJECTED" ? "var(--status-critical)" : "var(--text-muted)") }}>
                  4. AUTHORIZED
                </div>
                <div style={{ fontWeight: 700, color: activeScenario.workflow_status === "COMMITTED" ? "var(--status-stable)" : "var(--text-muted)" }}>
                  5. COMMITTED TO DB
                </div>
              </div>

              {/* Configured Shocks Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>CONFIGURED SHOCKS:</span>
                {activeScenario.scenario_inputs.road_closures && activeScenario.scenario_inputs.road_closures.length > 0 ? (
                  <span style={{ padding: "0.2rem 0.5rem", backgroundColor: "var(--status-critical-bg)", color: "var(--status-critical)", borderRadius: "4px", fontWeight: 600 }}>
                    Closed Corridors: {activeScenario.scenario_inputs.road_closures.join(", ")}
                  </span>
                ) : (
                  <span style={{ padding: "0.2rem 0.5rem", backgroundColor: "#EDE8E1", color: "var(--text-muted)", borderRadius: "4px" }}>
                    No Corridor Closures
                  </span>
                )}

                {activeScenario.scenario_inputs.demand_multipliers && Object.keys(activeScenario.scenario_inputs.demand_multipliers).length > 0 && (
                  <span style={{ padding: "0.2rem 0.5rem", backgroundColor: "var(--status-watch-bg)", color: "var(--status-watch)", borderRadius: "4px", fontWeight: 600 }}>
                    Demand Surges: {JSON.stringify(activeScenario.scenario_inputs.demand_multipliers)}
                  </span>
                )}

                {activeScenario.scenario_inputs.transport_capacity_factor !== undefined && activeScenario.scenario_inputs.transport_capacity_factor < 1.0 && (
                  <span style={{ padding: "0.2rem 0.5rem", backgroundColor: "var(--status-at-risk-bg)", color: "var(--status-at-risk)", borderRadius: "4px", fontWeight: 600 }}>
                    Fleet Capacity: {(activeScenario.scenario_inputs.transport_capacity_factor * 100).toFixed(0)}% available
                  </span>
                )}
              </div>
            </div>

            {/* Feature 8 — Baseline vs Scenario Comparison Dashboard */}
            {activeScenario.comparison_metrics ? (
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)",
                padding: "1.5rem",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                      Feature 8 &bull; Baseline vs Scenario Comparative Evaluation
                    </h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Strict mathematical outputs calculated from SciPy HiGHS solver (no invented metrics)
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    Solved in {activeScenario.comparison_metrics.solver_time_ms} ms
                  </span>
                </div>

                <ScenarioRouteComparison scenario={activeScenario} />

                {/* Comparative KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                  {/* Metric 1: Total Demand */}
                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-card-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>TOTAL DEMAND</div>
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.25rem" }}>
                      {activeScenario.comparison_metrics.simulated_total_demand.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Baseline: {activeScenario.comparison_metrics.baseline_total_demand.toLocaleString()}
                      {activeScenario.comparison_metrics.demand_delta !== 0 && (
                        <strong style={{ color: "var(--primary)", marginLeft: "0.3rem" }}>
                          ({activeScenario.comparison_metrics.demand_delta > 0 ? "+" : ""}{activeScenario.comparison_metrics.demand_delta})
                        </strong>
                      )}
                    </div>
                  </div>

                  {/* Metric 2: Unmet Demand */}
                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-card-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>UNMET DEMAND DEFICIT</div>
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, color: activeScenario.comparison_metrics.simulated_unmet_demand > 0 ? "var(--status-critical)" : "var(--status-stable)", marginTop: "0.25rem" }}>
                      {activeScenario.comparison_metrics.simulated_unmet_demand.toLocaleString()} units
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Delta: <strong style={{ color: activeScenario.comparison_metrics.unmet_demand_delta > 0 ? "var(--status-critical)" : "var(--status-stable)" }}>
                        {activeScenario.comparison_metrics.unmet_demand_delta > 0 ? "+" : ""}{activeScenario.comparison_metrics.unmet_demand_delta} units
                      </strong>
                    </div>
                  </div>

                  {/* Metric 3: Fulfillment Rate */}
                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-card-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>FULFILLMENT RATE</div>
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.25rem" }}>
                      {activeScenario.comparison_metrics.fulfillment_rate_pct}%
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Priority weighted allocation
                    </div>
                  </div>

                  {/* Metric 4: Transportation Cost */}
                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-card-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>EST. TRANSPORT COST</div>
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.25rem" }}>
                      &#8377;{activeScenario.comparison_metrics.simulated_transport_cost.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Delta: &#8377;{activeScenario.comparison_metrics.cost_delta > 0 ? "+" : ""}{activeScenario.comparison_metrics.cost_delta}
                    </div>
                  </div>
                </div>

                {/* Infeasible Constraints Alert */}
                {activeScenario.infeasible_constraints && activeScenario.infeasible_constraints.length > 0 && (
                  <div style={{
                    padding: "1rem 1.25rem",
                    backgroundColor: "var(--status-critical-bg)",
                    border: "1px solid var(--status-critical-border)",
                    borderRadius: "var(--radius-md)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem", color: "var(--status-critical)" }}>
                      <AlertTriangle size={15} />
                      <span>Binding Bottlenecks & Unmet Demand Constraints:</span>
                    </div>
                    <ul style={{ margin: "0.5rem 0 0 1.25rem", fontSize: "0.8rem", color: "var(--status-critical)" }}>
                      {activeScenario.infeasible_constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Candidate Allocation Plan Table */}
                {activeScenario.allocation_plan && activeScenario.allocation_plan.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.6rem" }}>
                      Proposed Supply Allocation Plan (Awaiting Human Review):
                    </h4>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--bg-card-light)", borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Source Node</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Destination Node</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Category</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Quantity Allocated</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Assigned Vehicle</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Distance / Est. Cost</th>
                            <th style={{ padding: "0.6rem 0.8rem" }}>Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeScenario.allocation_plan.map((alloc, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "0.65rem 0.8rem", fontWeight: 600 }}>{alloc.source_location_name}</td>
                              <td style={{ padding: "0.65rem 0.8rem", fontWeight: 600 }}>{alloc.destination_location_name}</td>
                              <td style={{ padding: "0.65rem 0.8rem" }}>
                                <span style={{ padding: "0.15rem 0.45rem", backgroundColor: "var(--bg-card)", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 700 }}>
                                  {alloc.category}
                                </span>
                              </td>
                              <td style={{ padding: "0.65rem 0.8rem", fontWeight: 700 }}>{alloc.quantity_allocated.toLocaleString()}</td>
                              <td style={{ padding: "0.65rem 0.8rem" }}>{alloc.transport_resource_name}</td>
                              <td style={{ padding: "0.65rem 0.8rem" }}>{alloc.distance_km} km &bull; &#8377;{alloc.estimated_cost}</td>
                              <td style={{ padding: "0.65rem 0.8rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>{alloc.rationale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--border-strong)",
                padding: "3rem",
                textAlign: "center",
                color: "var(--text-muted)"
              }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                  Scenario is in Draft Sandbox
                </div>
                <p style={{ fontSize: "0.85rem", maxWidth: "500px", margin: "0 auto 1.25rem" }}>
                  Click "Run Isolated Simulation" above to evaluate candidate dispatches, calculate unmet demand, and generate trade-off comparisons.
                </p>
                <button onClick={handleSimulateActive} className="btn btn-primary">
                  Run Isolated Simulation
                </button>
              </div>
            )}

            {/* Approval & Audit History */}
            {activeScenario.approval_history && activeScenario.approval_history.length > 0 && (
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)",
                padding: "1.5rem",
                boxShadow: "var(--shadow-sm)"
              }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "1rem" }}>
                  Human Review & Approval Audit History:
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {activeScenario.approval_history.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0.75rem 1rem",
                        backgroundColor: "var(--bg-card-light)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--primary-dark)" }}>
                            {h.action}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            by {h.actor}
                          </span>
                        </div>
                        {h.notes && (
                          <div style={{ fontSize: "0.78rem", color: "var(--text-main)", marginTop: "0.2rem" }}>
                            "{h.notes}"
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {new Date(h.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-strong)",
            padding: "4rem 2rem",
            textAlign: "center",
            color: "var(--text-muted)"
          }}>
            Select or create a scenario to begin simulation.
          </div>
        )}
      </div>

      {/* CREATE SCENARIO MODAL */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "600px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-card-light)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Configure New What-If Scenario Sandbox
              </h3>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Scenario Code:</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Scenario Title:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Hypothesis / Description:</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              {/* Road Closures */}
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                  Simulate Tactical Corridor Road Closures:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "140px", overflowY: "auto", border: "1px solid var(--border-subtle)", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}>
                  {corridors.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem" }}>
                      <input
                        type="checkbox"
                        checked={newRoadClosures.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewRoadClosures([...newRoadClosures, c.id]);
                          else setNewRoadClosures(newRoadClosures.filter(id => id !== c.id));
                        }}
                      />
                      <span>{c.name} ({c.distance_km} km)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700 }}>
                  <span>Fuel Demand Multiplier:</span>
                  <span>{newFuelMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={newFuelMultiplier}
                  onChange={(e) => setNewFuelMultiplier(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700 }}>
                  <span>Medical Supplies Demand Multiplier:</span>
                  <span>{newMedMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={newMedMultiplier}
                  onChange={(e) => setNewMedMultiplier(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700 }}>
                  <span>Transport Fleet Availability:</span>
                  <span>{(newFleetFactor * 100).toFixed(0)}% Capacity</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.1"
                  value={newFleetFactor}
                  onChange={(e) => setNewFleetFactor(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleCreateScenario} disabled={isActing} className="btn btn-primary btn-sm">
                {isActing ? "Creating..." : "Create Scenario Sandbox"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW ACTION MODAL */}
      {showReviewModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-card-light)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Human Review Workflow: {reviewAction}
              </h3>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Officer / Reviewer Name:</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Review Notes & Justification:</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Record tactical justification, risks acknowledged, and rationale."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <button onClick={() => setShowReviewModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleExecuteReview} disabled={isActing} className="btn btn-primary btn-sm">
                {isActing ? "Processing..." : `Confirm ${reviewAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMIT SCENARIO MODAL */}
      {showCommitModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "520px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--status-stable-bg)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--status-stable)" }}>
                Commit Approved Scenario to Operational Records
              </h3>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                You are about to authorize execution for <strong>{activeScenario?.title}</strong>. This explicit human action will:
                <ul style={{ margin: "0.5rem 0 0 1.25rem", color: "var(--text-muted)" }}>
                  <li>Generate real dispatch convoys in the logistics event ledger.</li>
                  <li>Reserve or allocate corresponding stock across supply warehouses.</li>
                  <li>Assign matching transport fleet vehicles to in-transit status.</li>
                  <li>Record an indelible operational audit trail.</li>
                </ul>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Authorizing Controller:</label>
                <input
                  type="text"
                  value={committedBy}
                  onChange={(e) => setCommittedBy(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Authorization Notes:</label>
                <textarea
                  value={commitNotes}
                  onChange={(e) => setCommitNotes(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <button onClick={() => setShowCommitModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleExecuteCommit} disabled={isActing} className="btn btn-primary btn-sm" style={{ backgroundColor: "var(--status-stable)" }}>
                {isActing ? "Committing..." : "Authorize & Commit to Database"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL REPORT MODAL */}
      {showReportModal && reportData && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "750px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-card-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                {reportData.report_title}
              </h3>
              <button onClick={() => setShowReportModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto", fontSize: "0.825rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", backgroundColor: "var(--bg-card-light)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                <div><strong>System Status:</strong> {reportData.system_status}</div>
                <div><strong>Platform:</strong> {reportData.platform_version}</div>
                <div><strong>Generator:</strong> {reportData.generator}</div>
                <div><strong>Generated:</strong> {new Date(reportData.generated_at).toLocaleString()}</div>
              </div>

              <div>
                <h4 style={{ fontWeight: 700, margin: "0.5rem 0" }}>Inventory Summary:</h4>
                <div>Total Monitored Nodes: {reportData.current_inventory_summary.total_monitored_nodes}</div>
                <div>Total Stock Aggregate: {reportData.current_inventory_summary.total_available_stock_aggregate.toLocaleString()} units</div>
              </div>

              <div>
                <h4 style={{ fontWeight: 700, margin: "0.5rem 0" }}>Data Provenance & Attribution:</h4>
                <ul style={{ margin: "0 0 0 1rem", color: "var(--text-muted)" }}>
                  {Object.entries(reportData.data_provenance_and_licensing).map(([k, v]) => (
                    <li key={k}><strong>{k.toUpperCase()}:</strong> {v}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 style={{ fontWeight: 700, margin: "0.5rem 0" }}>Simulated Scenarios Recorded:</h4>
                <div>{reportData.simulated_scenarios_summary.length} scenarios on record with human review logs.</div>
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <a href={api.getJSONExportUrl()} download className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
                Download JSON Report
              </a>
              <button onClick={() => setShowReportModal(false)} className="btn btn-primary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
