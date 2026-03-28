# SwarmTrust — Next.js App

> Autonomous robots. Verified trust. Machine payments. No humans required.
> PL Genesis: Frontiers of Collaboration Hackathon 2026

---

## Quick Start

```bash
cd swarmtrust-next
npm install
npm run dev
# open http://localhost:3000
```

---

## File Map

```
app/
  layout.tsx          Google fonts → CSS vars, metadata
  page.tsx            Loader → Cursor → Nav → Hero → About → Panel → Footer
  globals.css         ALL design tokens + component styles

components/scene/
  SimCanvas.tsx       R3F <Canvas> (dynamic import, ssr:false)
  WarehouseScene.tsx  Full scene: floor, zones, agents, beams, meeting ring
  AmongAgent.tsx      Among Us crewmate from pure R3F geometry + walk animation
  TrustBeam.tsx       Bezier arc + travelling dot for x402 payment visuals

components/ui/
  Loader.tsx          Game boot screen counting 0→100%
  Cursor.tsx          Custom ring+dot cursor via GSAP
  Nav.tsx             Fixed top navigation
  HeroSection.tsx     Full-viewport hero with GSAP char-by-char headlines
  Ticker.tsx          CSS marquee strip
  AboutSection.tsx    Scroll-triggered GSAP animations
  AgentPanel.tsx      Live dashboard reading Zustand store
  Footer.tsx          Minimal mono footer

lib/
  types.ts            Shared TypeScript types
  agentStore.ts       Zustand store: all sim state + agent AI loop
```

---

## Architecture in Plain English

### Design tokens (globals.css)
Every colour, font, spacing is a CSS variable.
Change `--accent: #c5ff2b` once → entire site updates.
This is how real design systems work.

### State (agentStore.ts — Zustand)
One store holds ALL simulation state.
`tick(dt)` is called every frame from `useFrame` in WarehouseScene.
Agent AI is a simple state machine:

```
IDLE ──waitTimer→ MOVING ──arrived→ EXECUTING ──taskTimer→ IDLE
                                         ↓ (40% chance)
                                      fire x402 beam + log entry
```

No `useState` in the 3D scene. Everything reads from the store.

### 3D Scene (React Three Fiber)
`WarehouseScene` calls `store.tick(dt)` inside `useFrame`.
`AmongAgent` is built from Three.js primitives — no model file needed:
  - Head  = SphereGeometry (squished via scale)
  - Torso = CylinderGeometry
  - Visor = BoxGeometry + emissive inner glow
  - Legs  = two BoxGeometry, swing in walk cycle
  - Label = `<Html>` from drei, projected into 3D space

`TrustBeam` draws a `QuadraticBezierCurve3` with a sphere dot
travelling along it — the visual for x402 payments.

### UI (GSAP + React)
GSAP is dynamically imported inside `useEffect` (never at module level).
Text is split char-by-char by a custom `splitChars()` — same as
GSAP SplitText but free and 15 lines of code.

---

## Swapping in Your Blender Agent

When you have your own robot .glb:

```tsx
// In AmongAgent.tsx, replace the geometry group with:
import { useGLTF, useAnimations } from '@react-three/drei'

const { scene, animations } = useGLTF('/models/swarm-agent.glb')
const { actions } = useAnimations(animations, scene)

useEffect(() => {
  const map = { IDLE:'Idle', MOVING:'Walk', EXECUTING:'Work', MEETING:'Talk' }
  actions[map[state]]?.reset().play()
}, [state])

return <primitive object={scene} position={position} />
```

Blender export checklist:
- Apply all transforms (Ctrl+A → All Transforms)
- Origin at foot level
- Animations named: Idle, Walk, Work, Talk
- Materials: Principled BSDF only
- Enable Draco compression
- Export to: `public/models/swarm-agent.glb`

---

## Colour Palette

```
Background:  #070810  deep space navy
Accent:      #c5ff2b  acid green
Cyan:        #5cc8ff  trust beam / info
Purple:      #cc44ff  Scout-2 agent
Orange:      #ff9b2b  Carrier agent
Red:         #ff4466  Lifter-2 agent
```

To change the whole theme, edit these two lines in globals.css:
```css
--bg:     #070810;
--accent: #c5ff2b;
```

---

## What Each File Teaches

| File | You learn |
|------|-----------|
| `globals.css` | Design tokens, CSS custom properties |
| `agentStore.ts` | Zustand, state machines, simulation loops |
| `WarehouseScene.tsx` | R3F scene composition, useFrame |
| `AmongAgent.tsx` | Building 3D objects from primitives, walk cycles |
| `TrustBeam.tsx` | THREE.QuadraticBezierCurve3, animated geometry |
| `HeroSection.tsx` | GSAP timeline, manual SplitText |
| `AboutSection.tsx` | IntersectionObserver, scroll-triggered animation |
| `SimCanvas.tsx` | Dynamic import, avoiding SSR with WebGL |
| `Loader.tsx` | GSAP counter animation, UX loading patterns |
