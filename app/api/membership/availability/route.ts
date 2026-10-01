import {NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const {data,error}=await adminClient().rpc("membership_places_remaining");
  if(error)throw error;
  return NextResponse.json({totalLimit:40,initialRelease:35,available:Number(data)||0},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("Membership capacity unavailable",e);return NextResponse.json({error:"Membership availability is temporarily unavailable"},{status:503})}
}
