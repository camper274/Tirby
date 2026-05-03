import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  "";
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  "";

export const supabaseConfigError =
  !supabaseUrl || !supabaseKey
    ? "Supabase environment variables are missing. Expected VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    : null;

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseKey);
