import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const PULL_THRESHOLD = 68;
const PULL_MAX = 110;

const ResidentRefreshContext = createContext(null);

export function useResidentRefresh(onRefresh) {
  const register = useContext(ResidentRefreshContext);
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  useEffect(() => {
    if (!register) return undefined;
    const wrapped = () => {
      const fn = handlerRef.current;
      return fn ? fn() : undefined;
    };
    return register(wrapped);
  }, [register]);
}

export function ResidentRefreshRoot({ scrollElRef, onGlobalRefresh, children }) {
  const handlersRef = useRef(new Set());
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchRef = useRef({ active: false, startY: 0 });
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  const register = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const runRefresh = useCallback(async () => {
    const handlers = [...handlersRef.current];
    await Promise.all(
      handlers.map((handler) =>
        Promise.resolve()
          .then(() => handler())
          .catch(() => {})
      )
    );
    if (onGlobalRefresh) {
      await Promise.resolve(onGlobalRefresh()).catch(() => {});
    }
  }, [onGlobalRefresh]);

  useEffect(() => {
    const el = scrollElRef?.current;
    if (!el) return undefined;

    function canPull() {
      return !refreshingRef.current && el.scrollTop <= 0;
    }

    function setPullDistance(value) {
      pullRef.current = value;
      setPull(value);
    }

    function onTouchStart(event) {
      if (event.touches.length !== 1 || !canPull()) {
        touchRef.current.active = false;
        return;
      }
      touchRef.current.active = true;
      touchRef.current.startY = event.touches[0].clientY;
    }

    function onTouchMove(event) {
      if (!touchRef.current.active || refreshingRef.current) return;
      if (el.scrollTop > 0) {
        setPullDistance(0);
        return;
      }
      const delta = event.touches[0].clientY - touchRef.current.startY;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      event.preventDefault();
      setPullDistance(Math.min(delta * 0.45, PULL_MAX));
    }

    function onTouchEnd() {
      if (!touchRef.current.active) return;
      touchRef.current.active = false;
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD;
      if (!shouldRefresh) {
        setPullDistance(0);
        return;
      }
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      runRefresh().finally(() => {
        setRefreshing(false);
        setPullDistance(0);
      });
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scrollElRef, runRefresh]);

  const visible = pull > 8 || refreshing;
  const progress = Math.min(1, pull / PULL_THRESHOLD);

  return (
    <ResidentRefreshContext.Provider value={register}>
      <div
        className={`resident-pull-wrap${refreshing ? ' resident-pull-wrap--refreshing' : ''}`}
        style={{ transform: pull ? `translate3d(0, ${pull}px, 0)` : undefined }}
      >
        <div
          className={`resident-pull${visible ? ' resident-pull--visible' : ''}`}
          aria-live="polite"
          aria-busy={refreshing}
        >
          <span
            className={`resident-pull__icon${refreshing ? ' resident-pull__icon--spin' : ''}`}
            style={{ opacity: refreshing ? 1 : 0.35 + progress * 0.65 }}
          />
          <span className="resident-pull__label">
            {refreshing ? 'Actualizando…' : pull >= PULL_THRESHOLD ? 'Suelta para actualizar' : 'Desliza para actualizar'}
          </span>
        </div>
        {children}
      </div>
    </ResidentRefreshContext.Provider>
  );
}
