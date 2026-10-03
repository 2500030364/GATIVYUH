import React, { useState, useEffect } from "react";
import { 
  Database, Upload, Download, RefreshCw, AlertTriangle, CheckCircle2, 
  FileText, ShieldCheck, FileSpreadsheet, Layers, Info
} from "lucide-react";
import { DatasetManagementOverview, CSVImportResult, api } from "../api/client";

interface DataManagerViewProps {
  onRefreshAll: () => void;
}

export const DataManagerView: React.FC<DataManagerViewProps> = ({ onRefreshAll }) => {
  const [dataOverview, setDataOverview] = useState<DatasetManagementOverview | null>(null);
  const [loading, setLoading] = useState(false);

  // CSV Import State
  const [importType, setImportType] = useState<"LOCATIONS" | "INVENTORY">("LOCATIONS");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);

  // Synthetic Generator State
  const [seed, setSeed] = useState<number>(42);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getDataStatus();
      setDataOverview(res);
    } catch (err) {
      console.error("Failed to load dataset status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleUploadCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      let result: CSVImportResult;
      if (importType === "LOCATIONS") {
        result = await api.importLocationsCSV(selectedFile);
      } else {
        result = await api.importInventoryCSV(selectedFile);
      }
      setImportResult(result);
      if (result.success) {
        setSelectedFile(null);
        fetchStatus();
        onRefreshAll();
      }
    } catch (err: any) {
      alert("Import error: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleTriggerGenerator = async () => {
    setIsGenerating(true);
    setGenResult(null);
    try {
      const res = await api.generateSyntheticData(seed, true);
      setGenResult(`Success: Generated ${res.locations_created} nodes, ${res.inventory_items_created} supplies, and ${res.events_created} events with seed ${seed}.`);
      fetchStatus();
      onRefreshAll();
    } catch (err: any) {
      setGenResult("Failed to generate demo dataset: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Header */}
      <div>
        <h2>Data Management &amp; Demonstration Pipeline</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Audit dataset origins, inspect schema validations, upload CSV records, and calibrate reproducible synthetic logistics models.
        </p>
      </div>

      {/* Dataset Audit Grid */}
      <div>
        <h3 style={{ marginBottom: "0.75rem" }}>Corridor Dataset Registry &amp; Origin Audit</h3>
        <div className="grid-cols-3">
          {dataOverview?.datasets.map((ds) => (
            <div key={ds.name} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "0.15rem 0.45rem",
                    borderRadius: "4px",
                    backgroundColor: ds.source_type === "DOWNLOADED_REAL" ? "var(--status-stable-bg)" : "var(--bg-card)",
                    color: ds.source_type === "DOWNLOADED_REAL" ? "var(--status-stable)" : "var(--text-muted)",
                    border: `1px solid ${ds.source_type === "DOWNLOADED_REAL" ? "var(--status-stable-border)" : "var(--border-subtle)"}`
                  }}>
                    {ds.source_type === "DOWNLOADED_REAL" ? "REAL GEOGRAPHIC DATA" : ds.source_type}
                  </span>

                  <span className={`badge ${ds.status === "VALID" ? "badge-stable" : "badge-watch"}`}>
                    {ds.status}
                  </span>
                </div>

                <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>{ds.name}</h4>
                <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                  {ds.description}
                </p>
              </div>

              <div style={{
                marginTop: "1rem",
                padding: "0.6rem 0.75rem",
                backgroundColor: "var(--bg-card-light)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.725rem",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Record Volume:</span>
                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{ds.record_count.toLocaleString()}</span>
                </div>
                {ds.file_info && (
                  <div style={{ marginTop: "0.2rem", color: "var(--text-light)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ds.file_info}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: CSV Data Ingestion & Synthetic Demonstration Generator */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.25rem" }}>
        
        {/* CSV Import Card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h3>Batch CSV Ingestion &amp; Row Validation</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Strict column mapping, coordinate bounds validation, and duplicate rejection.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.4rem" }}>
              <a
                href={api.getTemplateDownloadUrl("LOCATIONS")}
                download="locations_template.csv"
                className="btn btn-secondary btn-sm"
                title="Download Locations CSV sample"
              >
                <Download size={13} />
                <span>Loc Template</span>
              </a>
              <a
                href={api.getTemplateDownloadUrl("INVENTORY")}
                download="inventory_template.csv"
                className="btn btn-secondary btn-sm"
                title="Download Inventory CSV sample"
              >
                <Download size={13} />
                <span>Inv Template</span>
              </a>
            </div>
          </div>

          <form onSubmit={handleUploadCSV} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="grid-cols-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Dataset Schema</label>
                <select
                  className="form-control"
                  value={importType}
                  onChange={(e) => {
                    setImportType(e.target.value as any);
                    setImportResult(null);
                  }}
                >
                  <option value="LOCATIONS">Strategic Nodes (Locations CSV)</option>
                  <option value="INVENTORY">Forward Inventory (Stock Balances CSV)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Choose CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="form-control"
                  onChange={handleFileChange}
                  required
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {selectedFile ? `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : "Upload structured CSV to validate and ingest."}
              </span>

              <button
                type="submit"
                disabled={!selectedFile || isImporting}
                className="btn btn-primary"
              >
                <Upload size={14} />
                <span>{isImporting ? "Validating & Ingesting..." : "Validate & Import"}</span>
              </button>
            </div>
          </form>

          {/* Validation Result Box */}
          {importResult && (
            <div style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: importResult.success ? "var(--status-stable-bg)" : "var(--status-critical-bg)",
              border: `1px solid ${importResult.success ? "var(--status-stable-border)" : "var(--status-critical-border)"}`
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                {importResult.success ? (
                  <CheckCircle2 size={18} color="var(--status-stable)" />
                ) : (
                  <AlertTriangle size={18} color="var(--status-critical)" />
                )}
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: importResult.success ? "var(--status-stable)" : "var(--status-critical)" }}>
                  {importResult.message}
                </span>
              </div>

              <div style={{ fontSize: "0.775rem", color: "var(--text-main)" }}>
                Total Processed Rows: <strong>{importResult.total_rows}</strong> &bull; Imported: <strong>{importResult.imported_rows}</strong> &bull; Failed: <strong>{importResult.failed_rows}</strong>
              </div>

              {/* Row-Level Errors List */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ marginTop: "0.75rem", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--status-critical)", marginBottom: "0.3rem" }}>
                    Validation Errors Report (Row-by-Row):
                  </div>
                  <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} style={{
                        fontSize: "0.725rem",
                        padding: "0.35rem 0.5rem",
                        backgroundColor: "#FFFFFF",
                        borderRadius: "4px",
                        border: "1px solid var(--status-critical-border)"
                      }}>
                        <strong>Row {err.row_number}:</strong> {err.field ? `[Field: ${err.field}] ` : ""}{err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Synthetic Demonstration Generator Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <RefreshCw size={18} color="var(--primary)" />
              <h3>Reproducible Demo Generator</h3>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Generate reproducible fictional locations, calibrated stock balances, daily consumption rates, and convoyer events along the Pune-Mulshi-Lonavala corridor.
            </p>

            <div className="form-group" style={{ marginTop: "1.25rem" }}>
              <label className="form-label">Random Calibration Seed</label>
              <input
                type="number"
                className="form-control mono"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
                placeholder="42"
              />
              <small style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                Fixed seed guarantees identical, deterministic inventory balances and convoy events.
              </small>
            </div>

            <div style={{
              padding: "0.75rem",
              backgroundColor: "var(--bg-card-light)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)"
            }}>
              <strong>Simulated Pipeline:</strong> Creates 8 strategic corridor nodes, 64 inventory balances across 4 supply classes, and 5 operational events adhering to strict accounting rules.
            </div>

            {genResult && (
              <div style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.75rem",
                backgroundColor: "var(--status-stable-bg)",
                border: "1px solid var(--status-stable-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.75rem",
                color: "var(--status-stable)",
                fontWeight: 600
              }}>
                {genResult}
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleTriggerGenerator}
              disabled={isGenerating}
              className="btn btn-primary"
            >
              <RefreshCw size={14} className={isGenerating ? "spin-animation" : ""} />
              <span>{isGenerating ? "Generating..." : "Generate Demo Dataset"}</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
