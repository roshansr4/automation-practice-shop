import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { setToken, getToken } from './api.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState({ items: [], itemCount: 0, subtotal: 0, total: 0 });
  const [cartBusy, setCartBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const timers = useRef([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Toasts disappear on their own after four seconds. Anything that asserts on
  // them has to deal with an element that leaves the DOM by itself.
  const notify = useCallback(
    (message, tone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, tone }]);
      const timer = setTimeout(() => dismissToast(id), 4000);
      timers.current.push(timer);
      return id;
    },
    [dismissToast]
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const refreshCart = useCallback(async () => {
    const next = await api.cart();
    setCart(next);
    return next;
  }, []);

  useEffect(() => {
    refreshCart().catch(() => {});
  }, [refreshCart]);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      if (!getToken()) {
        setAuthReady(true);
        return;
      }
      try {
        const { user: me } = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const addToCart = useCallback(
    async (product, quantity = 1) => {
      setCartBusy(true);
      try {
        const next = await api.addToCart(product.id, quantity);
        setCart(next);
        notify(`${product.name} added to your basket.`);
        return next;
      } catch (error) {
        notify(error.message, 'error');
        throw error;
      } finally {
        setCartBusy(false);
      }
    },
    [notify]
  );

  const updateLine = useCallback(async (lineId, quantity) => {
    setCartBusy(true);
    try {
      const next = await api.updateLine(lineId, quantity);
      setCart(next);
      return next;
    } finally {
      setCartBusy(false);
    }
  }, []);

  const removeLine = useCallback(
    async (lineId, name) => {
      setCartBusy(true);
      try {
        const next = await api.removeLine(lineId);
        setCart(next);
        notify(`${name || 'Item'} removed from your basket.`, 'info');
        return next;
      } finally {
        setCartBusy(false);
      }
    },
    [notify]
  );

  const emptyCart = useCallback(async () => {
    const next = await api.emptyCart();
    setCart(next);
    return next;
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { token, user: me } = await api.login(credentials);
      setToken(token);
      setUser(me);
      notify(`Signed in as ${me.name}.`);
      return me;
    },
    [notify]
  );

  const register = useCallback(
    async (details) => {
      const { token, user: me } = await api.register(details);
      setToken(token);
      setUser(me);
      notify(`Welcome, ${me.name}.`);
      return me;
    },
    [notify]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
      notify('You have been signed out.', 'info');
    }
  }, [notify]);

  const value = useMemo(
    () => ({
      user,
      authReady,
      cart,
      cartBusy,
      toasts,
      notify,
      dismissToast,
      refreshCart,
      addToCart,
      updateLine,
      removeLine,
      emptyCart,
      setCart,
      login,
      register,
      logout
    }),
    [
      user,
      authReady,
      cart,
      cartBusy,
      toasts,
      notify,
      dismissToast,
      refreshCart,
      addToCart,
      updateLine,
      removeLine,
      emptyCart,
      login,
      register,
      logout
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider');
  return context;
}

export default StoreContext;
