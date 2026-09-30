import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient,userClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
const stripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
  if(!token)return NextResponse.json({error:"Please sign in first."},{status:401});
  const uc=userClient(token);const{data:{user},error:ue}=await uc.auth.getUser(token);
  if(ue||!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const{id}=await req.json();if(!id)return NextResponse.json({error:"Booking required."},{status:400});
  const db=adminClient();
  const{data:b}=await db.from("bookings").select("id,user_id,kind,status,starts_at,bringing_guest,guest_fee_paid,stripe_payment_intent_id").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(!b)return NextResponse.json({error:"Booking not found."},{status:404});
  if(b.status!=="confirmed")return NextResponse.json({error:"This booking is already cancelled or unavailable."},{status:409});
  const{data:s}=await db.from("gym_settings").select("cancellation_hours").single();
  const cutoff=(s?.cancellation_hours??12)*3600000;
  const refundable=new Date(b.starts_at).getTime()>=Date.now()+cutoff;
  if(b.kind==="member"){
   if(refundable&&b.guest_fee_paid){
    if(!b.stripe_payment_intent_id)return NextResponse.json({error:"We could not find the guest payment for this booking. Please contact WrayFitness before cancelling."},{status:409});
    if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");
    await stripe().refunds.create({payment_intent:b.stripe_payment_intent_id,metadata:{booking_id:b.id,reason:"member_guest_cancelled_outside_window"}},{idempotencyKey:`guest-booking-refund-${b.id}`});
   }
   const{error}=await uc.rpc("cancel_my_booking",{p_booking_id:id});
   if(error)return NextResponse.json({error:error.message},{status:400});
   return NextResponse.json({message:refundable?(b.guest_fee_paid?"Cancelled — your member session has been returned and the £5 guest fee has been refunded.":"Cancelled — your member session has been returned to your allowance."):"Cancelled — this was inside the cancellation window, so the member session and any guest fee are not returned."});
  }
  if(b.kind!=="payg")return NextResponse.json({error:"This booking cannot be cancelled here."},{status:400});
  if(refundable&&!b.stripe_payment_intent_id)return NextResponse.json({error:"We could not find the PAYG payment for this booking. Please contact WrayFitness before cancelling."},{status:409});
  if(refundable&&b.stripe_payment_intent_id){
   if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");
   await stripe().refunds.create({payment_intent:b.stripe_payment_intent_id,metadata:{booking_id:b.id,reason:"customer_cancelled_outside_window"}},{idempotencyKey:`booking-refund-${b.id}`});
  }
  const{error:ce}=await db.from("bookings").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("id",b.id).eq("status","confirmed");
  if(ce)throw ce;
  return NextResponse.json({message:refundable?"Cancelled — your PAYG payment has been refunded.":"Cancelled — this was inside the cancellation window, so no refund is due."});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not cancel booking."},{status:500})}
}
