import {gymAccessCode} from "../../../../lib/gym-access";
import {NextRequest,NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const id=new URL(req.url).searchParams.get("session_id")||"";
 if(!/^cs_(live|test)_/.test(id)||id.length>220)return NextResponse.json({error:"Invalid checkout reference."},{status:400});
 const db=adminClient();
 const {data:b}=await db.from("bookings").select("id,starts_at,party_size,guest_name,status").eq("stripe_checkout_session_id",id).eq("kind","payg").is("user_id",null).maybeSingle();
 if(b){const{data:waiver}=await db.from("guest_waivers").select("needs_review").eq("booking_id",b.id).maybeSingle();return NextResponse.json({status:b.status,startsAt:b.starts_at,partySize:b.party_size,firstName:b.guest_name?.split(" ")[0]||"",needsReview:waiver?.needs_review||false,accessCode:waiver?.needs_review?null:gymAccessCode()},{headers:{"Cache-Control":"private, no-store"}})}
 return NextResponse.json({status:"processing"});
}
