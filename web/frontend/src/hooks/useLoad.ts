import { useCallback, useEffect, useRef, useState } from 'react'

export function useLoad<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await loaderRef.current()) }
    catch (e) { setError(e instanceof Error ? e.message : '加载失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return { data, loading, error, reload: load, setData }
}
