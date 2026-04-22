import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import http from "http";
import { createHash } from "crypto";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { processSignals } from "../../src/lib/engine";
import { signals as seedSignals } from "../../src/lib/signals";
import {
  fetchMarketSignals,
  fetchNewsSignals,
  normalizeSignals,
  getResilienceState,
} from "../../src/lib/connectors";
import {
  Signal,
  ProcessedSignal,
  PlateId,
  OperatorState,
  CodexStep,
  TraceAnnotation,
  PathState,
  StateHash,
} from "../../src/lib/types";
import { runKernelDiagnostics } from "../../src/lib/mfcs/kernel.test";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");

const STATE_HISTORY_LIMIT = 50;
const HASH_BUFFER_LIMIT = 1000;
const SNAPSHOT_INTERVAL = 10;
const SNAPSHOT_LIMIT = 100;
const NODES_PER_QUADRANT = 250;

let stateHistory: OperatorState[] = [];
let hashBuffer: StateHash[] = [];
let snapshots: Map<number, OperatorState> = new Map();

/**
 * Creates an array of path entries for a quadrant, each with a unique id and initial metrics.
 *
 * @param prefix - String prefixed to each path `id` (format: `${prefix}-<index>`)
 * @returns An array of `PathState` objects with initialized fields:
 * - `id`: unique identifier using the provided `prefix`
 * - `value`: initial metric constrained between 0 and 100
 * - `drift`: small signed drift value
 * - `risk`: initial risk score (0–100)
 * - `momentum`: initial momentum (defaults to 50)
 * - `importance`: initial importance (defaults to 0.1)
 * - `lastActivation`: ISO timestamp of creation
 */
function generatePaths(prefix: string): PathState[] {
  return Array.from({ length: NODES_PER_QUADRANT }).map((_, i) => ({
    id: `${prefix}-${i + 1}`,
    value: Math.max(0, Math.min(100, Math.random() * 40 + 30)),
    drift: (Math.random() - 0.5) * 5,
    risk: Math.random() * 100,
    momentum: 50,
    importance: 0.1,
    lastActivation: new Date().toISOString(),
  }));
}

let operatorState: OperatorState = {
  sessionId: `session-${Date.now()}`,
  operatorId: "MOHAMMAD",
  tick: 0,
  phi: 0,
  readiness: 0,
  energy: 0,
  device: "DESKTOP",
  engine: { phase: "DEFINE", status: "ACTIVE" },
  telemetry: {
    SVI: 88,
    CBU: 65,
    ESQ: 92,
    OM: 78,
    AP: 12,
    pathMap: {
      north: generatePaths("N"),
      east: generatePaths("E"),
      south: generatePaths("S"),
      west: generatePaths("W"),
    },
  },
  steps: [],
  annotations: [],
  guardrailEvents: [],
  plateCounts: { I: 0, II: 0, III: 0, IV: 0, V: 0, VI: 0, VII: 0, VIII: 0, IX: 0 },
  resilience: { rateLimitState: "STABLE", circuitBreaker: "CLOSED" },
  ui: {
    focusedPanel: "NEXUS_MAIN",
    selectedSignalId: undefined,
    focusMode: "SCAN" as "SCAN" | "FOCUS" | "SIMULATE",
    targetId: undefined,
  },
  updatedAt: Date.now(),
};

(operatorState as any).currentSignal = (seedSignals as any[])[0] ?? null;

const guardrailChecks = [
  (step: CodexStep) => {
    if (step.plateId === "IV" && step.metrics.risk > 0.8) {
      return {
        guardrailId: "NO_PLATE_IV_HIGH_VOL",
        violated: true,
        reason: "Plate IV activation under excessive risk",
      };
    }
    return { violated: false };
  },
];

/**
 * Identifies high-value "hotspot" paths in the state's quadrant path map and reports their count and density.
 *
 * @returns `hotspotCount` — number of paths with `value` greater than 85; `criticalDensity` — fraction of all quadrant paths that are hotspots (a number between 0 and 1)
 */
function detectPatterns(state: OperatorState) {
  const all = [
    ...state.telemetry.pathMap.north,
    ...state.telemetry.pathMap.east,
    ...state.telemetry.pathMap.south,
    ...state.telemetry.pathMap.west,
  ];
  const hotspots = all.filter((p) => p.value > 85);
  return { hotspotCount: hotspots.length, criticalDensity: hotspots.length / all.length };
}

/**
 * Compute a deterministic SHA-256 hex fingerprint of the state's key telemetry and aggregated path values.
 *
 * @param state - Operator state; only `tick`, `telemetry.SVI`, and the sum of all `telemetry.pathMap` values are included in the fingerprint
 * @returns The SHA-256 hex digest representing the serialized fingerprint of those selected state fields
 */
function generateStateHash(state: OperatorState): string {
  const content = JSON.stringify({
    tick: state.tick,
    SVI: state.telemetry.SVI,
    pathSum: [
      ...state.telemetry.pathMap.north,
      ...state.telemetry.pathMap.east,
      ...state.telemetry.pathMap.south,
      ...state.telemetry.pathMap.west,
    ].reduce((sum, p) => sum + p.value, 0),
  });
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Advance the operator tick and persist the current state into history, a hash buffer, and periodic snapshots while enforcing configured size limits.
 *
 * This mutates module-level in-memory stores: appends a deep-cloned state to `stateHistory`, appends a state-hash record (including selected telemetry and UI focus mode) to `hashBuffer`, and, every configured interval, stores a deep-cloned snapshot in `snapshots`. Older entries are trimmed to respect `STATE_HISTORY_LIMIT`, `HASH_BUFFER_LIMIT`, and `SNAPSHOT_LIMIT`.
 *
 * @returns The updated `operatorState` object
 */
function sense() {
  operatorState.tick++;
  stateHistory.push(JSON.parse(JSON.stringify(operatorState)));
  if (stateHistory.length > STATE_HISTORY_LIMIT) stateHistory.shift();

  hashBuffer.push({
    tick: operatorState.tick,
    hash: generateStateHash(operatorState),
    timestamp: Date.now(),
    metrics: { SVI: operatorState.telemetry.SVI, OM: operatorState.telemetry.OM },
    mode: operatorState.ui.focusMode,
  });
  if (hashBuffer.length > HASH_BUFFER_LIMIT) hashBuffer.shift();

  if (operatorState.tick % SNAPSHOT_INTERVAL === 0) {
    snapshots.set(operatorState.tick, JSON.parse(JSON.stringify(operatorState)));
    if (snapshots.size > SNAPSHOT_LIMIT) {
      snapshots.delete(Math.min(...snapshots.keys()));
    }
  }

  return operatorState;
}

/**
 * Recomputes telemetry from current path values, enforces guardrails, and may revert to a recent snapshot when instability is detected.
 *
 * Updates the provided state's telemetry (SVI, OM, AP), appends a guardrail event and damps `phi`/`readiness` when the energy envelope is excessive, and sets `resilience.rateLimitState` to `"THROTTLED"` if pattern density is high. If computed stability falls below a threshold and snapshots exist, returns a deep clone of the latest snapshot instead of the mutated state.
 *
 * @param state - The operator state to evaluate and potentially mutate
 * @returns The updated `OperatorState`, or a deep-cloned snapshot `OperatorState` when a stability rollback is triggered
 */
function evaluate(state: OperatorState) {
  const allPaths = [
    ...state.telemetry.pathMap.north,
    ...state.telemetry.pathMap.east,
    ...state.telemetry.pathMap.south,
    ...state.telemetry.pathMap.west,
  ];
  const energies = allPaths.map((p) => p.value / 100);
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const variance = energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length;
  const stability = Math.max(0, Math.min(1, 1 - variance * 4));

  state.telemetry.SVI = stability * 100;
  state.telemetry.OM = mean * 100;
  state.telemetry.AP = (energies.filter((e) => e < 0.2).length / allPaths.length) * 100;

  const envelope = state.energy + state.phi + 0.5 * state.readiness;
  if (envelope > 150) {
    state.guardrailEvents.unshift({
      id: `ge-env-${Date.now()}`,
      timestamp: new Date().toISOString(),
      guardrailId: "ENVELOPE_INFLATION",
      severity: "MED",
      reason: `Stability envelope breached: ${envelope.toFixed(1)} > 150. Engaging dissipation.`,
    });
    state.phi *= 0.9;
    state.readiness *= 0.9;
  }

  if (detectPatterns(state).criticalDensity > 0.1) state.resilience.rateLimitState = "THROTTLED";

  if (stability < 0.35 && snapshots.size > 0) {
    const latest = snapshots.get(Math.max(...snapshots.keys()));
    if (latest) return JSON.parse(JSON.stringify(latest));
  }

  return state;
}

/**
 * Updates the operator state in-place according to the current engine phase and applies bounded random drift to quadrant path values.
 *
 * @param state - The operator state object to update; the function mutates fields such as `phi`, `readiness`, `energy`, quadrant path values/importance, `ui.targetId`, and `updatedAt`.
 * @returns The same `OperatorState` instance after modifications.
 */
function adjust(state: OperatorState) {
  const driftBound = (state.resilience.rateLimitState === "THROTTLED" ? 0.02 : 0.05) * 100;
  const phase = state.engine.phase;

  if (phase === "GENERATE") state.phi = Math.min(100, state.phi + 2);
  else if (phase === "CHOOSE") {
    if (state.phi >= 60) {
      state.phi = Math.max(0, state.phi - 1);
      state.readiness = Math.min(100, state.readiness + 4);
    } else {
      state.phi = Math.min(100, state.phi + 2);
      state.readiness = Math.min(100, state.readiness + 1);
    }
  } else if (phase === "ACT") {
    if (state.energy === 0 && state.phi > 0) state.energy = state.phi;
    state.energy = Math.max(0, state.energy - 3);
  } else if (phase === "LEARN") {
    state.readiness = Math.max(0, state.readiness - 5);
    state.phi = Math.max(0, state.phi - 2);
    state.energy = Math.max(0, state.energy - 1);
  }

  const updateQuadrant = (paths: PathState[]) =>
    paths.map((p) => {
      const newValue = Math.max(0, Math.min(100, p.value + (Math.random() - 0.5) * driftBound));
      const e = newValue / 100;
      const importance = e > 0.8 ? 1.0 : e > 0.5 ? 0.6 : e > 0.2 ? 0.3 : 0.05;
      return { ...p, value: newValue, importance };
    });

  state.telemetry.pathMap.north = updateQuadrant(state.telemetry.pathMap.north);
  state.telemetry.pathMap.east = updateQuadrant(state.telemetry.pathMap.east);
  state.telemetry.pathMap.south = updateQuadrant(state.telemetry.pathMap.south);
  state.telemetry.pathMap.west = updateQuadrant(state.telemetry.pathMap.west);

  const all = [
    ...state.telemetry.pathMap.north,
    ...state.telemetry.pathMap.east,
    ...state.telemetry.pathMap.south,
    ...state.telemetry.pathMap.west,
  ];
  state.ui.targetId = all.reduce((a, b) => (a.value > b.value ? a : b)).id;
  state.updatedAt = Date.now();
  return state;
}

/**
 * Advance the operator simulation by one tick and produce the next state.
 *
 * @param state - The current operator state to advance
 * @returns The next OperatorState after evaluation and adjustment for the advanced tick
 */
function runStep(state: OperatorState): OperatorState {
  let next = JSON.parse(JSON.stringify(state));
  next.tick++;
  next = evaluate(next);
  next = adjust(next);
  return next;
}

/**
 * Advance the operator engine to the next phase and refresh the global operatorState's telemetry, resilience status, and updated timestamp.
 *
 * The function computes a small time-based oscillation to update telemetry fields (SVI, CBU, ESQ, OM, AP), sets the resilience rate limit to
 * "THROTTLED" when observed latency exceeds 200ms (otherwise "STABLE"), and marks the circuit breaker as "CLOSED".
 *
 * @param signals - Recent processed signals used to synchronize operator state with external inputs
 */
function syncOperatorState(signals: ProcessedSignal[]) {
  const resilience = getResilienceState();
  const seed = Date.now() / 10000;
  const phases: OperatorState["engine"]["phase"][] = ["DEFINE", "GENERATE", "CHOOSE", "ACT", "LEARN"];
  const nextPhase = phases[(phases.indexOf(operatorState.engine.phase) + 1) % phases.length];

  operatorState = {
    ...operatorState,
    engine: { ...operatorState.engine, phase: nextPhase },
    telemetry: {
      ...operatorState.telemetry,
      SVI: 85 + Math.sin(seed) * 5,
      CBU: 60 + Math.cos(seed) * 10,
      ESQ: 90 + Math.sin(seed * 0.5) * 5,
      OM: 75 + Math.cos(seed * 0.5) * 5,
      AP: 15 + Math.sin(seed * 2) * 5,
    },
    resilience: {
      rateLimitState: resilience.latency > 200 ? "THROTTLED" : "STABLE",
      circuitBreaker: "CLOSED",
    },
    updatedAt: Date.now(),
  };
}

/**
 * Boots and runs the HTTP and WebSocket server that serves the operator simulation and control APIs.
 *
 * Sets up Express middleware and HTTP routes (health, state, annotations, guardrail events, lab view,
 * stability hashes/snapshots, annotation creation) and two streaming AI endpoints gated by GEMINI_API_KEY.
 * Mounts Vite middleware in development or serves static assets in production. Creates a WebSocket server
 * at the root path that accepts client connections, handles intent and UI event messages, implements
 * keepalive (ping/pong), and broadcasts state updates to connected clients.
 *
 * Also starts the simulation and orchestration loops: a short-interval loop (~618ms) that advances sensing,
 * evaluation, and adjustment and broadcasts updates, and a longer-interval loop (~5000ms) that fetches and
 * processes external signals, applies guardrail checks, resynchronizes operator resilience/telemetry,
 * and broadcasts. On critical failure the process exits with code 1.
 */
async function startServer() {
  try {
    runKernelDiagnostics();

    const app = express();
    app.use(cors());
    app.use((req, _res, next) => {
      console.log(`[HTTP_REQ] ${req.method} ${req.url}`);
      next();
    });
    app.set("trust proxy", true);

    const PORT = 3000;
    const isProd = process.env.NODE_ENV === "production";

    if (isProd && !process.env.GEMINI_API_KEY) {
      console.warn("[OMEGA_SECURITY_ALERT] GEMINI_API_KEY is not defined in the production environment.");
    }

    let currentSignals: Signal[] = seedSignals;
    let lastProcessed: ProcessedSignal[] = [];

    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok", version: "1.5.0-omega", telemetry: { uptime: process.uptime(), memory: process.memoryUsage().rss, engineStatus: operatorState.engine.status } });
    });
    app.get("/api/state", (_req, res) => res.json(operatorState));
    app.get("/api/codex/annotations", (_req, res) => res.json(operatorState.annotations));
    app.get("/api/codex/guardrails/events", (_req, res) => res.json(operatorState.guardrailEvents));
    app.get("/api/lab", (_req, res) => {
      const fallbackSignal = { id: "signal-0", name: "Fallback Signal" };
      res.json({
        annotations: operatorState.annotations,
        guardrailEvents: operatorState.guardrailEvents,
        plateCounts: operatorState.plateCounts,
        telemetry: operatorState.telemetry,
        phi: operatorState.phi,
        readiness: operatorState.readiness,
        energy: operatorState.energy,
        rateLimitState: operatorState.resilience.rateLimitState,
        currentSignal: (operatorState as any).currentSignal ?? fallbackSignal,
      });
    });
    app.get("/api/stability/hashes", (_req, res) => res.json(hashBuffer));
    app.get("/api/stability/snapshots", (_req, res) => res.json(Array.from(snapshots.keys())));

    app.post("/api/codex/annotations", express.json(), (req, res) => {
      const annotation: TraceAnnotation = { id: `ann-${Date.now()}`, createdAt: new Date().toISOString(), author: "MOHAMMAD", ...req.body };
      operatorState.annotations.unshift(annotation);
      res.status(201).json(annotation);
    });

    app.post("/api/oracle", express.json(), async (req, res) => {
      const { prompt, metrics } = req.body;
      if (!process.env.GEMINI_API_KEY) return res.json({ text: "Lattice resonance stable but external oracle link decoupled." });
      try {
        const userPrompt = metrics
          ? `SVI:${metrics.SVI} OM:${metrics.OM} AP:${metrics.AP} Phi:${metrics.phi} Readiness:${metrics.readiness} Energy:${metrics.energy} Mode:${metrics.mode}`
          : prompt || "Requesting strategic briefing.";
        const result = await streamText({
          model: google("gemini-3-flash-preview"),
          prompt: userPrompt,
          system: "You are the Nexus Oracle.",
        });
        result.pipeTextStreamToResponse(res);
      } catch (err) {
        console.error("[ORACLE_STREAM_ERR]", err);
        res.status(500).json({ error: "Streaming Failure" });
      }
    });

    app.post("/api/advisor", express.json(), async (req, res) => {
      const { prompt } = req.body;
      if (!process.env.GEMINI_API_KEY) return res.status(401).json({ error: "GEMINI_API_KEY missing" });
      try {
        const result = await streamText({
          model: google("gemini-3-flash-preview"),
          prompt: prompt || "Provide a high-level strategic overview of the OMEGA LATTICE current state.",
          system: "You are the Nexus Oracle.",
        });
        result.pipeTextStreamToResponse(res);
      } catch (err) {
        console.error("[ADVISOR_STREAM_ERR]", err);
        res.status(500).json({ error: "Streaming Failure" });
      }
    });

    const server = http.createServer(app);

    if (!isProd) {
      const vite = await createViteServer({
        root: ROOT_DIR,
        server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      if (request.httpVersion !== "1.1") return socket.destroy();
      const { pathname } = new URL(request.url || "/", `http://${request.headers.host}`);
      if (pathname !== "/") return socket.destroy();
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[OMEGA_CORE] Server running at http://localhost:${PORT}`);
    });

    function broadcast() {
      const payload = JSON.stringify({ type: "STATE_UPDATE", payload: operatorState, signals: lastProcessed });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      });
    }

    const simulateLiveInputs = () => {
      if (operatorState.resilience.rateLimitState === "THROTTLED") return;
      const driftBoost = Math.random() > 0.9 ? 15 : 0;
      operatorState.telemetry.CBU = Math.min(100, operatorState.telemetry.CBU + (Math.random() - 0.5) * 2 + driftBoost / 10);
    };

    setInterval(() => {
      simulateLiveInputs();
      operatorState = sense();
      operatorState = evaluate(operatorState);
      operatorState = adjust(operatorState);
      broadcast();
    }, 618);

    setInterval(async () => {
      try {
        const [mkt, news] = await Promise.all([fetchMarketSignals(), fetchNewsSignals()]);
        currentSignals = normalizeSignals([...currentSignals, ...mkt, ...news])
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 11);
        lastProcessed = processSignals(currentSignals, lastProcessed);

        for (const p of lastProcessed) {
          if (!p.codex_alignment) continue;
          const step: CodexStep = {
            id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            timestamp: new Date().toISOString(),
            plateId: p.codex_alignment,
            plateName: `Plate_${p.codex_alignment}`,
            operator: operatorState.operatorId,
            signalId: p.id,
            metrics: { stability: p.score, risk: p.risk, momentum: p.momentum },
          };
          operatorState.steps.unshift(step);
          operatorState.currentSignal = p;
          for (const check of guardrailChecks) {
            const result = check(step);
            if (result.violated && result.guardrailId) {
              operatorState.guardrailEvents.unshift({
                id: `ge-${Date.now()}`,
                timestamp: new Date().toISOString(),
                guardrailId: result.guardrailId,
                severity: "HIGH",
                reason: result.reason || "VIOLATION",
                step,
              });
            }
          }
        }

        const counts: Record<PlateId, number> = { I: 0, II: 0, III: 0, IV: 0, V: 0, VI: 0, VII: 0, VIII: 0, IX: 0 };
        for (const p of lastProcessed) if (p.codex_alignment) counts[p.codex_alignment]++;

        operatorState.steps = operatorState.steps.slice(0, 50);
        operatorState.guardrailEvents = operatorState.guardrailEvents.slice(0, 100);
        operatorState.plateCounts = counts;

        syncOperatorState(lastProcessed);
        broadcast();
      } catch (err) {
        console.error("[OMEGA_ERR] Cycle failed:", err);
      }
    }, 5000);

    wss.on("connection", (ws, req) => {
      const ip = req.socket.remoteAddress;
      console.log(`[WS_CONNECTED] Peer: ${ip}`);

      let isAlive = true;
      ws.on("pong", () => {
        isAlive = true;
      });

      const pingInterval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!isAlive) return ws.terminate();
        isAlive = false;
        ws.ping();
      }, 30000);

      const sendToClient = (obj: unknown) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
      };

      ws.on("message", (message, isBinary) => {
        if (isBinary) return;
        try {
          const msg = JSON.parse(message.toString());
          if (msg.type === "INTENT") {
            const { action, meta } = msg.payload;
            sendToClient({ type: "ACK", payload: { action, status: "RECEIVED", timestamp: Date.now() } });
            if (action === "STABILIZE") {
              const dampen = (paths: PathState[]) => paths.map((p) => ({ ...p, value: p.value * 0.8 }));
              operatorState.telemetry.pathMap.north = dampen(operatorState.telemetry.pathMap.north);
              operatorState.telemetry.pathMap.east = dampen(operatorState.telemetry.pathMap.east);
              operatorState.telemetry.pathMap.south = dampen(operatorState.telemetry.pathMap.south);
              operatorState.telemetry.pathMap.west = dampen(operatorState.telemetry.pathMap.west);
              operatorState.telemetry.SVI = Math.min(100, operatorState.telemetry.SVI * 1.2);
              sendToClient({ type: "ACK", payload: { action, status: "OK", result: "Stabilization pulse emitted." } });
            }
            if (action === "BOOST") {
              const ignite = (paths: PathState[]) =>
                paths.map((p) => ({ ...p, value: Math.min(100, p.value * 1.3 + 5) }));
              operatorState.telemetry.pathMap.north = ignite(operatorState.telemetry.pathMap.north);
              operatorState.telemetry.pathMap.east = ignite(operatorState.telemetry.pathMap.east);
              operatorState.telemetry.pathMap.south = ignite(operatorState.telemetry.pathMap.south);
              operatorState.telemetry.pathMap.west = ignite(operatorState.telemetry.pathMap.west);
              operatorState.telemetry.OM = Math.min(100, operatorState.telemetry.OM * 1.25);
              sendToClient({ type: "ACK", payload: { action, status: "OK", result: "High-energy ignition successful." } });
            }
            if (action === "PREDICTION") {
              const steps = meta?.steps || 12;
              const ghosts = [];
              let currentGhost = JSON.parse(JSON.stringify(operatorState));
              for (let i = 0; i < steps; i++) {
                currentGhost = runStep(currentGhost);
                ghosts.push(currentGhost);
              }
              sendToClient({ type: "PREDICTION_VECT", payload: { snapshots: ghosts, targetTick: operatorState.tick + steps } });
            }
            if (action === "TRACE") {
              const limit = Math.min(100, meta?.limit || 50);
              sendToClient({ type: "TRACE_RESULT", payload: { entries: stateHistory.slice(-limit) } });
            }
            broadcast();
          }
          if (msg.type === "UI_EVENT") {
            const { action, id, mode } = msg.payload;
            if (action === "SELECT_SIGNAL") {
              operatorState.ui.selectedSignalId = id;
              operatorState.ui.focusMode = "FOCUS";
            }
            if (action === "SET_FOCUS_MODE") {
              operatorState.ui.focusMode = mode as "SCAN" | "FOCUS" | "SIMULATE";
            }
            if (action === "STABILIZE_SYSTEM") {
              lastProcessed = lastProcessed.map((signal) => ({
                ...signal,
                volatility: Math.max(0.1, signal.volatility * 0.5),
                confidence: Math.min(0.95, signal.confidence * 1.2),
                score: Math.min(100, signal.score * 1.1),
              }));
              operatorState.telemetry.SVI = Math.min(100, operatorState.telemetry.SVI * 1.15);
              operatorState.telemetry.CBU = Math.max(10, operatorState.telemetry.CBU * 0.8);
              operatorState.telemetry.AP = Math.max(0, operatorState.telemetry.AP * 0.4);
              operatorState.updatedAt = Date.now();
            }
            broadcast();
          }
        } catch (e) {
          console.error("UI_EVENT processing error", e);
        }
      });

      ws.on("close", () => {
        clearInterval(pingInterval);
        console.log(`[WS_DISCONNECTED] Peer: ${ip}`);
      });

      ws.send(JSON.stringify({ type: "STATE_UPDATE", payload: operatorState, signals: lastProcessed }));
    });
  } catch (err) {
    console.error("[CRITICAL_SERVER_FAILURE]", err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("[SHUTDOWN_SYNC_FAILURE]", err);
  process.exit(1);
});
