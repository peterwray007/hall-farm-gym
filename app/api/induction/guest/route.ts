import {NextRequest,NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const {token,email}=await req.json();
  if(typeof token!=="string"||!/^[0-9a-f-]{36}$/i.test(token)||typeof email!=="string"||!email.includes("@"))return NextResponse.json({error:"Invalid guest registration"},{status:400});
  const db=adminClient();
  const {data:b}=await db.from("bookings").select("id").eq("guest_access_token",token).eq("status","confirmed").maybeSingle();
  if(!b)return NextResponse.json({error:"Booking not found"},{status:404});
  const {data:w}=await db.from("guest_waivers").select("id,accepted_terms,health_consent_given,legal_versions").eq("booking_id",b.id).eq("guest_email",email.trim().toLowerCase()).maybeSingle();
  if(!w?.accepted_terms||!w.health_consent_given)return NextResponse.json({error:"Guest registration incomplete"},{status:409});
  const {data:d}=await db.from("legal_documents").select("title,version").eq("document_type","gym_induction").eq("active",true).limit(1).maybeSingle();
  if(!d||w.legal_versions?.[d.title]!==d.version)return NextResponse.json({error:"Current induction must be accepted"},{status:409});
  const {error}=await db.from("guest_waivers").update({induction_accepted_at:new Date().toISOString()}).eq("id",w.id);
  if(error)throw error;
  return NextResponse.json({ok:true});
 }catch(e){console.error("Guest induction recording",e);return NextResponse.json({error:"Unable to record induction"},{status:500})}
}
