import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient,userClient} from "../../../../../lib/supabase-server";
export const runtime="nodejs";
const stripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
  if(!token)return NextResponse.json({error:"Please sign in."},{status:401});
  const uc=userClient(token);const{data:{user},error:ue}=await uc.auth.getUser(token);
  if(ue||!user)return NextResponse.json({error:"Please sign in again."},{status:401});
  const db=adminClient();
  const{data:p}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(p?.role!=="admin")return NextResponse.json({error:"Admin required."},{status:403});
  const{id}=await req.json();if(!id)return NextResponse.json({error:"Booking required."},{status:400});
  const{data:b}=await db.from("bookings").select("id,kind,status,guest_fee_paid,stripe_payment_intent_id").eq("id",id).maybeSingle();
  if(!b)return NextResponse.json({error:"Booking not found."},{status:404});
  if(b.status!=="confirmed")return NextResponse.json({error:"This booking is already cancelled or unavailable."},{status:409});
  const needsRefund=b.kind==="payg"||(b.kind==="member"&&b.guest_fee_paid);
  if(needsRefund){
   if(!b.stripe_payment_intent_id)return NextResponse.json({error:"This paid booking has no payment reference. Check Stripe before cancelling it."},{status:409});
   if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");
   await stripe().refunds.create({payment_intent:b.stripe_payment_intent_id,metadata:{booking_id:b.id,reason:"admin_cancelled"}},{idempotencyKey:`admin-booking-refund-${b.id}`});
  }
  const{error}=await uc.rpc("admin_cancel_booking",{p_booking_id:id});
  if(error)throw error;
  return NextResponse.json({message:needsRefund?"Cancelled and refunded.":"Cancelled / released."});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not cancel booking."},{status:500})}
}
