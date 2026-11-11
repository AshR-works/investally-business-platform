'use client';

import { useCallback, useEffect, useState } from 'react';
import { secondsLeft } from './auth-errors';

/**
 * Compte à rebours d'attente (après un refus pour trop de tentatives) : `start(seconds)` le lance, `remaining` donne les
 * secondes restantes (0 = on peut réessayer). Une seule minuterie, nettoyée au démontage.
 */
export function useCooldown(): { remaining: number; start: (seconds: number) => void } {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (until === 0) return;
    const tick = () => {
      const left = secondsLeft(until, Date.now());
      setRemaining(left);
      if (left === 0) setUntil(0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds: number) => setUntil(Date.now() + seconds * 1000), []);
  return { remaining, start };
}
