import {NextRequest,NextResponse} from "next/server";
import {adminClient,userClient} from "../../../../lib/supabase-server";
import {sendEmail} from "../../../../lib/email";
export const runtime="nodejs";

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const db=adminClient();
  let kind:"member"|"guest";
  let submissionId:string;
  if(body.kind==="member"){
   const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
   if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
   const {data:{user},error}=await userClient(token).auth.getUser(token);
   if(error||!user)return NextResponse.json({error:"Invalid session"},{status:401});
   const {data:declaration,error:readError}=await db.from("health_declarations").select("id,consent_given").eq("user_id",user.id).order("submitted_at",{ascending:false}).limit(1).maybeSingle();
   if(readError||!declaration?.consent_given)return NextResponse.json({error:"Completed PAR-Q not found"},{status:404});
   kind="member";submissionId=declaration.id;
  }else if(body.kind==="guest"){
   const token=String(body.guestToken||"");
   if(!/^[0-9a-f-]{36}$/i.test(token))return NextResponse.json({error:"Invalid guest link"},{status:400});
   const {data:booking}=await db.from("bookings").select("id").eq("guest_access_token",token).maybeSingle();
   if(!booking)return NextResponse.json({error:"Guest booking not found"},{status:404});
   const {data:waiver}=await db.from("guest_waivers").select("id,health_consent_given,accepted_terms").eq("booking_id",booking.id).order("accepted_at",{ascending:false}).limit(1).maybeSingle();
   if(!waiver?.health_consent_given||!waiver.accepted_terms)return NextResponse.json({error:"Completed guest PAR-Q not found"},{status:404});
   kind="guest";submissionId=waiver.id;
  }else return NextResponse.json({error:"Invalid submission"},{status:400});
  const {error:claim}=await db.from("parq_notification_log").insert({kind,submission_id:submissionId});
  if(claim?.code==="23505")return NextResponse.json({ok:true,alreadyNotified:true});
  if(claim)throw claim;
  try{
   const result=await sendEmail("wrayfitness04@gmail.com","Hall Farm Gym PAR-Q submission",`<div style="font-family:Arial,sans-serif"><h2>New PAR-Q submitted</h2><p>A ${kind==="member"?"member":"guest"} has submitted their health questionnaire.</p><p>Sign in to <a href="https://www.hallfarmgym.com/admin">The Hall Farm Gym admin area</a> to review any questionnaires flagged for a health review.</p><p>For privacy, no health answers are included in this email.</p></div>`);
   if(!result.ok)throw new Error("Email service unavailable");
  }catch(e){
   await db.from("parq_notification_log").delete().eq("kind",kind).eq("submission_id",submissionId);
   throw e;
  }
  return NextResponse.json({ok:true});
 }catch(e){console.error("PAR-Q notification failed",e);return NextResponse.json({error:"Could not send notification"},{status:500})}
}
