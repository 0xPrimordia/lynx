'use client';

import { createContext, useContext } from 'react';

// Mock Supabase client
interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<any>;
    signIn: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
  };
}

const mockSupabase: SupabaseClient = {
  from: (table: string) => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    delete: () => ({ data: [], error: null })
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signIn: async (credentials: any) => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null })
  }
};

interface SupabaseContextType {
  supabase: SupabaseClient;
}

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: mockSupabase
});

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    return { supabase: mockSupabase };
  }
  return context;
}; 