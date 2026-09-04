import React, { createContext, useContext, useEffect } from 'react'

interface ScaleContextType {
  scale: string
}

const ScaleContext = createContext<ScaleContextType>({ scale: '105%' })

export function ScaleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.style.fontSize = '16.8px'
  }, [])

  return (
    <ScaleContext.Provider value={{ scale: '105%' }}>
      {children}
    </ScaleContext.Provider>
  )
}

export function useScale() {
  return useContext(ScaleContext)
}
