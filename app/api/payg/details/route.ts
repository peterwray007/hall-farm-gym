import {NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(){
 const {data,error}=await adminClient().from("gym_settings").select("payg_price_pence,max_people,session_minutes").single();
 if(error)return NextResponse.json({error:"Unavailable"},{status:503});
 return NextResponse.json({price:data.payg_price_pence,max:data.max_people,sessionMinutes:data.session_minutes});
}
