import { useEffect, useRef } from "react";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
  "0123456789ABCDEF$#@%&*<>/\\|!?";

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 14;
    let cols: number[] = [];
    let raf = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.floor(canvas.width / fontSize);
      cols = Array.from({ length: count }, () => Math.random() * -canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "Share Tech Mono", monospace`;

      cols.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize;

        const brightness = Math.random();
        if (brightness > 0.97) {
          ctx.fillStyle = "#e8feff";
        } else if (brightness > 0.9) {
          ctx.fillStyle = "#00f0ff";
        } else {
          ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
        }

        ctx.fillText(char, x, y);

        cols[i] = y > canvas.height + fontSize * Math.random() * 20 ? -fontSize * 10 : y + fontSize;
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        opacity: 0.18,
        pointerEvents: "none",
      }}
    />
  );
}
