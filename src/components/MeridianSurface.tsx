import { MeridianTelemetry, GuardianState, PathState } from "../lib/types";
import { Activity, Shield, Zap, Map, Target, Cpu, Eye, Layers, User, History } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface MeridianSurfaceProps {
  telemetry: MeridianTelemetry | null;
  mode?: "SCAN" | "FOCUS" | "SIMULATE";
}

/**
 * Renders the Meridian telemetry UI with three tabs (MAP, ENGINE, GUARDIANS) and a mode-specific theme.
 *
 * When `telemetry` is `null`, displays a centered initializing placeholder. Otherwise the component derives
 * safe fallback objects for operator, metrics, decision loop, path map, and guardians and renders:
 * a header with operator and top-line stats, a left sidebar of metrics and loop statuses, a main tabbed
 * visualizer area, and a footer of operator attributes.
 *
 * @param props.telemetry - Telemetry data used to populate the UI; may be `null` to show the initializing placeholder.
 * @param props.mode - Visual mode that determines the theme color. One of `"SCAN"`, `"FOCUS"`, or `"SIMULATE"`. Defaults to `"SCAN"`.
 * @returns A JSX element containing the full MeridianSurface interface.
 */
export default function MeridianSurface({ telemetry, mode = "SCAN" }: MeridianSurfaceProps) {
  const [activeTab, setActiveTab] = useState<"MAP" | "ENGINE" | "GUARDIANS">("MAP");

  const themeColor = useMemo(() => {
    switch (mode) {
      case "SIMULATE":
        return "#ffcc00";
      case "FOCUS":
        return "#ffffff";
      case "SCAN":
      default:
        return "#00eaff";
    }
  }, [mode]);

  if (!telemetry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#05070a] border border-[#1a3a45] text-[#00eaff] font-mono text-xs animate-pulse">
        [ INITIALIZING_LATTICE_LINK ]
      </div>
    );
  }

  const safeOperator = telemetry.operator ?? {
    name: "UNKNOWN",
    focus: 0,
    energy: 0,
    cadence: 0,
    driftCorrection: 0,
  };

  const safeMetrics = telemetry.metrics ?? {
    stability: 0,
    load: 0,
    clarity: 0,
    momentum: 0,
    risk: 0,
    harmonicAlignment: 0,
    fractalDensity: 0,
    snr: 0,
  };

  const safeDecisionLoop = telemetry.decisionLoop ?? {
    perception: "Idle",
    interpretation: "Idle",
    decision: "Idle",
    action: "Idle",
    learning: "Idle",
  };

  const safePathMap = telemetry.pathMap ?? { north: [], east: [], south: [], west: [] };
  const safeGuardians = telemetry.guardians ?? [];

  return (
    <div className="flex-1 bg-[#05070a] text-[#8899a6] font-mono selection:bg-[#00eaff33] selection:text-[#00eaff] flex flex-col h-full overflow-hidden border-l border-[#1a3a45] transition-colors duration-500">
      <header className="p-4 border-b border-[#1a3a45] flex justify-between items-center bg-[#07090c]">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 border border-[#1a3a45] bg-[#00eaff05] flex items-center justify-center transition-colors"
            style={{ color: themeColor, borderColor: `${themeColor}33` }}
          >
            <User size={18} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Primary_Operator</div>
            <div className="text-[12px] uppercase font-black tracking-tight" style={{ color: themeColor }}>
              {safeOperator.name ?? "UNKNOWN"}
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          <HeaderStat
            label="Stability"
            value={`${(telemetry.vitalityIndex ?? 0).toFixed(1)}%`}
            color={(telemetry.vitalityIndex ?? 0) < 60 ? "#ff3b3b" : "#00ff41"}
          />
          <HeaderStat label="Resonance" value={`${(telemetry.operationalMomentum ?? 0).toFixed(1)}%`} color={themeColor} />
          <HeaderStat label="Momentum" value={`${(safeMetrics.momentum ?? 0).toFixed(1)}%`} color="#00eaff" />
        </div>

        <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.2em] opacity-30">
          LATTICE_STANCE: {mode}
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-[#1a3a45] bg-[#05070a] flex flex-col pt-6 overflow-hidden">
          <div className="px-6 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-10">
            <div className="space-y-4">
              <h3 className="text-[9px] uppercase tracking-widest text-[#00eaff] opacity-50 flex items-center gap-2">
                <Activity size={12} /> Primary_Metrics
              </h3>
              <div className="space-y-3">
                <MetricBar label="Stability" value={safeMetrics.stability ?? 0} />
                <MetricBar label="Load" value={safeMetrics.load ?? 0} color="#ffcc00" />
                <MetricBar label="Clarity" value={safeMetrics.clarity ?? 0} />
                <MetricBar label="Momentum" value={safeMetrics.momentum ?? 0} color="#00ff41" />
                <MetricBar label="Risk" value={safeMetrics.risk ?? 0} color="#ff3b3b" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#1a3a4533]">
              <h3 className="text-[9px] uppercase tracking-widest text-[#00eaff] opacity-50 flex items-center gap-2">
                <Target size={12} /> Derived_Vectors
              </h3>
              <div className="space-y-4">
                <DerivedMetric label="Harmonic_Alignment" value={safeMetrics.harmonicAlignment ?? 0} sub="RESONANCE" />
                <DerivedMetric label="Fractal_Trace_Density" value={safeMetrics.fractalDensity ?? 0} sub="CHAOS_IDX" />
                <DerivedMetric label="Signal_to_Noise" value={safeMetrics.snr ?? 0} sub="ENV_CLARITY" />
              </div>
            </div>

            <div className="pt-6 border-t border-[#1a3a4533] space-y-4">
              <h3 className="text-[9px] uppercase tracking-widest text-[#00eaff] opacity-50 flex items-center gap-2">
                <History size={12} /> Decision_State
              </h3>
              <div className="space-y-2">
                <LoopStatus label="Perception" status={safeDecisionLoop.perception} />
                <LoopStatus label="Interpretation" status={safeDecisionLoop.interpretation} />
                <LoopStatus label="Decision" status={safeDecisionLoop.decision} />
                <LoopStatus label="Action" status={safeDecisionLoop.action} />
                <LoopStatus label="Learning" status={safeDecisionLoop.learning} />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-full bg-[#0a0c1033]">
          <div className="flex border-b border-[#1a3a45] h-10 bg-[#07090c]">
            <TabButton active={activeTab === "MAP"} onClick={() => setActiveTab("MAP")} label="96_Path_Lattice" icon={<Map size={12} />} />
            <TabButton active={activeTab === "ENGINE"} onClick={() => setActiveTab("ENGINE")} label="5_Move_Engine" icon={<Cpu size={12} />} />
            <TabButton active={activeTab === "GUARDIANS"} onClick={() => setActiveTab("GUARDIANS")} label="Guardian_Layer" icon={<Shield size={12} />} />
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col p-8">
            <AnimatePresence mode="wait">
              {activeTab === "MAP" && <PathMapVisualizer key="map" paths={safePathMap} />}
              {activeTab === "ENGINE" && <EngineVisualizer key="engine" loop={safeDecisionLoop} />}
              {activeTab === "GUARDIANS" && <GuardianGrid key="guardians" guardians={safeGuardians} />}
            </AnimatePresence>
          </div>

          <footer className="h-20 border-t border-[#1a3a45] bg-[#07090c] p-4 flex items-center justify-around px-12">
            <Attribute label="Focus_State" value={safeOperator.focus ?? 0} />
            <Attribute label="Energy_Dist" value={safeOperator.energy ?? 0} />
            <Attribute label="Dec_Cadence" value={safeOperator.cadence ?? 0} unit="/s" />
            <Attribute label="Drift_Corr" value={safeOperator.driftCorrection ?? 0} unit="x" />
          </footer>
        </main>
      </div>
    </div>
  );
}

/**
 * Displays a compact header statistic with an uppercase label and a colored value.
 *
 * @param label - Short uppercase label shown above the value.
 * @param value - Rendered value content (text or element) shown prominently.
 * @param color - CSS color applied to the value text.
 * @returns The header statistic element.
 */
function HeaderStat({ label, value, color }: { label: string; value: ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[8px] uppercase tracking-widest opacity-40 mb-1">{label}</div>
      <div className="text-xs font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

/**
 * Renders a labeled horizontal percentage bar with a numeric readout and animated fill.
 *
 * @param label - Label displayed above the bar.
 * @param value - Metric interpreted as a percentage; non-finite values become 0 and the value is clamped to the range 0–100.
 * @param color - CSS color used for the fill and numeric value text (default `#00eaff`).
 * @returns The JSX element representing the metric bar.
 */
function MetricBar({ label, value, color = "#00eaff" }: { label: string; value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[8px] uppercase font-bold tracking-tighter">
        <span className="opacity-40">{label}</span>
        <span style={{ color }}>{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-1 w-full bg-[#1a3a4533] rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${clamped}%` }} className="h-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
}

/**
 * Renders a compact derived-metric card with a label, a normalized numeric value, and a sublabel.
 *
 * @param label - Title text displayed in uppercase at the top-left of the card
 * @param value - Numeric metric; non-finite values are treated as `0` and the displayed value is `value / 100` formatted to two decimal places
 * @param sub - Small uppercase sublabel shown beneath the numeric value
 * @returns The rendered React element representing the derived metric card
 */
function DerivedMetric({ label, value, sub }: { label: string; value: number; sub: string }) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <div className="border border-[#1a3a4533] p-2 bg-[#00eaff03] group hover:border-[#00eaff33] transition-colors">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[9px] uppercase font-bold text-white opacity-80">{label}</span>
        <span className="text-[10px] text-[#00eaff] font-mono">{(safe / 100).toFixed(2)}</span>
      </div>
      <div className="text-[7px] uppercase opacity-40 group-hover:opacity-100 transition-opacity">{sub}</div>
    </div>
  );
}

/**
 * Renders a compact status indicator for a decision-loop step.
 *
 * Displays a colored dot and a two-line label/status row; the dot and status text change styling for specific `status` values.
 *
 * @param label - Short descriptor for the loop step shown on the left.
 * @param status - Current step state; when `status` is `"Complete"` the indicator is styled as complete (green), when `"In-Motion"` it is styled as in-progress (cyan with pulse), otherwise it is shown in a muted/low-opacity style.
 * @returns A JSX element containing the status indicator (dot + label/status).
 */
function LoopStatus({ label, status }: { label: string; status: string }) {
  const isComplete = status === "Complete";
  const isInMotion = status === "In-Motion";
  return (
    <div className="flex items-center gap-3">
      <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? "bg-[#00ff41]" : isInMotion ? "bg-[#00eaff] animate-pulse" : "bg-[#1a3a45]"}`} />
      <div className="flex-1 flex justify-between items-center text-[9px] uppercase">
        <span className="opacity-40">{label}</span>
        <span className={isComplete ? "text-[#00ff41]" : isInMotion ? "text-[#00eaff]" : "opacity-20"}>{status}</span>
      </div>
    </div>
  );
}

/**
 * Renders a tab selector button with an icon and label.
 *
 * @param active - Whether the tab is currently active; controls styling and underline indicator.
 * @param onClick - Click handler invoked when the button is pressed.
 * @param label - Text label displayed in uppercase beside the icon.
 * @param icon - Icon node rendered to the left of the label.
 * @returns A JSX element representing the tab button with active and inactive visual styles.
 */
function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button onClick={onClick} className={`px-6 flex items-center gap-2 border-r border-[#1a3a45] transition-all relative ${active ? "bg-[#0a0c10] text-[#00eaff]" : "opacity-40 hover:opacity-100"}`}>
      {icon}
      <span className="text-[9px] uppercase tracking-widest font-bold">{label}</span>
      {active && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#00eaff]" />}
    </button>
  );
}

/**
 * Renders a compact attribute card with an uppercase label and a monospaced numeric value.
 *
 * Non-finite `value` inputs are treated as `0` before display.
 *
 * @param label - The attribute label shown above the value (rendered uppercase, muted).
 * @param value - The numeric value to display; non-finite values become `0`.
 * @param unit - Optional unit string appended directly after the numeric value.
 * @returns The JSX element representing the attribute card.
 */
function Attribute({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <div className="text-center">
      <div className="text-[8px] uppercase opacity-30 mb-1">{label}</div>
      <div className="text-xs font-bold text-[#00eaff] font-mono tracking-tighter">{safe}{unit}</div>
    </div>
  );
}

/**
 * Renders a four-quadrant path map using the provided directional path collections.
 *
 * Each quadrant is a visual grid for one cardinal direction (North, East, South, West)
 * and receives the corresponding paths from `paths`.
 *
 * @param paths - Object containing `north`, `east`, `south`, and `west` arrays of path states used to populate each quadrant
 */
function PathMapVisualizer({ paths }: { paths: MeridianTelemetry["pathMap"] }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex-1 grid grid-cols-2 gap-8">
      <QuadrantGrid title="NORTH: STRATEGY" paths={paths.north ?? []} color="#00eaff" />
      <QuadrantGrid title="EAST: EXECUTION" paths={paths.east ?? []} color="#00ff41" />
      <QuadrantGrid title="SOUTH: REFLECTION" paths={paths.south ?? []} color="#ff3b3b" />
      <QuadrantGrid title="WEST: SYNTHESIS" paths={paths.west ?? []} color="#ffcc00" />
    </motion.div>
  );
}

/**
 * Render a quadrant card that visualizes a list of path states as a 6-column grid of tiles.
 *
 * Each tile displays a vertical fill proportional to the path's `value` (clamped to 0–100) and reveals the numeric value on hover.
 *
 * @param title - Human-readable title for the quadrant
 * @param paths - Array of path entries; each should include an `id` and a numeric `value` (interpreted as a percentage)
 * @param color - Fill color used for the tiles' visual fill
 * @returns A React element containing the quadrant header and a grid of value-filled tiles
 */
function QuadrantGrid({ title, paths, color }: { title: string; paths: PathState[]; color: string }) {
  return (
    <div className="space-y-3 bg-[#00eaff03] border border-[#1a3a4533] p-4 group hover:border-[#ffffff11] transition-colors relative h-full">
      <div className="flex justify-between items-center text-[10px] font-black tracking-widest" style={{ color }}>
        {title}
        <span className="opacity-20 text-[8px] font-mono">Q_ACTIVE_PATHS: {paths.length}</span>
      </div>
      <div className="grid grid-cols-6 gap-2 pt-2">
        {paths.map((p) => {
          const safe = Math.max(0, Math.min(100, Number.isFinite(p.value) ? p.value : 0));
          return (
            <div key={p.id} className="aspect-square border border-[#1a3a4522] relative overflow-hidden group/path">
              <motion.div className="absolute inset-0 bg-opacity-20 transition-all" style={{ backgroundColor: color, height: `${safe}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[6px] font-mono opacity-0 group-hover/path:opacity-100 bg-[#000000dd]">
                {safe.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render a visual 5-step operational flow that reflects the current decision-loop statuses.
 *
 * The component displays the steps: perception, interpretation, decision, action, and learning,
 * and visually highlights each step according to its status.
 *
 * @param loop - An object mapping step keys to status strings. Expected keys: `perception`, `interpretation`, `decision`, `action`, `learning`. Each value may be `"Complete"`, `"In-Motion"`, or any other string; missing keys are treated as `"Idle"`.
 * @returns A JSX element containing the Engine visualizer with status-marked step nodes and connectors.
 */
function EngineVisualizer({ loop }: { loop: MeridianTelemetry["decisionLoop"] }) {
  const steps = [
    { key: "perception", icon: <Eye size={24} />, label: "Perception" },
    { key: "interpretation", icon: <Layers size={24} />, label: "Interpretation" },
    { key: "decision", icon: <Target size={24} />, label: "Decision" },
    { key: "action", icon: <Zap size={24} />, label: "Action" },
    { key: "learning", icon: <Activity size={24} />, label: "Learning" },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col items-center justify-center space-y-12">
      <div className="text-[12px] uppercase tracking-[0.4em] opacity-40 font-bold mb-8">5-Move_Engine_Operational_Flow</div>
      <div className="flex items-center gap-10">
        {steps.map((s, idx) => {
          const status = (loop as any)?.[s.key] ?? "Idle";
          const isComplete = status === "Complete";
          const isInMotion = status === "In-Motion";
          return (
            <div key={s.key} className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-4 relative">
                <div className={`w-20 h-20 rounded-sm border flex items-center justify-center transition-all ${isComplete ? "border-[#00ff41] bg-[#00ff4108] text-[#00ff41]" : isInMotion ? "border-[#00eaff] bg-[#00eaff08] text-[#00eaff] animate-pulse shadow-[0_0_20px_#00eaff33]" : "border-[#1a3a45] opacity-20"}`}>
                  {s.icon}
                </div>
                <div className={`text-[10px] uppercase font-bold tracking-widest ${isComplete ? "text-[#00ff41]" : isInMotion ? "text-[#00eaff]" : "opacity-20"}`}>{s.label}</div>
              </div>
              {idx < steps.length - 1 && <div className="w-10 h-[1px] bg-[#1a3a45]" />}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Renders a responsive grid of guardian cards showing symbol, status, name, and alignment.
 *
 * Each guardian is displayed as a card with a status badge (styled for `ACTIVE` and `REGENERATING`), a name label, and a horizontal alignment bar with a numeric percentage.
 *
 * @param guardians - Array of guardian state objects to render as cards.
 * @returns A React element containing the responsive grid of guardian cards.
 */
function GuardianGrid({ guardians }: { guardians: GuardianState[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-6">
      {guardians.map((g) => (
        <div key={g.id} className="border border-[#1a3a45] p-5 bg-[#05070a] group hover:border-[#00eaff33] transition-all relative">
          <div className="flex justify-between items-start mb-4">
            <div className="text-2xl">{g.symbol}</div>
            <div className={`text-[7px] px-1.5 py-0.5 border rounded-xs ${g.status === "ACTIVE" ? "border-[#00ff41] text-[#00ff41]" : g.status === "REGENERATING" ? "border-[#ffcc00] text-[#ffcc00] animate-pulse" : "border-[#1a3a45] opacity-40"}`}>
              {g.status}
            </div>
          </div>
          <div className="text-[12px] uppercase font-black tracking-tight text-white mb-1">{g.name}</div>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-0.5 bg-[#1a3a4544]"><div className="h-full bg-[#00eaff]" style={{ width: `${g.alignment}%` }} /></div>
            <span className="text-[9px] text-[#00eaff] font-mono">{g.alignment}%</span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
