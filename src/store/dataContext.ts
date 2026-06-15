import { createContext, useContext } from 'react';
import type { Branch, Product } from '../types';

export interface DataState {
  branches: Branch[];
  products: Product[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  productById: (id: string | undefined) => Product | undefined;
}

export const DataContext = createContext<DataState | null>(null);

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
