import { useEffect, useRef } from "react";

interface TrailNode { x: number; y: number; life: number; }
interface Hex { ang: number; rad: number; speed: number; size: number; phase: number; }
interface Ring { x: number; y: number; r: number; life: number; }
// Drag stored as continuous paths, not segments
interface DragPath { pts: { x: number; y: number }[]; life: number; }

const MAX_TRAIL = 32;
const MAX_DRAG_PTS = 200;

function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], life: number, bright: boolean) {
  if (pts.length < 2) return;
  const n = pts.length;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (n === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.strokeStyle = bright
      ? `rgba(0,240,255,${life * 0.9})`
      : `rgba(0,240,255,${life * 0.6})`;
    ctx.lineWidth = bright ? 2.5 : 1.5;
    ctx.shadowBlur = bright ? 14 : 8;
    ctx.shadowColor = "rgba(0,240,255,1)";
    ctx.stroke();
    return;
  }

  // Draw smooth quadratic bezier through midpoints, segmented for width gradient
  for (let i = 1; i < n - 1; i++) {
    const t = i / (n - 1); // 0 = tail, 1 = head
    const prev = pts[i - 1];
    const cur  = pts[i];
    const next = pts[i + 1];
    const mx0 = (prev.x + cur.x) / 2;
    const my0 = (prev.y + cur.y) / 2;
    const mx1 = (cur.x  + next.x) / 2;
    const my1 = (cur.y  + next.y) / 2;

    ctx.beginPath();
    ctx.moveTo(mx0, my0);
    ctx.quadraticCurveTo(cur.x, cur.y, mx1, my1);

    const alpha = t * life * (bright ? 0.95 : 0.75);
    const width = bright
      ? 0.8 + t * 3.0
      : 0.5 + t * 2.0;

    ctx.strokeStyle = `rgba(0,240,255,${alpha})`;
    ctx.lineWidth = width;
    ctx.shadowColor = "rgba(0,240,255,0.9)";
    ctx.shadowBlur = bright ? 6 + t * 12 : 4 + t * 8;
    ctx.stroke();
  }
}

export default function CursorFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, down: false });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let vw = window.innerWidth, vh = window.innerHeight;

    const setSize = () => {
      vw = window.innerWidth; vh = window.innerHeight;
      canvas.width = vw * dpr; canvas.height = vh * dpr;
      canvas.style.width = vw + "px"; canvas.style.height = vh + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    setSize();

    const trail: TrailNode[] = [];
    const dragPaths: DragPath[] = [];   // completed drag paths (fading)
    let activeDrag: DragPath | null = null; // current drag being drawn
    const rings: Ring[] = [];
    const hexes: Hex[] = Array.from({ length: 5 }).map((_, i) => ({
      ang: (i * Math.PI * 2) / 5, rad: 40 + i * 8,
      speed: 0.011 + i * 0.003, size: 4 + (i % 2) * 2, phase: i * 0.7,
    }));

    let hexX = -9999, hexY = -9999;
    let frame = 0;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;

      trail.push({ x: e.clientX, y: e.clientY, life: 1 });
      while (trail.length > MAX_TRAIL) trail.shift();

      if (mouseRef.current.down && activeDrag) {
        activeDrag.pts.push({ x: e.clientX, y: e.clientY });
        // Trim to max points but keep the path shape
        if (activeDrag.pts.length > MAX_DRAG_PTS) activeDrag.pts.shift();
      }
    };

    const onClick = (e: MouseEvent) => {
      rings.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
      rings.push({ x: e.clientX, y: e.clientY, r: 0, life: 1.3 });
    };

    const onDown = (e: MouseEvent) => {
      mouseRef.current.down = true;
      activeDrag = { pts: [{ x: e.clientX, y: e.clientY }], life: 1 };
      rings.push({ x: e.clientX, y: e.clientY, r: 0, life: 0.7 });
    };

    const onUp = () => {
      mouseRef.current.down = false;
      if (activeDrag && activeDrag.pts.length > 1) {
        dragPaths.push(activeDrag); // move to fading paths
      }
      activeDrag = null;
    };

    window.addEventListener("resize", setSize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    let raf = 0;
    const render = () => {
      frame++;
      const tx = mouseRef.current.x;
      const ty = mouseRef.current.y;

      if (hexX < -999) { hexX = tx; hexY = ty; }
      hexX += (tx - hexX) * 0.1;
      hexY += (ty - hexY) * 0.1;

      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // ── Smooth hover trail ──
      if (trail.length > 2) {
        drawSmoothPath(ctx, trail, 1, false);
      } else if (trail.length === 2) {
        ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y); ctx.lineTo(trail[1].x, trail[1].y);
        ctx.strokeStyle = "rgba(0,240,255,0.4)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.shadowBlur = 0;
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].life -= 0.04;
        if (trail[i].life <= 0) trail.splice(i, 1);
      }

      // ── Active drag path (bright, live) ──
      if (activeDrag && activeDrag.pts.length > 1) {
        drawSmoothPath(ctx, activeDrag.pts, 1, true);
        ctx.shadowBlur = 0;
      }

      // ── Fading completed drag paths ──
      for (let i = dragPaths.length - 1; i >= 0; i--) {
        const dp = dragPaths[i];
        dp.life -= 0.018;
        if (dp.life <= 0) { dragPaths.splice(i, 1); continue; }
        drawSmoothPath(ctx, dp.pts, dp.life, true);
        ctx.shadowBlur = 0;
      }

      // ── Click rings ──
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += 5.5; r.life -= 0.022;
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(0, 240, 255, ${r.life * 0.65})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(0, 240, 255, ${r.life * 0.22})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(r.x - r.r, r.y); ctx.lineTo(r.x + r.r, r.y);
        ctx.moveTo(r.x, r.y - r.r); ctx.lineTo(r.x, r.y + r.r);
        ctx.stroke();
        ctx.strokeStyle = `rgba(0, 240, 255, ${r.life * 0.35})`;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          if (s === 0) ctx.moveTo(r.x + Math.cos(a) * r.r * 0.6, r.y + Math.sin(a) * r.r * 0.6);
          else ctx.lineTo(r.x + Math.cos(a) * r.r * 0.6, r.y + Math.sin(a) * r.r * 0.6);
        }
        ctx.closePath(); ctx.stroke();
      }

      // ── Orbiting hexes (momentum) ──
      if (tx > -999) {
        for (const h of hexes) {
          h.ang += h.speed;
          const wob = Math.sin(frame * 0.04 + h.phase) * 4;
          const ox = hexX + Math.cos(h.ang) * (h.rad + wob);
          const oy = hexY + Math.sin(h.ang) * (h.rad + wob);
          ctx.save();
          ctx.translate(ox, oy); ctx.rotate(h.ang * 2);
          ctx.strokeStyle = "rgba(0, 240, 255, 0.55)"; ctx.lineWidth = 0.8;
          ctx.shadowColor = "rgba(0,240,255,0.6)"; ctx.shadowBlur = 4;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const a = (s * Math.PI) / 3;
            if (s === 0) ctx.moveTo(Math.cos(a) * h.size, Math.sin(a) * h.size);
            else ctx.lineTo(Math.cos(a) * h.size, Math.sin(a) * h.size);
          }
          ctx.closePath(); ctx.stroke(); ctx.restore();
        }
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 9997, pointerEvents: "none", mixBlendMode: "screen" }}
    />
  );
}
