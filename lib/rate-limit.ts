import {createHash} from "crypto";
import {NextRequest} from "next/server";
import {adminClient} from "./supabase-server";

function clientAddress(req:NextRequest){
 const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
 return forwarded||req.headers.get("x-real-ip")||"unknown";
}
export async function allowRequest(req:NextRequest,route:string,limit:number,windowSeconds=60){
 const raw=clientAddress(req)+"|"+(process.env.RATE_LIMIT_SALT||process.env.CRON_SECRET||"hall-farm-gym");
 const keyHash=createHash("sha256").update(raw).digest("hex");
 const {data,error}=await adminClient().rpc("server_rate_limit",{p_key_hash:keyHash,p_route:route,p_window_seconds:windowSeconds,p_limit:limit});
 if(error){console.error("Rate limit check failed",error);return false}
 return data===true;
}
