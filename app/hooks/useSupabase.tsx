'use client';

import { createContext, useContext } from 'react';

// Mock Supabase client interfaces
interface SupabaseQueryBuilder {
  select: () => { data: unknown[]; error: null };
  insert: () => { data: unknown[]; error: null };
  update: () => { data: unknown[]; error: null };
  delete: () => { data: unknown[]; error: null };
}

interface SupabaseAuthResponse {
  data: { user: null };
  error: null;
}

interface SupabaseClient {
  from: (tableName: string) => SupabaseQueryBuilder;
  auth: {
    getUser: () => Promise<SupabaseAuthResponse>;
    signIn: (userCredentials: { email: string; password: string }) => Promise<SupabaseAuthResponse>;
    signOut: () => Promise<{ error: null }>;
  };
}

const mockSupabase: SupabaseClient = {
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    delete: () => ({ data: [], error: null })
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signIn: async () => ({ data: { user: null }, error: null }),
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