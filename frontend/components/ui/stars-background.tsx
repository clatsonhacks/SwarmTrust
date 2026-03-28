"use client";
import { useEffect, useRef } from "react";

interface Dot {
  x: number; y: number;
  r: number; opacity: number;
  speed: number; dir: number;
}

export function StarsBackground({
  starDensity = 0.00015,
  allStarsTwinkle = true,
  twinkleProbability = 0.7,
  minTwinkleSpeed = 0.5,
  maxTwinkleSpeed = 1,
}: {
  starDensity?: number;
  allStarsTwinkle?: boolean;
  twinkleProbability?: number;
  minTwinkleSpeed?: number;
  maxTwinkleSpeed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let dots: Dot[] = [];

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.floor(canvas.width * canvas.height * starDensity);
      dots = Array.from({ length: count }, () => {
        const twinkle = allStarsTwinkle || Math.random() < twinkleProbability;
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.2,
          opacity: Math.random() * 0.7 + 0.3,
          speed: twinkle ? minTwinkleSpeed + Math.random() * (maxTwinkleSpeed - minTwinkleSpeed) : 0,
          dir: Math.random() > 0.5 ? 1 : -1,
        };
      });
    };

    init();
    window.addEventListener("resize", init);

    let rafId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        if (d.speed > 0) {
          d.opacity += d.speed * d.dir * 0.01;
          if (d.opacity >= 1) { d.opacity = 1; d.dir = -1; }
          if (d.opacity <= 0.1) { d.opacity = 0.1; d.dir = 1; }
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${d.opacity})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", init);
      cancelAnimationFrame(rafId);
    };
  }, [starDensity, allStarsTwinkle, twinkleProbability, minTwinkleSpeed, maxTwinkleSpeed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
