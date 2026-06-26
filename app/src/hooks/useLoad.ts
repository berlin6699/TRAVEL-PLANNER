import { useCallback, useEffect, useRef, useState } from 'react'

export function useLoad<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader)
  const loadedRef = useRef(false)
  loaderRef.current = loader
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const shouldRestoreScroll=loadedRef.current&&typeof window!=='undefined'
    const scrollY=shouldRestoreScroll?window.scrollY:0
    if(!loadedRef.current)setLoading(true)
    setError('')
    try { setData(await loaderRef.current());loadedRef.current=true
      if(shouldRestoreScroll){
        const restore=()=>window.scrollTo(0,scrollY)
        requestAnimationFrame(()=>requestAnimationFrame(restore))
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : '加载失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return { data, loading, error, reload: load, setData }
}
