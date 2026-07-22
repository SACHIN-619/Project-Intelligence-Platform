// hooks/useWebSocket.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getWebSocketUrl } from '@/lib/api'
import type { WSEvent } from '@/types'

interface UseWebSocketResult {
  isConnected: boolean
  lastEvent: WSEvent | null
  events: WSEvent[]
  reconnect: () => void
}

/**
 * Connects to the backend WebSocket for a given project.
 * Auto-reconnects on disconnect (handles judge demo network hiccups).
 * Returns every event received so components can react to specific types.
 */
export function useWebSocket(projectId: string | null): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null)
  const [events, setEvents] = useState<WSEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    if (!projectId) return

    // Clean up any existing connection first
    if (wsRef.current) {
      wsRef.current.close()
    }

    try {
      const ws = new WebSocket(getWebSocketUrl(projectId))
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (msg) => {
        try {
          const data: WSEvent = JSON.parse(msg.data)
          if (data.type === 'heartbeat' || data.type === 'pong') return // ignore noise
          setLastEvent(data)
          setEvents(prev => [...prev, data])
        } catch {
          // Ignore malformed messages — never crash the UI on bad data
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        // Exponential backoff reconnect, capped at 10s — keeps demo resilient
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000)
        reconnectAttempts.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onclose fires after this — reconnect logic lives there
      }
    } catch {
      setIsConnected(false)
    }
  }, [projectId])

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    if (projectId) connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return { isConnected, lastEvent, events, reconnect }
}
