import { useState, useEffect, useRef, useCallback } from "react";
import MatrixRain from "./MatrixRain";
import CursorFX from "./CursorFX";
import {
  playClick,
  playRun,
  playPass,
  playFail,
  playPin,
  playQueue,
  playTab,
  playBoot,
  playTestComplete,
} from "./sounds";
import type {
  Repo,
  QueueItem,
  PinnedItem,
  TerminalLine,
  Status,
  Stack,
  TestFile,
  IndividualTest,
  RunTarget,
  ResultToast,
} from "./types";

type ToastMode = "center" | "slide";

// ─── Semaphore for parallel workers ──────────────────────────────────────────

class Semaphore {
  private slots: number;
  private waiters: (() => void)[] = [];
  constructor(n: number) {
    this.slots = n;
  }
  acquire() {
    return new Promise<void>((r) => {
      if (this.slots > 0) {
        this.slots--;
        r();
      } else this.waiters.push(r);
    });
  }
  release() {
    const next = this.waiters.shift();
    if (next) next();
    else this.slots++;
  }
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

// Hexagon con glitch React-driven: timer random 0-50s ± 20s, recalculado cada vez
function Hexagon({
  size = 20,
  stroke = "var(--tn-cyan)",
  seed = 0,
}: {
  size?: number;
  stroke?: string;
  seed?: number;
}) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const initialDelay = (seed % 50) * 1000 + Math.random() * 5000;
    // Usar refs para todos los timers → limpieza correcta
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let alive = true;

    const scheduleNext = () => {
      const base = 20000 + Math.random() * 30000;
      const jitter = (Math.random() - 0.5) * 40000;
      const next = Math.max(0, base + jitter);

      const t1 = setTimeout(() => {
        if (!alive) return;
        setGlitching(true);
        const glitchDur = 250 + Math.random() * 400;
        const t2 = setTimeout(() => {
          if (!alive) return;
          setGlitching(false);
          scheduleNext();
        }, glitchDur);
        timers.add(t2);
      }, next);
      timers.add(t1);
    };

    const init = setTimeout(scheduleNext, initialDelay);
    timers.add(init);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [seed]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke={stroke}
      strokeWidth="1.2"
      style={{ flexShrink: 0 }}
      className={`hex-icon ${glitching ? "hex-glitching" : ""}`}
    >
      <path
        className="hex-outer"
        d="M20,3 L35,12 L35,28 L20,37 L5,28 L5,12 Z"
      />
      <path
        className="hex-inner"
        d="M20,11 L27,15 L27,25 L20,29 L13,25 L13,15 Z"
        opacity="0.5"
      />
      <circle className="hex-dot" cx="20" cy="20" r="2" fill={stroke} />
    </svg>
  );
}

function CornerBracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos: Record<string, React.CSSProperties> = {
    tl: { left: 0, top: 0 },
    tr: { right: 0, top: 0, transform: "scaleX(-1)" },
    bl: { left: 0, bottom: 0, transform: "scaleY(-1)" },
    br: { right: 0, bottom: 0, transform: "scale(-1)" },
  };
  return (
    <svg
      viewBox="0 0 40 40"
      style={{
        position: "absolute",
        width: 20,
        height: 20,
        pointerEvents: "none",
        ...pos[corner],
      }}
      fill="none"
    >
      <path d="M2,20 L2,2 L20,2" stroke="#00f0ff" strokeWidth="1.2" />
      <path
        d="M6,20 L6,6 L20,6"
        stroke="#00f0ff"
        strokeWidth="0.5"
        opacity="0.4"
      />
      <circle cx="2" cy="2" r="1.2" fill="#00f0ff" />
    </svg>
  );
}

function HeaderCircuits() {
  return (
    <svg
      className="header-circuits"
      viewBox="0 0 800 60"
      preserveAspectRatio="none"
    >
      <g stroke="#00f0ff" strokeWidth="0.7" fill="none" opacity="0.55">
        {/* Top edge — stays in top 18px */}
        <path
          className="tn-circuit-trace"
          d="M0,8 L70,8 L82,16 L200,16"
          strokeDasharray="320"
          strokeDashoffset="320"
        />
        <path
          className="tn-circuit-trace"
          d="M800,8 L730,8 L718,16 L600,16"
          strokeDasharray="320"
          strokeDashoffset="320"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Bottom edge — stays in bottom 18px */}
        <path
          className="tn-circuit-trace"
          d="M0,52 L90,52 L102,44 L260,44"
          strokeDasharray="360"
          strokeDashoffset="360"
          style={{ animationDelay: "0.7s" }}
        />
        <path
          className="tn-circuit-trace"
          d="M800,52 L710,52 L698,44 L540,44"
          strokeDasharray="360"
          strokeDashoffset="360"
          style={{ animationDelay: "1.1s" }}
        />
      </g>
      <g fill="#00f0ff">
        <circle className="tn-circuit-dot" cx="4" cy="8" r="1.5" />
        <circle
          className="tn-circuit-dot"
          cx="200"
          cy="16"
          r="1.5"
          style={{ animationDelay: "0.5s" }}
        />
        <circle
          className="tn-circuit-dot"
          cx="796"
          cy="8"
          r="1.5"
          style={{ animationDelay: "0.2s" }}
        />
        <circle
          className="tn-circuit-dot"
          cx="600"
          cy="16"
          r="1.5"
          style={{ animationDelay: "0.7s" }}
        />
        <circle
          className="tn-circuit-dot"
          cx="4"
          cy="52"
          r="1.5"
          style={{ animationDelay: "0.9s" }}
        />
        <circle
          className="tn-circuit-dot"
          cx="796"
          cy="52"
          r="1.5"
          style={{ animationDelay: "1.3s" }}
        />
      </g>
    </svg>
  );
}

function PerspectiveGrid() {
  return (
    <svg
      className="perspective-grid"
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="pg-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
          <stop offset="70%" stopColor="#00f0ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <g stroke="url(#pg-fade)" strokeWidth="0.5" fill="none">
        {Array.from({ length: 14 }).map((_, i) => {
          const y = 60 + i * i * 2.4;
          return <line key={`h-${i}`} x1="0" y1={y} x2="1200" y2={y} />;
        })}
        {Array.from({ length: 28 }).map((_, i) => {
          const x = i * (1200 / 27);
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1="60"
              x2={600 + (x - 600) * 5}
              y2="400"
            />
          );
        })}
      </g>
    </svg>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cls: Record<Status, string> = {
    pass: "status-dot dot-pass",
    fail: "status-dot dot-fail",
    pending: "status-dot dot-pending",
    running: "status-dot dot-running",
    skip: "status-dot dot-skip",
  };
  return <span className={cls[status]} />;
}

function StatusBadge({ status }: { status: Status }) {
  const cfg: Record<Status, { label: string; cls: string }> = {
    pass: { label: "PASS", cls: "status-badge status-pass" },
    fail: { label: "FAIL", cls: "status-badge status-fail" },
    pending: { label: "IDLE", cls: "status-badge status-pending" },
    running: { label: "RUNNING", cls: "status-badge status-running" },
    skip: { label: "SKIP", cls: "status-badge status-skip" },
  };
  const c = cfg[status];
  return (
    <span className={c.cls}>
      <StatusDot status={status} />
      {c.label}
    </span>
  );
}

function StackBadge({ stack }: { stack: Stack }) {
  return (
    <span className={`stack-badge stack-${stack}`}>{stack.toUpperCase()}</span>
  );
}

function addRipple(e: React.MouseEvent<HTMLElement>, sound = true) {
  if (sound) playClick();
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const r = document.createElement("span");
  r.className = "tn-ripple";
  r.style.left = `${e.clientX - rect.left}px`;
  r.style.top = `${e.clientY - rect.top}px`;
  el.appendChild(r);
  setTimeout(() => r.remove(), 500);
}

// ─── ResultToast ──────────────────────────────────────────────────────────────

function ToastCard({
  toast,
  onClose,
  mode,
}: {
  toast: ResultToast;
  onClose: () => void;
  mode: ToastMode;
}) {
  const isPass = toast.status === "pass";
  const color = isPass ? "var(--tn-green)" : "var(--tn-red)";
  const [slidePhase, setSlidePhase] = useState<"enter" | "center" | "exit">(
    "enter",
  );

  useEffect(() => {
    if (mode === "slide") {
      const t1 = setTimeout(() => setSlidePhase("center"), 250);
      const t2 = setTimeout(() => setSlidePhase("exit"), 1250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [mode]);

  const slideClass =
    mode === "slide"
      ? `slide-mode ${slidePhase === "center" ? "slide-center" : ""} ${toast.exiting || slidePhase === "exit" ? "exiting" : ""}`
      : "";

  return (
    <>
      <div className={`toast-blur-overlay ${toast.exiting ? "exiting" : ""}`} />
      <div
        className={`result-toast ${toast.exiting ? "exiting" : ""} ${slideClass}`}
        style={{ "--toast-color": color } as React.CSSProperties}
      >
        <CornerBracket corner="tl" />
        <CornerBracket corner="tr" />
        <CornerBracket corner="bl" />
        <CornerBracket corner="br" />
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="40 2000"
            style={{
              animation: "tn-perim-run 1.8s linear infinite",
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>
        <span className="toast-scan" />
        <div className="toast-progress" />
        <button className="toast-close" onClick={onClose}>
          ×
        </button>

        <div className="toast-status-row">
          <span
            className="toast-led-big"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
          />
          <span className="toast-status-text" style={{ color }}>
            {isPass ? "PASS" : "FAIL"}
          </span>
          <span
            className="toast-led-big"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
          />
        </div>
        <div className="toast-label">{toast.label}</div>
        <div className="toast-repo">{toast.repoName}</div>
        <div className="toast-meta">
          <span className="toast-meta-item">
            DURATION: <span className="toast-meta-val">{toast.duration}s</span>
          </span>
          <span className="toast-meta-item">
            STATUS:{" "}
            <span className="toast-meta-val" style={{ color }}>
              {toast.status.toUpperCase()}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}

// ─── RAM display ──────────────────────────────────────────────────────────────

function RamDisplay({
  ram,
}: {
  ram: {
    ram_available_gb: number;
    ram_total_gb: number;
    ram_percent: number;
  } | null;
}) {
  if (!ram) return <span className="ram-label">RAM: —</span>;
  const freePct = Math.round((ram.ram_available_gb / ram.ram_total_gb) * 100);
  // Color: verde cuando hay mucha libre, naranja cuando queda poco, rojo crítico
  const fillClass = freePct < 15 ? "high" : freePct < 35 ? "mid" : "low";
  return (
    <div className="ram-display">
      <span className="ram-label">RAM</span>
      <div className="ram-bar">
        <div
          className={`ram-fill ${fillClass}`}
          style={{ width: `${freePct}%` }}
        />
      </div>
      <span className="ram-value">{ram.ram_available_gb}GB FREE</span>
    </div>
  );
}

// ─── TestRow ──────────────────────────────────────────────────────────────────

function TestRow({
  test,
  onRun,
  onQueue,
  onPin,
  isQueued,
  isPinned,
  isRunning,
}: {
  test: IndividualTest;
  onRun: () => void;
  onQueue: () => void;
  onPin: () => void;
  isQueued: boolean;
  isPinned: boolean;
  isRunning: boolean;
}) {
  return (
    <div className="test-row">
      <StatusDot status={isRunning ? "running" : test.status} />
      <span className="test-name" title={test.name}>
        {test.name}
      </span>
      {test.duration !== undefined && (
        <span className="test-duration">{test.duration}ms</span>
      )}
      <div className="test-actions">
        <button
          className="btn-micro"
          onClick={onRun}
          disabled={isRunning}
          title="Run"
        >
          ▶
        </button>
        <button
          className={`btn-micro ${isQueued ? "pinned" : ""}`}
          onClick={onQueue}
          title="Add to queue"
        >
          Q
        </button>
        <button
          className={`btn-micro ${isPinned ? "pinned" : ""}`}
          onClick={onPin}
          title="Pin permanently"
        >
          ★
        </button>
      </div>
    </div>
  );
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

function FileRow({
  file,
  onRunFile,
  onQueueFile,
  onPinFile,
  onRunTest,
  onQueueTest,
  onPinTest,
  queueIds,
  pinnedIds,
  activeRunKeys,
}: {
  file: TestFile;
  onRunFile: () => void;
  onQueueFile: () => void;
  onPinFile: () => void;
  onRunTest: (t: IndividualTest) => void;
  onQueueTest: (t: IndividualTest) => void;
  onPinTest: (t: IndividualTest) => void;
  queueIds: Set<string>;
  pinnedIds: Set<string>;
  activeRunKeys: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const fname = file.path.split("/").pop() ?? file.path;
  const isFileRunning = activeRunKeys.has(file.id);
  return (
    <div>
      <div className="file-row">
        <StatusDot status={isFileRunning ? "running" : file.status} />
        <span className="file-name" title={file.path}>
          {fname}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            color: "var(--tn-text-dim)",
          }}
        >
          {file.testCount}
        </span>
        <div className="file-actions">
          <button
            className="btn-micro"
            onClick={onRunFile}
            disabled={isFileRunning}
            title="Run file"
          >
            ▶
          </button>
          <button
            className={`btn-micro ${queueIds.has(file.id) ? "pinned" : ""}`}
            onClick={onQueueFile}
            title="Queue"
          >
            Q
          </button>
          <button
            className={`btn-micro ${pinnedIds.has(file.id) ? "pinned" : ""}`}
            onClick={onPinFile}
            title="Pin"
          >
            ★
          </button>
          {file.tests.length > 0 && (
            <button
              className="btn-micro"
              onClick={() => setOpen((o) => !o)}
              title="Expand"
            >
              {open ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>
      {open && file.tests.length > 0 && (
        <div className="test-list">
          {file.tests.map((t) => (
            <TestRow
              key={t.id}
              test={t}
              onRun={() => onRunTest(t)}
              onQueue={() => onQueueTest(t)}
              onPin={() => onPinTest(t)}
              isQueued={queueIds.has(t.id)}
              isPinned={pinnedIds.has(t.id)}
              isRunning={activeRunKeys.has(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RepoCard ─────────────────────────────────────────────────────────────────

function RepoCard({
  repo,
  onRun,
  onRunFile,
  onRunTest,
  onQueue,
  onQueueFile,
  onQueueTest,
  onPin,
  onPinFile,
  onPinTest,
  queueIds,
  pinnedIds,
  activeRunKeys,
}: {
  repo: Repo;
  onRun: () => void;
  onRunFile: (f: TestFile) => void;
  onRunTest: (f: TestFile, t: IndividualTest) => void;
  onQueue: () => void;
  onQueueFile: (f: TestFile) => void;
  onQueueTest: (f: TestFile, t: IndividualTest) => void;
  onPin: () => void;
  onPinFile: (f: TestFile) => void;
  onPinTest: (f: TestFile, t: IndividualTest) => void;
  queueIds: Set<string>;
  pinnedIds: Set<string>;
  activeRunKeys: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  // Strip ecosystem prefix for cleaner display
  const stripped = repo.name.replace(/^(idyllic|basilisk)-/, "");
  const shortName =
    stripped.length > 26 ? stripped.slice(0, 23) + "…" : stripped;
  const isRunning = activeRunKeys.has(repo.id);
  const status = isRunning ? "running" : repo.status;
  const isQueued = queueIds.has(repo.id);
  const isPinned = pinnedIds.has(repo.id);

  return (
    <div
      className={`tn-card tn-boot repo-card ${isRunning ? "tn-card-running" : ""} ${isPinned ? "is-pinned" : ""} ${isQueued ? "is-queued" : ""}`}
    >
      {/* Static sticky header */}
      <div className="repo-card-static">
        <CornerBracket corner="tl" />
        <CornerBracket corner="tr" />
        <svg
          className="tn-perimeter"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="var(--tn-cyan)"
            strokeWidth="1"
          />
        </svg>
        <span className="tn-scanline" />

        <div className="repo-card-top">
          <div className="repo-card-title-row">
            <Hexagon
              size={22}
              seed={
                repo.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
                50
              }
            />
            <span className="repo-name tn-glow" title={repo.name}>
              {shortName}
            </span>
          </div>
          <div className="repo-card-badges">
            <StackBadge stack={repo.stack} />
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="repo-card-meta">
          <span className="meta-item">
            TESTS: <span className="meta-value">{repo.testCount}</span>
          </span>
          {repo.duration !== undefined && (
            <span className="meta-item">
              LAST: <span className="meta-value">{repo.duration}s</span>
            </span>
          )}
          {(repo.tags ?? []).length > 0 && (
            <div className="repo-tags">
              {(repo.tags ?? []).map((t) => (
                <span key={t} className="repo-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="tn-divider"
          style={
            {
              "--divider-delay": `-${((repo.name.charCodeAt(0) * 7 + repo.name.charCodeAt(repo.name.length - 1) * 3) % 30) / 10}s`,
            } as React.CSSProperties
          }
        />

        <div className="repo-card-actions">
          <button
            className="btn-run"
            onClick={(e) => {
              addRipple(e, false);
              onRun();
            }}
            disabled={isRunning}
          >
            {isRunning ? "◌ RUNNING..." : "▶ RUN"}
          </button>
          <button
            className={`btn-pin ${isQueued ? "pinned" : ""}`}
            onClick={onQueue}
            title="Add to queue"
          >
            {isQueued ? "⊙ QUEUED" : "+ QUEUE"}
          </button>
          <button
            className={`btn-pin ${isPinned ? "pinned" : ""}`}
            onClick={onPin}
            title="Pin permanently"
            style={{ minWidth: 0, padding: "7px 10px" }}
          >
            {isPinned ? "★" : "☆"}
          </button>
        </div>

        {/* Load bar — bloque normal debajo de los botones, completamente visible */}
        <div className="tn-load-bar" style={{ marginTop: 8 }}>
          <div className="tn-load-fill" />
        </div>

        <button
          className="expand-toggle"
          onClick={() => setExpanded((o) => !o)}
        >
          <span>
            ▼ {repo.files.length}_FILES // {repo.passedTests ?? 0}/{repo.testCount}_TESTS
          </span>
          <span className={`expand-arrow ${expanded ? "open" : ""}`}>▶</span>
        </button>
      </div>

      {/* Scrollable file list */}
      {expanded && (
        <div className="file-list" style={{ padding: "4px 0" }}>
          {repo.files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onRunFile={() => onRunFile(f)}
              onQueueFile={() => onQueueFile(f)}
              onPinFile={() => onPinFile(f)}
              onRunTest={(t) => onRunTest(f, t)}
              onQueueTest={(t) => onQueueTest(f, t)}
              onPinTest={(t) => onPinTest(f, t)}
              queueIds={queueIds}
              pinnedIds={pinnedIds}
              activeRunKeys={activeRunKeys}
            />
          ))}
        </div>
      )}

      <CornerBracket corner="bl" />
      <CornerBracket corner="br" />
    </div>
  );
}

// ─── QueueItemRow ─────────────────────────────────────────────────────────────

function QueueItemRow({
  item,
  flashClass,
  isExiting,
  onRun,
  onRemove,
  isRunning,
}: {
  item: QueueItem;
  flashClass: string;
  isExiting: boolean;
  onRun: () => void;
  onRemove: () => void;
  isRunning: boolean;
}) {
  return (
    <div
      className={`queue-item tn-boot ${flashClass} ${isExiting ? "exiting" : ""}`}
    >
      <StatusDot status={isRunning ? "running" : item.status} />
      <div className="queue-item-info">
        <div className="queue-item-name" title={item.label}>
          {item.label}
        </div>
        <div className="queue-item-repo">{item.repoName}</div>
      </div>
      <div className="queue-actions">
        <button
          className="btn-icon"
          onClick={(e) => {
            addRipple(e, false);
            onRun();
          }}
          disabled={isRunning}
          title="Run"
        >
          {isRunning ? "◌" : "▶"}
        </button>
        <button
          className="btn-icon btn-remove"
          onClick={onRemove}
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─── PinnedItemRow ────────────────────────────────────────────────────────────

function PinnedItemRow({
  item,
  onRun,
  onUnpin,
  isRunning,
}: {
  item: PinnedItem;
  onRun: () => void;
  onUnpin: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="queue-item tn-boot">
      <StatusDot status={isRunning ? "running" : item.status} />
      <div className="queue-item-info">
        <div className="queue-item-name" title={item.label}>
          {item.label}
        </div>
        <div className="queue-item-repo">{item.repoName}</div>
      </div>
      <div className="queue-actions">
        <button
          className="btn-icon"
          onClick={(e) => {
            addRipple(e, false);
            onRun();
          }}
          disabled={isRunning}
          title="Run"
        >
          {isRunning ? "◌" : "▶"}
        </button>
        <button className="btn-icon btn-remove" onClick={onUnpin} title="Unpin">
          ☆
        </button>
      </div>
    </div>
  );
}

// ─── Category helpers ─────────────────────────────────────────────────────────

type Category = "e2e" | "integration" | "unit";

const CATEGORY_DEFS: { id: Category; label: string }[] = [
  { id: "e2e", label: "E2E" },
  { id: "integration", label: "INTEGRATION" },
  { id: "unit", label: "UNIT" },
];

function getCategory(repo: Repo): Category {
  if (repo.id === "e2e" || repo.name.toLowerCase().includes("e2e"))
    return "e2e";
  if (repo.id === "smoke" || repo.stack === "pytest") return "integration";
  return "unit";
}

function catColor(repos: Repo[]): "green" | "yellow" | "red" {
  const done = repos.filter(
    (r) => r.status !== "pending" && r.status !== "running",
  );
  if (done.length === 0) return "yellow";
  const passing = done.filter((r) => r.status === "pass").length;
  if (passing === done.length) return "green";
  if (passing === 0) return "red";
  return "yellow";
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      400,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 16,
        gridColumn: "1/-1",
      }}
    >
      <Hexagon size={48} />
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: "0.3em",
          color: "var(--tn-cyan)",
        }}
      >
        SCANNING_REPOS{dots}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--tn-text-dim)",
          letterSpacing: "0.2em",
        }}
      >
        DISCOVERING TEST INFRASTRUCTURE
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [ecoFilter, setEcoFilter] = useState<"all" | "idyllic" | "basilisk">(
    "all",
  );
  const [ecoOpen, setEcoOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  // Sidebar mode
  const [sidebarMode, setSidebarMode] = useState<"queue" | "pinned">("queue");

  // Category collapse — all collapsed by default
  const ALL_COLLAPSED = new Set<Category>(["e2e", "integration", "unit"]);
  const [collapsedCategories, setCollapsedCategories] =
    useState<Set<Category>>(ALL_COLLAPSED);
  const toggleCategory = (id: Category) =>
    setCollapsedCategories((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Queue (persisted)
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ntd_queue") ?? "[]");
    } catch {
      return [];
    }
  });
  const [queueIds, setQueueIds] = useState<Set<string>>(() => {
    try {
      const items: QueueItem[] = JSON.parse(
        localStorage.getItem("ntd_queue") ?? "[]",
      );
      return new Set(items.map((i) => i.id));
    } catch {
      return new Set();
    }
  });
  const [flashingQueueIds, setFlashingQueueIds] = useState<
    Map<string, "pass" | "fail">
  >(new Map());
  const [exitingQueueIds, setExitingQueueIds] = useState<Set<string>>(
    new Set(),
  );

  // Pinned (persisted)
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ntd_pinned") ?? "[]");
    } catch {
      return [];
    }
  });
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const items: PinnedItem[] = JSON.parse(
        localStorage.getItem("ntd_pinned") ?? "[]",
      );
      return new Set(items.map((i) => i.id));
    } catch {
      return new Set();
    }
  });

  // Active runs (concurrent)
  const activeRunKeysRef = useRef<Set<string>>(new Set());
  const [activeRunKeys, setActiveRunKeys] = useState<Set<string>>(new Set());

  // Workers (persisted)
  const [workers, setWorkers] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem("ntd_workers") ?? "1", 10);
    } catch {
      return 1;
    }
  });

  // Toast mode
  const [toastMode, setToastMode] = useState<ToastMode>(
    () => (localStorage.getItem("ntd_toast_mode") as ToastMode) ?? "center",
  );

  // FX toggles
  const [fxEnabled, setFxEnabled] = useState(
    () => localStorage.getItem("ntd_fx") !== "off",
  );
  const [matrixEnabled, setMatrixEnabled] = useState(
    () => localStorage.getItem("ntd_matrix") !== "off",
  );
  const [cursorFxEnabled, setCursorFxEnabled] = useState(
    () => localStorage.getItem("ntd_cursorfx") !== "off",
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("ntd_sound") !== "off",
  );

  // Wrap playClick to respect sound toggle
  const playClickIfEnabled = useCallback(() => {
    if (soundEnabled) playClick();
  }, [soundEnabled]);

  // Mobile state
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Terminal level: 0=min(220px) 1=mid(45vh) 2=full(100vh)
  const [termLevel, setTermLevel] = useState(0);
  const termExpanded = termLevel > 0;
  const [dockerCollapsed, setDockerCollapsed] = useState(true);
  const [termCtrlCollapsed, setTermCtrlCollapsed] = useState(true);
  const [tagsCollapsed, setTagsCollapsed] = useState(true);
  const [sidebarOptionsCollapsed, setSidebarOptionsCollapsed] = useState(true);

  // Toast
  const [toast, setToast] = useState<ResultToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RAM
  const [ramInfo, setRamInfo] = useState<{
    ram_available_gb: number;
    ram_total_gb: number;
    ram_percent: number;
  } | null>(null);

  // Terminal
  const [termLines, setTermLines] = useState<TerminalLine[]>([
    { id: "0", text: "> NEXUS v0.1.0", type: "info" },
    { id: "1", text: "> SCANNING REPOSITORIES...", type: "meta" },
  ]);
  const termRef = useRef<HTMLDivElement>(null);

  // ── Fetch repos ──
  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((data: Repo[]) => {
        const userTags = Array.from(new Set(data.flatMap((r) => r.tags ?? [])));
        const stackTags = Array.from(new Set(data.map((r) => r.stack)));
        setAllTags([...new Set([...stackTags, ...userTags])]);
        setLoading(false);
        playBoot();
        appendLine(`> DISCOVERY COMPLETE — ${data.length} REPOS FOUND`, "pass");
        // Restore saved results into repos
        const savedResults: Array<{
          repoId: string;
          status: Status;
          duration?: number;
          passedTests?: number;
        }> = JSON.parse(localStorage.getItem("ntd_results") ?? "[]");
        const resultMap = new Map(savedResults.map((r) => [r.repoId, r]));
        setRepos(
          data.map((r) => {
            const saved = resultMap.get(r.id);
            return saved
              ? { ...r, status: saved.status, duration: saved.duration, passedTests: saved.passedTests ?? 0 }
              : { ...r, passedTests: 0 };
          }),
        );
      })
      .catch((err) => {
        setLoading(false);
        appendLine(`> DISCOVERY ERROR: ${err.message}`, "fail");
      });
  }, []);

  // ── Space combos = terminal resize (6 levels: 0=min … 5=full) ──
  // plain Space: toggle 5↔0 (mid→5); Shift+Space: step up; Ctrl+Space: step down
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (inInput) return;
      e.preventDefault();
      playClick();
      if (e.shiftKey && !e.ctrlKey) {
        setTermLevel((v) => Math.min(5, v + 1));
        return;
      }
      if (e.ctrlKey && !e.shiftKey) {
        setTermLevel((v) => Math.max(0, v - 1));
        return;
      }
      // plain Space: toggle max↔min; anything not at 5 → go to 5
      setTermLevel((v) => (v === 5 ? 0 : 5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Auto-reload on build change (mobile-friendly) ──
  useEffect(() => {
    let currentV: number | null = null;
    const check = () => {
      if (activeRunKeysRef.current.size > 0) return; // never reload mid-run
      fetch("/api/version")
        .then((r) => r.json())
        .then(({ v }) => {
          if (currentV === null) {
            currentV = v;
            return;
          }
          if (v !== currentV) window.location.reload();
        })
        .catch(() => {});
    };
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Poll RAM ──
  useEffect(() => {
    const poll = () =>
      fetch("/api/system")
        .then((r) => r.json())
        .then(setRamInfo)
        .catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Resize listener ──
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Collapse all categories when filters change ──
  useEffect(() => {
    setCollapsedCategories(new Set<Category>(["e2e", "integration", "unit"]));
  }, [search, ecoFilter, activeTags]);

  // ── Persist queue ──
  useEffect(() => {
    localStorage.setItem("ntd_queue", JSON.stringify(queueItems));
  }, [queueItems]);

  // ── Persist pinned ──
  useEffect(() => {
    localStorage.setItem("ntd_pinned", JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  // ── Persist workers ──
  useEffect(() => {
    localStorage.setItem("ntd_workers", String(workers));
  }, [workers]);

  // ── Auto-scroll terminal ──
  useEffect(() => {
    if (termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLines]);

  const appendLine = useCallback(
    (text: string, type: TerminalLine["type"] = "raw") => {
      setTermLines((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, type },
      ]);
    },
    [],
  );

  // ── Docker helper ──
  const DEV_COMPOSE =
    "/home/agrim/github/idyllic/repos/idyllic-infra/docker/docker-compose.dev.yml";
  const WORLDS_COMPOSE =
    "/home/agrim/github/idyllic/repos/idyllic-infra/docker/docker-compose.worlds.yml";

  const runDocker = useCallback(
    async (composeFile: string, action: string, label: string) => {
      playRun();
      appendLine(`> DOCKER ${action.toUpperCase()}: ${label}`, "info");
      try {
        const res = await fetch("/api/docker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ compose_file: composeFile, action }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { run_id, cmd } = await res.json();
        appendLine(`> CMD: ${cmd.join(" ")}`, "meta");
        const proto = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${proto}://${location.host}/ws/${run_id}`);
        await new Promise<void>((resolve) => {
          ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === "line") appendLine(msg.text, "raw");
            else if (msg.type === "done") {
              const ok = msg.exit_code === 0;
              appendLine(
                `> DOCKER DONE — exit ${msg.exit_code}`,
                ok ? "pass" : "fail",
              );
              if (ok) playPass();
              else playFail();
              ws.close();
              resolve();
            }
          };
          ws.onerror = () => resolve();
          ws.onclose = () => resolve();
        });
      } catch (err) {
        appendLine(
          `> DOCKER ERROR: ${err instanceof Error ? err.message : String(err)}`,
          "fail",
        );
        playFail();
      }
    },
    [appendLine],
  );

  const updateActiveRunKeys = useCallback(() => {
    setActiveRunKeys(new Set(activeRunKeysRef.current));
  }, []);

  // ── Show toast ──
  const showToast = useCallback((t: Omit<ResultToast, "exiting">) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ ...t, exiting: false });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, exiting: true } : null));
      setTimeout(() => setToast(null), 350);
    }, 3000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast((prev) => (prev ? { ...prev, exiting: true } : null));
    setTimeout(() => setToast(null), 350);
  }, []);

  // ── Remove queue item with exit animation ──
  const exitQueueItem = useCallback((id: string, status: "pass" | "fail") => {
    setFlashingQueueIds((prev) => new Map(prev).set(id, status));
    setTimeout(() => {
      setExitingQueueIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setQueueItems((prev) => prev.filter((q) => q.id !== id));
        setQueueIds((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        setExitingQueueIds((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
        setFlashingQueueIds((prev) => {
          const n = new Map(prev);
          n.delete(id);
          return n;
        });
      }, 450);
    }, 900);
  }, []);

  // ── Core run function ──
  const runTarget = useCallback(
    async (
      target: RunTarget,
      suppressCompletion = false,
      suppressStartSound = false,
    ): Promise<boolean> => {
      const runKey = `${target.repo_id}|${target.file_id ?? ""}|${target.test_id ?? ""}`;
      if (activeRunKeysRef.current.has(runKey)) return false;
      activeRunKeysRef.current.add(runKey);
      updateActiveRunKeys();

      setRepos((prev) =>
        prev.map((r) =>
          r.id === target.repo_id ? { ...r, status: "running" } : r,
        ),
      );
      if (!suppressStartSound) playRun();
      appendLine(`> EXECUTING: ${target.label}`, "info");

      let exitCode = 1;
      let durStr = "0";

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { run_id, cmd } = await res.json();
        appendLine(`> CMD: ${cmd.join(" ")}`, "meta");

        const proto = location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${proto}://${location.host}/ws/${run_id}`);
        const t0 = performance.now();

        await new Promise<void>((resolve) => {
          ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === "line") {
              const text: string = msg.text;
              const lineType: TerminalLine["type"] = /✓|PASS|passed/.test(text)
                ? "pass"
                : /✗|FAIL|failed|ERROR/.test(text)
                  ? "fail"
                  : text.startsWith(">")
                    ? "info"
                    : "raw";
              const prefix =
                activeRunKeysRef.current.size > 1
                  ? `[${target.repo_id.slice(0, 10)}] `
                  : "";
              appendLine(prefix + text, lineType);
            } else if (msg.type === "done") {
              exitCode = msg.exit_code ?? 1;
              durStr = ((performance.now() - t0) / 1000).toFixed(1);
              ws.close();
              resolve();
            } else if (msg.type === "error") {
              appendLine(`> ERROR: ${msg.text}`, "fail");
              ws.close();
              resolve();
            }
          };
          ws.onerror = () => resolve();
          ws.onclose = () => resolve();
        });
      } catch (err) {
        appendLine(
          `> ERROR: ${err instanceof Error ? err.message : String(err)}`,
          "fail",
        );
      } finally {
        activeRunKeysRef.current.delete(runKey);
        updateActiveRunKeys();

        const ok = exitCode === 0;
        appendLine(
          `> ${ok ? "✓" : "✗"} ${target.label} — ${durStr}s`,
          ok ? "pass" : "fail",
        );

        const runType = !target.file_id && !target.test_id ? "full"
                      : !target.test_id ? "file"
                      : "test";

        setRepos((prev) => {
          const updated = prev.map((r) => {
            if (r.id !== target.repo_id) return r;
            const cur = r.passedTests ?? 0;
            let passedTests = cur;
            let nextStatus: Status = r.status;

            if (ok) {
              if (runType === "full") {
                passedTests = r.testCount;
                nextStatus = "pass";
              } else if (runType === "file") {
                const f = r.files.find(f => f.path === target.file_id || f.id === target.file_id);
                passedTests = Math.min(r.testCount, cur + (f?.testCount ?? 1));
                nextStatus = passedTests >= r.testCount && r.testCount > 0 ? "pass" : r.status;
              } else {
                passedTests = Math.min(r.testCount, cur + 1);
                nextStatus = passedTests >= r.testCount && r.testCount > 0 ? "pass" : r.status;
              }
            } else {
              nextStatus = "fail";
              if (runType === "full") passedTests = 0;
            }

            return { ...r, status: nextStatus, passedTests, duration: parseFloat(durStr) };
          });
          const results = updated
            .filter((r) => r.status !== "pending")
            .map((r) => ({ repoId: r.id, status: r.status, duration: r.duration, passedTests: r.passedTests }));
          localStorage.setItem("ntd_results", JSON.stringify(results));
          return updated;
        });

        // Update pinned status
        setPinnedItems((prev) =>
          prev.map((p) =>
            p.repoId === target.repo_id
              ? { ...p, status: ok ? "pass" : "fail" }
              : p,
          ),
        );

        if (!suppressCompletion) {
          if (ok) playPass();
          else playFail();
        }
        showToast({
          id: crypto.randomUUID(),
          label: target.label,
          repoName: target.repo_id,
          status: ok ? "pass" : "fail",
          duration: durStr,
        });

        // Queue exit animation if this was a queue run
        if (target.queue_item_id) {
          exitQueueItem(target.queue_item_id, ok ? "pass" : "fail");
        }
      }
      return exitCode === 0;
    },
    [appendLine, updateActiveRunKeys, showToast, exitQueueItem],
  );

  // ── Run queue with N workers ──
  const runQueue = useCallback(async () => {
    const items = [...queueItems];
    if (items.length === 0) return;
    const isBatch = items.length > 1;
    playRun();
    const sem = new Semaphore(workers);
    const results = await Promise.all(
      items.map(async (item) => {
        await sem.acquire();
        try {
          return await runTarget(
            {
              repo_id: item.repoId,
              stack: item.stack,
              repo_path: item.repoPath,
              file_id: item.fileId,
              test_id: item.testId,
              label: item.label,
              queue_item_id: item.id,
            },
            isBatch,
            true,
          );
        } finally {
          sem.release();
        }
      }),
    );
    if (isBatch) playTestComplete(results.every(Boolean));
  }, [queueItems, workers, runTarget]);

  // ── Queue management ──
  const addToQueue = useCallback((item: Omit<QueueItem, "id">) => {
    playQueue();
    const id =
      item.type === "repo"
        ? item.repoId
        : item.type === "file"
          ? (item.fileId ?? item.repoId)
          : (item.testId ?? item.repoId);
    setQueueIds((prev) => {
      if (prev.has(id)) return prev;
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    setQueueItems((prev) => {
      if (prev.find((q) => q.id === id)) return prev;
      return [...prev, { ...item, id }];
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueueIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setQueueItems((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // ── Pin management ──
  const addToPin = useCallback((item: Omit<PinnedItem, "id">) => {
    playPin();
    const id =
      item.type === "repo"
        ? item.repoId
        : item.type === "file"
          ? (item.fileId ?? item.repoId)
          : (item.testId ?? item.repoId);
    setPinnedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        return n;
      }
      n.add(id);
      return n;
    });
    setPinnedItems((prev) => {
      if (prev.find((p) => p.id === id)) return prev.filter((p) => p.id !== id);
      return [...prev, { ...item, id }];
    });
  }, []);

  const removePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setPinnedItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Helper factories ──
  const makeRepoTarget = (r: Repo, qid?: string): RunTarget => ({
    repo_id: r.id,
    stack: r.stack,
    repo_path: r.path,
    label: r.name,
    queue_item_id: qid,
  });
  const makeFileTarget = (r: Repo, f: TestFile, qid?: string): RunTarget => ({
    repo_id: r.id,
    stack: r.stack,
    repo_path: r.path,
    file_id: f.path,
    label: `${r.name}:${f.path.split("/").pop()}`,
    queue_item_id: qid,
  });
  const makeTestTarget = (
    r: Repo,
    f: TestFile,
    t: IndividualTest,
    qid?: string,
  ): RunTarget => ({
    repo_id: r.id,
    stack: r.stack,
    repo_path: r.path,
    file_id: f.path,
    test_id: t.name,
    label: t.name,
    queue_item_id: qid,
  });

  const filteredRepos = repos.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.tags ?? []).some((t) => t.includes(q));
    const matchTags =
      activeTags.size === 0 ||
      (r.tags ?? []).some((t) => activeTags.has(t)) ||
      activeTags.has(r.stack);
    const matchEco =
      ecoFilter === "all" ||
      (ecoFilter === "idyllic" &&
        (r.name.startsWith("idyllic-") ||
          r.id.startsWith("idyllic-") ||
          r.id === "smoke" ||
          r.id === "e2e")) ||
      (ecoFilter === "basilisk" &&
        (r.name.startsWith("basilisk-") || r.id.startsWith("basilisk-")));
    return matchSearch && matchTags && matchEco;
  });

  const toggleTag = (t: string) =>
    setActiveTags((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });

  const totalTests = repos.reduce((s, r) => s + r.testCount, 0);
  const passing = repos.filter((r) => r.status === "pass").length;
  const isAnythingRunning = activeRunKeys.size > 0;

  return (
    <div
      className={`tn-bg-grid ${fxEnabled ? "" : "no-fx"}`}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {matrixEnabled && <MatrixRain />}
      {fxEnabled && (
        <div
          className="tn-haze"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
      {fxEnabled && (
        <div
          className="tn-heartbeat"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
      {fxEnabled && <div className="tn-hbeam tn-hbeam-1" />}
      {fxEnabled && <div className="tn-hbeam tn-hbeam-2" />}
      {fxEnabled && <div className="tn-hbeam tn-hbeam-3" />}
      {fxEnabled && <PerspectiveGrid />}
      <div
        className="tn-vignette"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
        }}
      />

      {cursorFxEnabled && !("ontouchstart" in window) && <CursorFX />}
      {toast && (
        <ToastCard toast={toast} onClose={dismissToast} mode={toastMode} />
      )}

      <div className="app-shell" style={{ position: "relative", zIndex: 10 }}>
        {/* Header */}
        <header className="app-header">
          <HeaderCircuits />
          <CornerBracket corner="tl" />
          <CornerBracket corner="bl" />
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="header-title-group">
            <h1
              className="header-title tn-glow-strong tn-glitch-strong"
              data-text="NEXUS"
            >
              NEXUS
            </h1>
            <div className="header-subtitle">&gt; MONITORING CONSOLE &lt;</div>
          </div>
          <div className="header-status-group">
            <RamDisplay ram={ramInfo} />
            {(() => {
              const total = repos.filter((r) => r.status !== "pending").length;
              const ratio = total > 0 ? passing / total : 1;
              const color =
                ratio === 1
                  ? "var(--tn-green)"
                  : ratio >= 0.5
                    ? "#ffd700"
                    : "var(--tn-red)";
              const cls =
                ratio === 1
                  ? "status-pass"
                  : ratio >= 0.5
                    ? "status-running"
                    : "status-fail";
              return (
                <span
                  className={`tn-badge ${cls}`}
                  style={{ borderColor: color, color }}
                >
                  <span
                    className="tn-led"
                    style={{
                      width: 6,
                      height: 6,
                      background: color,
                      boxShadow: `0 0 5px ${color}`,
                    }}
                  />
                  {loading ? "SCANNING..." : `${passing}/${repos.length} PASS`}
                </span>
              );
            })()}
            <span className="tn-badge status-pending">{totalTests}_TESTS</span>
            {isAnythingRunning && (
              <span className="tn-badge status-running">
                <span
                  className="tn-led"
                  style={{
                    width: 6,
                    height: 6,
                    background: "var(--tn-orange)",
                    boxShadow: "0 0 5px var(--tn-orange)",
                  }}
                />
                {activeRunKeys.size > 1
                  ? `${activeRunKeys.size} RUNNING`
                  : "RUNNING"}
              </span>
            )}
          </div>
          <CornerBracket corner="tr" />
          <CornerBracket corner="br" />
        </header>

        {/* Body */}
        <div className="app-body">
          {/* Sidebar overlay (mobile) */}
          <div
            className={`sidebar-overlay ${isMobile && sidebarOpen ? "visible" : ""}`}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Left Panel */}
          <aside className={`left-panel ${sidebarOpen ? "sidebar-open" : ""}`}>
            {/* Tabs */}
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${sidebarMode === "queue" ? "active" : ""}`}
                onClick={() => {
                  playTab();
                  setSidebarMode("queue");
                }}
              >
                QUEUE {queueItems.length > 0 ? `(${queueItems.length})` : ""}
              </button>
              <button
                className={`sidebar-tab ${sidebarMode === "pinned" ? "active" : ""}`}
                onClick={() => {
                  playTab();
                  setSidebarMode("pinned");
                }}
              >
                PINNED {pinnedItems.length > 0 ? `(${pinnedItems.length})` : ""}
              </button>
            </div>

            {/* Panel label */}
            <div className="panel-header">
              <Hexagon size={14} />
              <span className="panel-header-label">
                {sidebarMode === "queue"
                  ? `ACTIVE_QUEUE // ${queueItems.length}_ITEMS`
                  : `PINNED // ${pinnedItems.length}_ITEMS`}
              </span>
            </div>

            {/* List */}
            <div className="queue-list">
              {sidebarMode === "queue" ? (
                queueItems.length === 0 ? (
                  <div className="queue-empty">
                    <Hexagon size={28} stroke="rgba(0,240,255,0.2)" />
                    <span className="queue-empty-label">
                      QUEUE_EMPTY{"\n"}+ QUEUE TO ADD
                    </span>
                  </div>
                ) : (
                  queueItems.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      flashClass={
                        flashingQueueIds.has(item.id)
                          ? `flash-${flashingQueueIds.get(item.id)}`
                          : ""
                      }
                      isExiting={exitingQueueIds.has(item.id)}
                      isRunning={activeRunKeys.has(
                        `${item.repoId}|${item.fileId ?? ""}|${item.testId ?? ""}`,
                      )}
                      onRun={() =>
                        runTarget({
                          repo_id: item.repoId,
                          stack: item.stack,
                          repo_path: item.repoPath,
                          file_id: item.fileId,
                          test_id: item.testId,
                          label: item.label,
                          queue_item_id: item.id,
                        })
                      }
                      onRemove={() => removeFromQueue(item.id)}
                    />
                  ))
                )
              ) : pinnedItems.length === 0 ? (
                <div className="queue-empty">
                  <Hexagon size={28} stroke="rgba(0,240,255,0.2)" />
                  <span className="queue-empty-label">
                    NO_PINNED{"\n"}★ TO PIN FOREVER
                  </span>
                </div>
              ) : (
                pinnedItems.map((item) => (
                  <PinnedItemRow
                    key={item.id}
                    item={item}
                    isRunning={activeRunKeys.has(
                      `${item.repoId}|${item.fileId ?? ""}|${item.testId ?? ""}`,
                    )}
                    onRun={() =>
                      runTarget({
                        repo_id: item.repoId,
                        stack: item.stack,
                        repo_path: item.repoPath,
                        file_id: item.fileId,
                        test_id: item.testId,
                        label: item.label,
                      })
                    }
                    onUnpin={() => removePin(item.id)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="queue-footer">
              <button
                className="btn-run-queue"
                disabled={
                  (sidebarMode === "queue"
                    ? queueItems.length === 0
                    : pinnedItems.length === 0) || isAnythingRunning
                }
                onClick={async () => {
                  if (sidebarMode === "queue") {
                    await runQueue();
                  } else {
                    // Run all pinned (no exit from pinned)
                    const isBatch = pinnedItems.length > 1;
                    playRun();
                    const sem = new Semaphore(workers);
                    const results = await Promise.all(
                      pinnedItems.map(async (item) => {
                        await sem.acquire();
                        try {
                          return await runTarget(
                            {
                              repo_id: item.repoId,
                              stack: item.stack,
                              repo_path: item.repoPath,
                              file_id: item.fileId,
                              test_id: item.testId,
                              label: item.label,
                            },
                            isBatch,
                            true,
                          );
                        } finally {
                          sem.release();
                        }
                      }),
                    );
                    if (isBatch) playTestComplete(results.every(Boolean));
                  }
                }}
              >
                ▶ RUN_{sidebarMode === "queue" ? "QUEUE" : "PINNED"}
              </button>
            </div>

            {/* Options content — above toggle so button stays fixed at bottom */}
            {!sidebarOptionsCollapsed && (
              <>
                {/* Workers row */}
                <div
                  className="workers-row"
                  style={{ borderTop: "1px solid rgba(0,240,255,0.08)" }}
                >
                  <span className="workers-label">WORKERS</span>
                  <div className="workers-control">
                    <button
                      className="btn-worker"
                      onClick={() => {
                        playClick();
                        setWorkers((w) => Math.max(1, w - 1));
                      }}
                      disabled={workers <= 1}
                    >
                      −
                    </button>
                    <span className="workers-value">{workers}</span>
                    <button
                      className="btn-worker"
                      onClick={() => {
                        playClick();
                        setWorkers((w) => Math.min(8, w + 1));
                      }}
                      disabled={workers >= 8}
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* FX toggles */}
                {(
                  [
                    [
                      "ANIMS",
                      fxEnabled,
                      () => {
                        setFxEnabled((v) => {
                          localStorage.setItem("ntd_fx", !v ? "on" : "off");
                          return !v;
                        });
                      },
                    ],
                    [
                      "MATRIX",
                      matrixEnabled,
                      () => {
                        setMatrixEnabled((v) => {
                          localStorage.setItem("ntd_matrix", !v ? "on" : "off");
                          return !v;
                        });
                      },
                    ],
                    [
                      "CURSOR",
                      cursorFxEnabled,
                      () => {
                        setCursorFxEnabled((v) => {
                          localStorage.setItem(
                            "ntd_cursorfx",
                            !v ? "on" : "off",
                          );
                          return !v;
                        });
                      },
                    ],
                    [
                      "SOUND",
                      soundEnabled,
                      () => {
                        setSoundEnabled((v) => {
                          localStorage.setItem("ntd_sound", !v ? "on" : "off");
                          return !v;
                        });
                      },
                    ],
                  ] as [string, boolean, () => void][]
                ).map(([label, on, toggle]) => (
                  <div key={label} className="fx-toggle-row">
                    <span className="fx-toggle-label">{label}</span>
                    <button
                      className={`fx-toggle-btn ${on ? "on" : ""}`}
                      onClick={() => {
                        playClickIfEnabled();
                        toggle();
                      }}
                    >
                      {on ? "ON" : "OFF"}
                    </button>
                  </div>
                ))}
                {/* Toast animation mode */}
                <div
                  className="workers-row"
                  style={{ borderTop: "1px solid rgba(0,240,255,0.06)" }}
                >
                  <span className="workers-label">TOAST_FX</span>
                  <div className="workers-control" style={{ gap: 6 }}>
                    {(["center", "slide"] as ToastMode[]).map((m) => (
                      <button
                        key={m}
                        className={`btn-worker ${toastMode === m ? "active-mode" : ""}`}
                        style={{
                          width: "auto",
                          padding: "0 6px",
                          fontSize: 8,
                          letterSpacing: "0.15em",
                          background:
                            toastMode === m
                              ? "rgba(0,240,255,0.15)"
                              : "transparent",
                          borderColor:
                            toastMode === m
                              ? "var(--tn-cyan)"
                              : "rgba(0,240,255,0.2)",
                          color:
                            toastMode === m
                              ? "var(--tn-cyan)"
                              : "var(--tn-text-dim)",
                        }}
                        onClick={() => {
                          playClick();
                          setToastMode(m);
                          localStorage.setItem("ntd_toast_mode", m);
                        }}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Options toggle — always at bottom */}
            <div
              className="workers-row"
              style={{ borderTop: "1px solid rgba(0,240,255,0.08)" }}
            >
              <span className="workers-label">OPTIONS</span>
              <button
                className="fx-toggle-btn"
                onClick={() => {
                  playClick();
                  setSidebarOptionsCollapsed((v) => !v);
                }}
              >
                {sidebarOptionsCollapsed ? "▶ SHOW" : "▲ HIDE"}
              </button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="main-panel">
            {/* Search */}
            <div className="search-bar">
              <div className="search-input-wrap">
                <span className="search-prefix">&gt;</span>
                <input
                  className="search-input"
                  placeholder="SEARCH_TESTS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* Ecosystem dropdown */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  className={`tag-chip ${ecoFilter !== "all" ? "active" : ""}`}
                  style={{ gap: 6, paddingRight: 8 }}
                  onClick={() => {
                    playClick();
                    setEcoOpen((o) => !o);
                  }}
                >
                  {ecoFilter.toUpperCase()} ▾
                </button>
                {ecoOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      zIndex: 50,
                      background: "var(--tn-bg-panel)",
                      border: "1px solid var(--tn-border)",
                      boxShadow: "0 0 20px rgba(0,240,255,0.3)",
                      minWidth: 110,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {(["all", "idyllic", "basilisk"] as const).map((eco) => (
                      <button
                        key={eco}
                        onClick={() => {
                          playClick();
                          setEcoFilter(eco);
                          setEcoOpen(false);
                        }}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.2em",
                          padding: "8px 14px",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid rgba(0,240,255,0.08)",
                          color:
                            ecoFilter === eco
                              ? "var(--tn-cyan)"
                              : "var(--tn-text-dim)",
                          cursor: "pointer",
                        }}
                      >
                        {eco === ecoFilter ? "▶ " : "  "}
                        {eco.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="tags-row">
                <button
                  className={`tag-chip ${tagsCollapsed ? "" : "active"}`}
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    playClick();
                    setTagsCollapsed((v) => !v);
                  }}
                  title="Toggle tag filters"
                >
                  TAGS {tagsCollapsed ? "▶" : "▼"}
                  {activeTags.size > 0 && (
                    <span
                      className="chip-x"
                      style={{ opacity: 1, color: "var(--tn-orange)" }}
                    >
                      {activeTags.size}
                    </span>
                  )}
                </button>
                {!tagsCollapsed &&
                  allTags.map((t) => (
                    <button
                      key={t}
                      className={`tag-chip ${activeTags.has(t) ? "active" : ""}`}
                      onClick={() => toggleTag(t)}
                    >
                      {t}
                      {activeTags.has(t) && <span className="chip-x">×</span>}
                    </button>
                  ))}
              </div>
            </div>

            <div className="section-header">
              <Hexagon size={16} />
              <span className="section-label">
                {loading
                  ? "SCANNING_REPOS..."
                  : `ACTIVE_PROGRAMS // ${filteredRepos.length}_REPOS`}
              </span>
              <div className="section-line" />
              {(() => {
                const visibleCats = CATEGORY_DEFS.filter((c) =>
                  filteredRepos.some((r) => getCategory(r) === c.id),
                );
                const anyExpanded = visibleCats.some(
                  (c) => !collapsedCategories.has(c.id),
                );
                return (
                  <button
                    className="btn-run"
                    style={{ flexShrink: 0, padding: "4px 10px", fontSize: 9 }}
                    onClick={() => {
                      playClick();
                      setCollapsedCategories(
                        anyExpanded
                          ? new Set<Category>(["e2e", "integration", "unit"])
                          : new Set<Category>(),
                      );
                    }}
                  >
                    {anyExpanded ? "⊡ ALL" : "⊞ ALL"}
                  </button>
                );
              })()}
              <button
                className="btn-run"
                style={{ flexShrink: 0, padding: "4px 12px", fontSize: 9 }}
                disabled={loading || isAnythingRunning}
                onClick={async () => {
                  const isBatch = filteredRepos.length > 1;
                  playRun();
                  const sem = new Semaphore(workers);
                  const results = await Promise.all(
                    filteredRepos.map(async (repo) => {
                      await sem.acquire();
                      try {
                        return await runTarget(
                          makeRepoTarget(repo),
                          isBatch,
                          true,
                        );
                      } finally {
                        sem.release();
                      }
                    }),
                  );
                  if (isBatch) playTestComplete(results.every(Boolean));
                }}
              >
                ▶ RUN_ALL_{filteredRepos.length}
              </button>
            </div>

            <div className="repos-grid">
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                  }}
                >
                  <LoadingScreen />
                </div>
              ) : (
                CATEGORY_DEFS.map((cat) => {
                  const catRepos = filteredRepos.filter(
                    (r) => getCategory(r) === cat.id,
                  );
                  if (catRepos.length === 0) return null;
                  const passing = catRepos.filter(
                    (r) => r.status === "pass",
                  ).length;
                  const failing = catRepos.filter(
                    (r) => r.status === "fail",
                  ).length;
                  const color = catColor(catRepos);
                  const isCollapsed = collapsedCategories.has(cat.id);
                  return (
                    <div key={cat.id} className="category-section">
                      <div className={`category-header cat-color-${color}`}>
                        <button
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flex: 1,
                            background: "none",
                            border: "none",
                            color: "inherit",
                            cursor: "pointer",
                            font: "inherit",
                            letterSpacing: "inherit",
                            padding: 0,
                          }}
                          onClick={() => {
                            playClick();
                            toggleCategory(cat.id);
                          }}
                        >
                          <Hexagon size={14} stroke="currentColor" />
                          <span>{cat.label}</span>
                          <div className="cat-line" />
                          <span className="cat-badge">
                            {passing}/{catRepos.length} PASS
                          </span>
                          {failing > 0 && (
                            <span
                              className="cat-badge"
                              style={{
                                color: "var(--tn-red)",
                                borderColor: "var(--tn-red)",
                              }}
                            >
                              {failing} FAIL
                            </span>
                          )}
                          <span className="cat-arrow">
                            {isCollapsed ? "▶" : "▼"}
                          </span>
                        </button>
                        <button
                          className="cat-run-btn"
                          disabled={isAnythingRunning}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const isBatch = catRepos.length > 1;
                            playRun();
                            const sem = new Semaphore(workers);
                            const results = await Promise.all(
                              catRepos.map(async (repo) => {
                                await sem.acquire();
                                try {
                                  return await runTarget(
                                    makeRepoTarget(repo),
                                    isBatch,
                                    true,
                                  );
                                } finally {
                                  sem.release();
                                }
                              }),
                            );
                            if (isBatch)
                              playTestComplete(results.every(Boolean));
                          }}
                        >
                          ▶ RUN_{catRepos.length}
                        </button>
                      </div>
                      {!isCollapsed && (
                        <div className="category-cards">
                          {catRepos.map((repo) => (
                            <RepoCard
                              key={repo.id}
                              repo={repo}
                              activeRunKeys={activeRunKeys}
                              queueIds={queueIds}
                              pinnedIds={pinnedIds}
                              onRun={() => runTarget(makeRepoTarget(repo))}
                              onRunFile={(f) =>
                                runTarget(makeFileTarget(repo, f))
                              }
                              onRunTest={(f, t) =>
                                runTarget(makeTestTarget(repo, f, t))
                              }
                              onQueue={() =>
                                addToQueue({
                                  type: "repo",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: repo.name,
                                  status: repo.status,
                                })
                              }
                              onQueueFile={(f) =>
                                addToQueue({
                                  type: "file",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: f.path.split("/").pop() ?? f.path,
                                  status: f.status,
                                  fileId: f.path,
                                })
                              }
                              onQueueTest={(f, t) =>
                                addToQueue({
                                  type: "test",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: t.name,
                                  status: t.status,
                                  fileId: f.path,
                                  testId: t.name,
                                })
                              }
                              onPin={() =>
                                addToPin({
                                  type: "repo",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: repo.name,
                                  status: repo.status,
                                })
                              }
                              onPinFile={(f) =>
                                addToPin({
                                  type: "file",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: f.path.split("/").pop() ?? f.path,
                                  status: f.status,
                                  fileId: f.path,
                                })
                              }
                              onPinTest={(f, t) =>
                                addToPin({
                                  type: "test",
                                  repoId: repo.id,
                                  repoName: repo.name,
                                  repoPath: repo.path,
                                  stack: repo.stack,
                                  label: t.name,
                                  status: t.status,
                                  fileId: f.path,
                                  testId: t.name,
                                })
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>

        {/* Terminal */}
        {/* Docker quick buttons */}
        <div
          className="docker-bar"
          style={{
            flexShrink: 0,
            padding: "6px 16px",
            borderTop: "1px solid rgba(0,240,255,0.08)",
            background: "rgba(0,3,8,0.9)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            className="btn-terminal"
            onClick={() => {
              playClick();
              setDockerCollapsed((v) => !v);
            }}
            title="Toggle actions"
          >
            ACTIONS {dockerCollapsed ? "▶" : "▼"}
          </button>
          {!dockerCollapsed && (
            <>
              <button
                className="btn-terminal"
                onClick={() => {
                  playClick();
                  runDocker(DEV_COMPOSE, "up", "dev");
                }}
              >
                ▶ UP DEV
              </button>
              <button
                className="btn-terminal"
                onClick={() => {
                  playClick();
                  runDocker(DEV_COMPOSE, "down", "dev");
                }}
              >
                ■ DOWN DEV
              </button>
              <button
                className="btn-terminal"
                onClick={() => {
                  playClick();
                  runDocker(DEV_COMPOSE, "ps", "dev");
                }}
              >
                ≡ PS
              </button>
              <button
                className="btn-terminal"
                onClick={() => {
                  playClick();
                  fetch("/api/open-godot", { method: "POST" })
                    .then((r) => r.json())
                    .then(({ run_id }) => {
                      appendLine(`> OPENING GODOT MMO1...`, "info");
                      const proto =
                        location.protocol === "https:" ? "wss" : "ws";
                      const ws = new WebSocket(
                        `${proto}://${location.host}/ws/${run_id}`,
                      );
                      ws.onmessage = (e) => {
                        const msg = JSON.parse(e.data);
                        if (msg.type === "done") ws.close();
                      };
                    })
                    .catch((err) =>
                      appendLine(`> GODOT ERROR: ${err.message}`, "fail"),
                    );
                }}
              >
                ◈ GODOT MMO1
              </button>
              <button
                className="btn-terminal"
                onClick={() => {
                  playRun();
                  fetch("/api/reset-seed", { method: "POST" })
                    .then((r) => r.json())
                    .then(({ run_id, cmd }) => {
                      appendLine(`> RESET-AND-SEED ALL DBS`, "info");
                      appendLine(`> CMD: ${cmd.join(" ")}`, "meta");
                      const proto =
                        location.protocol === "https:" ? "wss" : "ws";
                      const ws = new WebSocket(
                        `${proto}://${location.host}/ws/${run_id}`,
                      );
                      ws.onmessage = (e) => {
                        const msg = JSON.parse(e.data);
                        if (msg.type === "line") appendLine(msg.text, "raw");
                        else if (msg.type === "done") {
                          const ok = msg.exit_code === 0;
                          appendLine(
                            `> SEED ${ok ? "✓ DONE" : "✗ FAILED"} — exit ${msg.exit_code}`,
                            ok ? "pass" : "fail",
                          );
                          if (ok) playPass();
                          else playFail();
                          ws.close();
                        }
                      };
                      ws.onerror = () => ws.close();
                    })
                    .catch((err) =>
                      appendLine(`> SEED ERROR: ${err.message}`, "fail"),
                    );
                }}
              >
                ⟳ RESET+SEED
              </button>
            </>
          )}
        </div>

        {/* Terminal FAB (mobile) */}
        {isMobile && (
          <button
            className={`terminal-fab ${termExpanded ? "active" : ""}`}
            onClick={() => {
              playClick();
              setTermLevel((v) => (v === 2 ? 0 : 2));
            }}
            title="Toggle terminal"
          >
            {termExpanded ? "×" : ">_"}
          </button>
        )}

        {/* Terminal */}
        <div
          className={`terminal-panel ${isMobile && termExpanded ? "mobile-visible" : ""}`}
          style={(() => {
            const heights = ["220px", "28vh", "38vh", "50vh", "65vh", "100vh"];
            const h = heights[termLevel] ?? "220px";
            return termLevel === 5
              ? { position: "fixed" as const, inset: 0, zIndex: 100, height: "100vh" }
              : termLevel > 0
                ? { height: h, flexShrink: 0 }
                : {};
          })()}
        >
          <div className="terminal-header">
            <div className="terminal-title">
              &gt; TERMINAL_OUTPUT
              {isAnythingRunning && (
                <span className="terminal-process">PROCESS ACTIVE</span>
              )}
            </div>
            <div className="terminal-controls">
              {!termCtrlCollapsed && (
                <>
                  <button
                    className="btn-terminal"
                    onClick={() => {
                      playClick();
                      setTermLevel((v) => (v === 5 ? 0 : 5));
                    }}
                    title="SPACE=toggle  Shift+SPACE=step up  Ctrl+SPACE=step down"
                  >
                    {termLevel === 0 ? "EXPAND" : termLevel === 5 ? "COLLAPSE" : `LVL${termLevel}→FULL`}
                  </button>
                  <button
                    className="btn-terminal"
                    onClick={() => {
                      playClick();
                      setLoading(true);
                      fetch("/api/repos")
                        .then((r) => r.json())
                        .then((data: Repo[]) => {
                          setRepos(data);
                          setAllTags((prev) => {
                            const fresh = Array.from(
                              new Set(data.flatMap((r) => r.tags ?? [])),
                            );
                            return Array.from(new Set([...prev, ...fresh]));
                          });
                          setLoading(false);
                          appendLine(
                            `> RESCAN COMPLETE — ${data.length} repos`,
                            "pass",
                          );
                        });
                    }}
                  >
                    RESCAN
                  </button>
                  <button
                    className="btn-terminal"
                    onClick={() => {
                      playClick();
                      setTermLines([]);
                    }}
                  >
                    CLEAR
                  </button>
                  <button
                    className="btn-terminal"
                    onClick={() => {
                      playClick();
                      navigator.clipboard.writeText(
                        termLines.map((l) => l.text).join("\n"),
                      );
                    }}
                  >
                    COPY
                  </button>
                </>
              )}
              <button
                className="btn-terminal"
                onClick={() => {
                  playClick();
                  setTermCtrlCollapsed((v) => !v);
                }}
                title="Toggle terminal controls"
              >
                {termCtrlCollapsed ? "▶" : "▼"}
              </button>
            </div>
          </div>
          <div className="terminal-output" ref={termRef}>
            {termLines.map((l) => (
              <span key={l.id} className={`term-line term-${l.type}`}>
                {l.text}
              </span>
            ))}
            {isAnythingRunning && <span className="term-cursor" />}
          </div>
        </div>
      </div>
    </div>
  );
}
