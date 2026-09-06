import { useState } from 'react';

export function useBulkSelection() {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const resetSelection = () => { setSelected([]); setSelecting(false) }
  const toggleSelecting = () => { setSelecting(value => !value); setSelected([]) }
  const toggleSelected = (key: string) => setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  return { selecting, selected, setSelected, resetSelection, toggleSelecting, toggleSelected }
}
