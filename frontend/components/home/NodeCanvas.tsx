'use client'

import { useEffect, useRef } from 'react'

export type NodeMode = 'problem' | 'connecting' | 'connected'

interface NodeCanvasProps {
  mode: NodeMode
  nodeCount?: number
  interactive?: boolean
  className?: string
  opacity?: number
}

interface Node {
  x: number; y: number
  tx: number; ty: number
  vx: number; vy: number
  r: number
  phase: number
}

const PALETTE = {
  problem:    { node: [239, 68, 68],   link: [239, 68, 68]   },
  connecting: { node: [20, 184, 166],  link: [59, 130, 246]  },
  connected:  { node: [20, 184, 166],  link: [20, 184, 166]  },
}

export function NodeCanvas({
  mode,
  nodeCount = 48,
  interactive = true,
  className = '',
  opacity = 1,
}: NodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef  = useRef<Node[]>([])
  const mouseRef  = useRef({ x: -9999, y: -9999 })
  const rafRef    = useRef<number>(0)
  const visRef    = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0, H = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect()
      W = rect.width; H = rect.height
      canvas!.width  = W * dpr; canvas!.height = H * dpr
      canvas!.style.width  = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.scale(dpr, dpr)
      buildNodes()
    }

    function buildNodes() {
      const isClustered = mode !== 'problem'
      const cx = W / 2, cy = H / 2
      const clusterR = Math.min(W, H) * 0.3
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        let tx: number, ty: number
        if (isClustered) {
          const angle = (i / nodeCount) * Math.PI * 2
          const r = clusterR * (0.3 + Math.random() * 0.7)
          tx = cx + Math.cos(angle) * r
          ty = cy + Math.sin(angle) * r
        } else {
          tx = W * 0.05 + Math.random() * W * 0.9
          ty = H * 0.05 + Math.random() * H * 0.9
        }
        return {
          x: W * 0.05 + Math.random() * W * 0.9,
          y: H * 0.05 + Math.random() * H * 0.9,
          tx, ty,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: mode === 'connected' && i % 7 === 0 ? 4.5 : 2.5 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2,
        }
      })
    }

    function draw(t: number) {
      if (!visRef.current || reduced) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      ctx!.clearRect(0, 0, W, H)
      const pal = PALETTE[mode]
      const nodes = nodesRef.current
      const mx = mouseRef.current.x, my = mouseRef.current.y

      // Update positions
      nodes.forEach(n => {
        const dx = n.tx - n.x, dy = n.ty - n.y
        if (mode === 'problem') {
          n.x += n.vx
          n.y += n.vy
          n.vx *= 0.99; n.vy *= 0.99
          n.vx += (Math.random() - 0.5) * 0.05
          n.vy += (Math.random() - 0.5) * 0.05
          // Wrap
          if (n.x < 0) n.x = W; if (n.x > W) n.x = 0
          if (n.y < 0) n.y = H; if (n.y > H) n.y = 0
        } else {
          n.x += dx * 0.012
          n.y += dy * 0.012
          // Gentle float
          n.x += Math.sin(t * 0.0007 + n.phase) * 0.3
          n.y += Math.cos(t * 0.0009 + n.phase) * 0.2
        }

        // Mouse repulsion (interactive only)
        if (interactive && mx > -100) {
          const ddx = n.x - mx, ddy = n.y - my
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dist < 100 && dist > 0.1) {
            const force = (100 - dist) / 100 * 1.5
            n.x += (ddx / dist) * force
            n.y += (ddy / dist) * force
          }
        }
      })

      // Draw connections
      const maxDist = mode === 'problem' ? 80 : 120
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < maxDist) {
            const a = (1 - d / maxDist) * (mode === 'connected' ? 0.5 : 0.25) * opacity
            ctx!.beginPath()
            ctx!.strokeStyle = `rgba(${pal.link.join(',')},${a})`
            ctx!.lineWidth = mode === 'connected' ? 0.8 : 0.5
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.stroke()
          }
        }
      }

      // Draw nodes
      nodes.forEach((n, i) => {
        const pulse = Math.sin(t * 0.002 + n.phase) * 0.3 + 0.7
        const alpha = pulse * opacity

        if (mode === 'connected' && i % 7 === 0) {
          // Hub glow
          const g = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4)
          g.addColorStop(0, `rgba(${pal.node.join(',')},${0.4 * opacity})`)
          g.addColorStop(1, `rgba(${pal.node.join(',')},0)`)
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2)
          ctx!.fillStyle = g
          ctx!.fill()
        }

        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${pal.node.join(',')},${alpha})`
        ctx!.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    // Visibility observer — pause when off-screen
    const obs = new IntersectionObserver(
      ([e]) => { visRef.current = e.isIntersecting },
      { threshold: 0.05 }
    )
    obs.observe(canvas)

    // Mouse
    function onMouse(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onLeave() { mouseRef.current = { x: -9999, y: -9999 } }
    if (interactive) {
      canvas.addEventListener('mousemove', onMouse)
      canvas.addEventListener('mouseleave', onLeave)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    resize()
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      obs.disconnect()
      ro.disconnect()
      if (interactive) {
        canvas.removeEventListener('mousemove', onMouse)
        canvas.removeEventListener('mouseleave', onLeave)
      }
    }
  }, [mode, nodeCount, interactive, opacity])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${className}`}
      style={{ opacity }}
    />
  )
}
