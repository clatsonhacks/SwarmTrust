"use client";
import { useEffect, useRef } from "react";

interface Star {
  x: number; y: number;
  len: number; speed: number;
  angle: number;
  opacity: number;
  color: string;
}

const COLORS = ["#c5ff2b", "#5cc8ff", "#ffffff", "#cc44ff"];

export function ShootingStars({
  minSpeed = 12,
  maxSpeed = 22,
  minDelay = 800,
  maxDelay = 2400,
  starCount = 6,
}: {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starCount?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars: Array<{
      x: number; y: number; vx: number; vy: number;
      len: number; opacity: number; color: string; active: boolean;
    }> = [];

    const spawn = () => {
      const angle = (Math.random() * 20 + 25) * (Math.PI / 180);
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 80 + Math.random() * 120,
        opacity: 1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        active: true,
      });
      setTimeout(spawn, minDelay + Math.random() * (maxDelay - minDelay));
    };

    for (let i = 0; i < starCount; i++) {
      setTimeout(spawn, Math.random() * maxDelay);
    }

    let rafId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        if (!s.active) continue;
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        s.opacity -= 0.008;
        if (s.opacity <= 0 || s.x > canvas.width || s.y > canvas.height) {
          s.active = false;
          continue;
        }
        const grad = ctx.createLinearGradient(
          s.x - s.vx * 0.5, s.y - s.vy * 0.5,
          s.x, s.y
        );
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, s.color + Math.round(s.opacity * 255).toString(16).padStart(2, "0"));
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.moveTo(s.x - s.vx * 0.5, s.y - s.vy * 0.5);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, [minSpeed, maxSpeed, minDelay, maxDelay, starCount]);

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
