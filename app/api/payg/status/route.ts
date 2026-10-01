import {NextRequest,NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const id=new URL(req.url).searchParams.get("session_id")||"";
 if(!/^cs_(live|test)_/.test(id)||id.length>220)return NextResponse.json({error:"Invalid checkout reference."},{status:400});
 const db=adminClient();
 const {data:b}=await db.from("bookings").select("starts_at,party_size,guest_name,status").eq("stripe_checkout_session_id",id).eq("kind","payg").is("user_id",null).maybeSingle();
 if(b)return NextResponse.json({status:b.status,startsAt:b.starts_at,partySize:b.party_size,firstName:b.guest_name?.split(" ")[0]||""});
 return NextResponse.json({status:"processing"});
}
