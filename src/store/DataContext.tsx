import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Branch, Product } from '../types';
import { api } from '../lib/api';
import { DataContext } from './dataContext';

export function DataProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    () =>
      Promise.all([api.branches(), api.products()])
        .then(([b, p]) => {
          setBranches(b);
          setProducts(p);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load store data'))
        .finally(() => setLoading(false)),
    [],
  );

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const productById = useCallback(
    (id: string | undefined) => (id ? products.find((p) => p.id === id) : undefined),
    [products],
  );

  return (
    <DataContext.Provider value={{ branches, products, loading, error, reload, productById }}>
      {children}
    </DataContext.Provider>
  );
}
