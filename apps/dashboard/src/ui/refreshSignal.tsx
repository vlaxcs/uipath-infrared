import { createContext, useContext, useEffect, useRef } from "react";

const RefreshContext = createContext(0);

export const RefreshProvider = RefreshContext.Provider;

export function useOnRefresh(reload: () => void): void {
  const signal = useContext(RefreshContext);
  const seen = useRef(signal);
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    if (signal === seen.current) return;
    seen.current = signal;
    latest.current();
  }, [signal]);
}
