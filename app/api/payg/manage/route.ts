import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
import {cancellationEmail,sendEmail} from "../../../../lib/email";
export const runtime="nodejs";
const valid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function GET(req:NextRequest){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!valid(token))return NextResponse.json({error:"Invalid private link."},{status:400});
 const {data:b}=await adminClient().from("bookings").select("starts_at,party_size,status").eq("guest_access_token",token).eq("kind","payg").is("user_id",null).maybeSingle();
 if(!b)return NextResponse.json({error:"Booking not found."},{status:404});
 return NextResponse.json({booking:b},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){
 try{
  const {token}=await req.json();
  if(!valid(token||""))return NextResponse.json({error:"Invalid private link."},{status:400});
  const db=adminClient(),{data:b}=await db.from("bookings").select("id,starts_at,created_at,status,stripe_payment_intent_id,guest_email").eq("guest_access_token",token).eq("kind","payg").is("user_id",null).maybeSingle();
  if(!b)return NextResponse.json({error:"Booking not found."},{status:404});
  if(b.status!=="confirmed")return NextResponse.json({error:"Booking is not active."},{status:409});
  const {data:s}=await db.from("gym_settings").select("cancellation_hours,payg_cancellation_grace_minutes").single();
  const now=Date.now();
  const outsideWindow=new Date(b.starts_at).getTime()>=now+(s?.cancellation_hours??12)*3600000;
  const grace=new Date(b.starts_at).getTime()>now&&now<=new Date(b.created_at).getTime()+(s?.payg_cancellation_grace_minutes??20)*60000;
  const refundable=outsideWindow||grace;
  if(refundable){
   if(!b.stripe_payment_intent_id||!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Please contact WrayFitness for your refund."},{status:409});
   await new Stripe(process.env.STRIPE_SECRET_KEY).refunds.create({payment_intent:b.stripe_payment_intent_id},{idempotencyKey:"guest-payg-refund-"+b.id});
  }
  const {error}=await db.from("bookings").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("id",b.id).eq("status","confirmed");
  if(error)throw error;
  const message=refundable?(grace?"Your booking is cancelled and the PAYG payment has been refunded under the 20-minute booking grace period.":"Your booking is cancelled and the PAYG payment has been refunded."):"Your booking is cancelled. It was within 12 hours of the session and outside the 20-minute booking grace period, so no refund is due.";
  if(b.guest_email)try{await sendEmail(b.guest_email,"Hall Farm Gym booking cancelled",cancellationEmail(b.starts_at,message))}catch(e){console.error("Guest cancellation email",e)}
  return NextResponse.json({message});
 }catch(e){console.error("Guest cancellation error",e);return NextResponse.json({error:"We couldn't cancel your booking. Please contact WrayFitness."},{status:500})}
}
