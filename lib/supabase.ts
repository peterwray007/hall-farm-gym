import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://npvettycuvzfthshbgyt.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1cETXa5Fs5vEn_Krwm2Wbg_6gHnwXd6";

export const supabase = () => createBrowserClient(url, publishableKey);
