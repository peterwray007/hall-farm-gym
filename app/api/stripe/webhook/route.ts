import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
const getStripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY!);

function membershipStatus(s:string){if(s==="active"||s==="trialing")return "active";if(s==="past_due"||s==="unpaid"||s==="incomplete")return "past_due";if(s==="paused")return "paused";return "cancelled"}

async function syncSubscription(sub:any,resetCredits=false){
 const db=adminClient(); const userId=sub.metadata?.user_id, code=sub.metadata?.plan_code;
 if(!userId||!code)return;
 const {data:plan}=await db.from("membership_plans").select("*").eq("code",code).single(); if(!plan)return;
 const values:any={plan_id:plan.id,owner_id:userId,stripe_customer_id:typeof sub.customer==="string"?sub.customer:sub.customer?.id,
 stripe_subscription_id:sub.id,status:membershipStatus(sub.status),
 period_start:sub.current_period_start?new Date(sub.current_period_start*1000).toISOString():null,
 period_end:sub.current_period_end?new Date(sub.current_period_end*1000).toISOString():null};
 const {data:existing}=await db.from("memberships").select("id").eq("stripe_subscription_id",sub.id).maybeSingle();
 let membershipId=existing?.id;
 if(existing){if(resetCredits){values.bookings_remaining=plan.monthly_bookings;values.guest_passes_remaining=plan.guest_passes}await db.from("memberships").update(values).eq("id",existing.id)}
 else{values.bookings_remaining=plan.monthly_bookings;values.guest_passes_remaining=plan.guest_passes;const {data:m,error}=await db.from("memberships").insert(values).select("id").single();if(error)throw error;membershipId=m.id}
 if(membershipId)await db.from("membership_members").upsert({membership_id:membershipId,user_id:userId});
}

export async function POST(request:NextRequest){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,sig=request.headers.get("stripe-signature");
 if(!process.env.STRIPE_SECRET_KEY||!secret)return NextResponse.json({error:"Stripe webhook is not configured."},{status:500});
 if(!sig)return NextResponse.json({error:"Missing Stripe signature."},{status:400});
 let event:Stripe.Event;
 try{event=getStripe().webhooks.constructEvent(await request.text(),sig,secret)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid signature."},{status:400})}
 const db=adminClient();
 const {data:claimed,error:claimError}=await db.rpc("claim_stripe_event",{p_event_id:event.id,p_event_type:event.type});if(claimError)throw claimError;if(!claimed)return NextResponse.json({received:true,duplicate:true});
 try{
  if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
   const s=event.data.object as any;
   if(s.metadata?.kind==="payg"&&s.payment_status==="paid"){
    const pi=typeof s.payment_intent==="string"?s.payment_intent:s.payment_intent?.id||null;
    const {error}=await db.rpc("confirm_payg_booking",{p_session_id:s.id,p_payment_intent:pi});if(error)throw error;
   }
   if(s.metadata?.kind==="membership"&&s.subscription){const sub=await getStripe().subscriptions.retrieve(typeof s.subscription==="string"?s.subscription:s.subscription.id);await syncSubscription(sub,false)}
  }else if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"){
   await syncSubscription(event.data.object as any,false);
  }else if(event.type==="customer.subscription.deleted"){
   await syncSubscription(event.data.object as any,false);
  }else if(event.type==="invoice.paid"){
   const inv=event.data.object as any; const sid=typeof inv.subscription==="string"?inv.subscription:inv.subscription?.id;
   if(sid){const sub=await getStripe().subscriptions.retrieve(sid);await syncSubscription(sub,false);const {error}=await db.rpc("credit_paid_invoice",{p_subscription_id:sid,p_invoice_id:inv.id});if(error)throw error}
  }else if(event.type==="invoice.payment_failed"){
   const inv=event.data.object as any; const sid=typeof inv.subscription==="string"?inv.subscription:inv.subscription?.id;
   if(sid)await db.from("memberships").update({status:"past_due"}).eq("stripe_subscription_id",sid);
  }
  await db.rpc("finish_stripe_event",{p_event_id:event.id,p_success:true,p_error:null});return NextResponse.json({received:true});
 }catch(e){const message=e instanceof Error?e.message:"Webhook processing failed.";await db.rpc("finish_stripe_event",{p_event_id:event.id,p_success:false,p_error:message});return NextResponse.json({error:message},{status:500})}
}
