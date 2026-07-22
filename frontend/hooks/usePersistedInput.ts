// hooks/usePersistedInput.ts
// ────────────────────────────────────────────────────────────────────────────
// Auto-saves text input to localStorage as the user types (debounced), and
// restores it on return — refresh, close tab, navigate away and back all
// preserve the draft. Cleared only on submit, explicit Clear, or when the
// user manually empties the field themselves.
//
// NOT meant for every input — see usage guidance at the bottom of this file.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UsePersistedInputOptions {
  debounceMs?: number   // save delay after typing stops — default 400ms
  sensitive?:  boolean  // true = never touch localStorage (passwords, tokens, etc.)
}

interface UsePersistedInputResult {
  value:       string
  setValue:    (next: string) => void
  clear:       () => void
  isHydrated:  boolean   // false until localStorage has been checked (avoids SSR flash)
}

export function usePersistedInput(
  key: string,
  initialValue: string = '',
  options: UsePersistedInputOptions = {}
): UsePersistedInputResult {
  const { debounceMs = 400, sensitive = false } = options
  const storageKey   = `pii:draft:${key}`   // namespaced — avoids collisions across forms
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>()
  const [value, setValueState]   = useState(initialValue)
  const [isHydrated, setHydrated] = useState(false)

  // ── Restore on mount — client-only, so it never runs during SSR ───────────
  useEffect(() => {
    if (sensitive) { setHydrated(true); return }
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved !== null) setValueState(saved)
    } catch {
      // Private browsing / storage disabled — degrade to non-persisted, no crash
    } finally {
      setHydrated(true)
    }
  }, [storageKey, sensitive])

  // ── Debounced save on every keystroke ──────────────────────────────────────
  const setValue = useCallback((next: string) => {
    setValueState(next)
    if (sensitive) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        // User manually deleted everything → remove the key entirely
        // rather than persisting an empty string forever
        if (next.trim() === '') {
          window.localStorage.removeItem(storageKey)
        } else {
          window.localStorage.setItem(storageKey, next)
        }
      } catch (err) {
        // Quota exceeded or storage blocked — warn, never throw into the UI
        console.warn(`[usePersistedInput] Could not save draft "${key}":`, err)
      }
    }, debounceMs)
  }, [storageKey, debounceMs, sensitive, key])

  // ── Explicit clear — call this on submit or a Clear button ────────────────
  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setValueState('')
    try { window.localStorage.removeItem(storageKey) } catch { /* noop */ }
  }, [storageKey])

  // Cancel any pending debounced save if the component unmounts mid-type
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return { value, setValue, clear, isHydrated }
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE GUIDANCE — read before wiring this into a new field
// ─────────────────────────────────────────────────────────────────────────────
//
// ✅ Good fits: long-form drafts a user would be upset to lose
//    - AI Assistant question box (see integration below)
//    - Report notes / comments
//    - Multi-field creation forms (New Project name + description)
//
// ❌ Bad fits: fields where a stale restored value causes confusion
//    - Global search (⌘K) — nobody wants last week's search reappearing
//    - One-off filters (date ranges, dropdowns)
//    - Anything sensitive: passwords, API keys, tokens → pass { sensitive: true }
//      or simply don't use this hook for them at all