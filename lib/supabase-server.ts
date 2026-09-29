import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://npvettycuvzfthshbgyt.supabase.co";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1cETXa5Fs5vEn_Krwm2Wbg_6gHnwXd6";

export function userClient(token:string){ return createClient(url,publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}}); }
export function adminClient(){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key) throw new Error("Server database key is not configured");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
