import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
import {allowRequest} from "../../../../lib/rate-limit";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 if(!await allowRequest(req,"guest-payg-checkout",10,600))return NextResponse.json({error:"Too many attempts. Please wait a few minutes and try again."},{status:429});
 const db=adminClient();let holdId:string|null=null;
 try{
  const b=await req.json();
  const required=["name","email","phone","emergencyName","emergencyPhone","startsAt"];
  if(required.some(k=>!b[k])||!b.acceptTerms||!b.healthConsent||b.inductionAccepted!==true||b.groupResponsibilityAccepted!==true||b.adultSupervisionConfirmed!==true)return NextResponse.json({error:"Complete all required details."},{status:400});
  const keys=["heart_condition","chest_pain","dizziness","medical_reason"];
  if(keys.some(k=>typeof b.answers?.[k]!=="boolean"))return NextResponse.json({error:"Answer all health questions."},{status:400});
  const party=Number(b.partySize);
  if(!Number.isInteger(party)||party<1||party>6)return NextResponse.json({error:"Invalid group size."},{status:400});
  const {data:id,error}=await db.rpc("create_guest_payg_hold",{p_starts_at:b.startsAt,p_party_size:party,p_full_name:b.name,p_email:b.email,p_phone:b.phone,p_emergency_name:b.emergencyName,p_emergency_phone:b.emergencyPhone,p_health_answers:b.answers});
  if(error)return NextResponse.json({error:error.message},{status:409});
  holdId=id;
  const {data:induction}=await db.from("legal_documents").select("id").eq("document_type","gym_induction").eq("active",true).limit(1);
  if(!induction?.length)throw new Error("Gym induction is unavailable");
  const {error:ie}=await db.from("guest_payg_holds").update({induction_accepted_at:new Date().toISOString()}).eq("id",id);
  if(ie)throw ie;
  const {data:settings}=await db.from("gym_settings").select("payg_price_pence").single();
  if(!settings||!process.env.STRIPE_SECRET_KEY)throw new Error("Payment unavailable");
  const totalPence=settings.payg_price_pence+500*(party-1);
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.hallfarmgym.com";
  const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:b.email,client_reference_id:id,
   line_items:[{price_data:{currency:"gbp",unit_amount:totalPence,product_data:{name:`Hall Farm Gym PAYG session for ${party} ${party===1?"person":"people"}`}},quantity:1}],
   expires_at:Math.floor(Date.now()/1000)+31*60,
   success_url:site+"/payg/confirmed?session_id={CHECKOUT_SESSION_ID}",cancel_url:site+"/book?payment=cancelled",
   metadata:{kind:"guest_payg",hold_id:id}});
  const {error:attach}=await db.from("guest_payg_holds").update({stripe_checkout_session_id:session.id}).eq("id",id);
  if(attach)throw attach;
  return NextResponse.json({url:session.url});
 }catch(e){if(holdId)await db.from("guest_payg_holds").delete().eq("id",holdId);console.error(e);return NextResponse.json({error:"Unable to start checkout."},{status:500});}
}
