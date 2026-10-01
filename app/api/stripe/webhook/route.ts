import {accessCodeEmail} from "../../../../lib/gym-access";
import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
import {bookingEmail,sendEmail} from "../../../../lib/email";
export const runtime="nodejs";
const getStripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY!);

function membershipStatus(s:string){if(s==="active"||s==="trialing")return "active";if(s==="past_due"||s==="unpaid"||s==="incomplete")return "past_due";if(s==="paused")return "paused";return "cancelled"}

async function syncSubscription(sub:any,resetCredits=false){
 const db=adminClient(); const userId=sub.metadata?.user_id, code=sub.metadata?.plan_code;
 if(!userId||!code)return;
 const {data:plan}=await db.from("membership_plans").select("*").eq("code",code).single(); if(!plan)return;
 const firstItem=sub.items?.data?.[0];const periodStart=firstItem?.current_period_start??sub.current_period_start;const periodEnd=firstItem?.current_period_end??sub.current_period_end;
 const values:any={plan_id:plan.id,owner_id:userId,stripe_customer_id:typeof sub.customer==="string"?sub.customer:sub.customer?.id,
 stripe_subscription_id:sub.id,status:membershipStatus(sub.status),
 period_start:periodStart?new Date(periodStart*1000).toISOString():null,
 period_end:periodEnd?new Date(periodEnd*1000).toISOString():null};
 const {data:existing}=await db.from("memberships").select("id").eq("stripe_subscription_id",sub.id).maybeSingle();
 let membershipId=existing?.id;
 if(existing){if(resetCredits){values.bookings_remaining=plan.monthly_bookings;values.guest_passes_remaining=plan.guest_passes}await db.from("memberships").update(values).eq("id",existing.id)}
 else{values.bookings_remaining=plan.monthly_bookings;values.guest_passes_remaining=plan.guest_passes;const {data:m,error}=await db.from("memberships").insert(values).select("id").single();if(error)throw error;membershipId=m.id}
}

function objectId(v:any){return typeof v==="string"?v:v?.id||null}
function invoiceSubscriptionId(inv:any){
 return objectId(inv.subscription)
  ||objectId(inv.parent?.subscription_details?.subscription)
  ||objectId(inv.lines?.data?.find((x:any)=>x.parent?.subscription_item_details?.subscription)?.parent?.subscription_item_details?.subscription);
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
   if(s.metadata?.kind==="guest_payg"&&s.payment_status==="paid"){
    const pi=objectId(s.payment_intent);
    const {data:bid,error}=await db.rpc("confirm_guest_payg_booking",{p_session_id:s.id,p_payment_intent:pi});
    if(error)throw error;
    const {data:b}=await db.from("bookings").select("starts_at,party_size,guest_name,guest_email,guest_access_token").eq("id",bid).single();
    const {data:health}=await db.from("guest_waivers").select("needs_review").eq("booking_id",bid).maybeSingle();
    if(b?.guest_email){
     const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.hallfarmgym.com";
     const manage=site+"/payg/manage?token="+b.guest_access_token;
     try{await sendEmail(b.guest_email,"Hall Farm Gym PAYG booking confirmed",'<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1>Your PAYG session is booked.</h1><p>'+new Date(b.starts_at).toLocaleString("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/London"})+' · '+b.party_size+' people</p><p><a href="'+manage+'">View or cancel your booking</a>. Keep this link private.</p>'+(health?.needs_review?'<p>Your PAR-Q requires a health review. We will contact you before releasing the entry code.</p>':accessCodeEmail())+'<p>Everyone attending must complete their required health and safety information before training.</p><p>The Hall Farm Gym</p></div>')}catch(e){console.error("Guest PAYG confirmation email",e)}
     try{await sendEmail("wrayfitness04@gmail.com","Hall Farm Gym PAR-Q submission",'<p>A PAYG customer has completed their PAR-Q. Review any flagged answers in <a href="'+site+'/admin">the gym admin area</a>.</p>')}catch(e){console.error("Guest PAYG PAR-Q notification",e)}
    }
   }
   if(s.metadata?.kind==="member_guest"&&s.payment_status==="paid"){const pi=objectId(s.payment_intent);const {data:bid,error}=await db.rpc("confirm_member_guest_payment",{p_hold_id:s.metadata.hold_id,p_session_id:s.id,p_payment_intent:pi});if(error)throw error;const{data:b}=await db.from("bookings").select("starts_at,party_size,user_id").eq("id",bid).single();if(b){const{data:u}=await db.auth.admin.getUserById(b.user_id);if(u.user?.email){try{await sendEmail(u.user.email,"Hall Farm Gym booking confirmed",bookingEmail("member_guest",b.starts_at,b.party_size))}catch(e){console.error("guest booking email",e)}}}}
   if(s.metadata?.kind==="payg"&&s.payment_status==="paid"){
    const pi=typeof s.payment_intent==="string"?s.payment_intent:s.payment_intent?.id||null;
    const {data:bid,error}=await db.rpc("confirm_payg_booking",{p_session_id:s.id,p_payment_intent:pi});if(error)throw error;const{data:b}=await db.from("bookings").select("starts_at,party_size,user_id").eq("id",bid).single();if(b){const{data:u}=await db.auth.admin.getUserById(b.user_id);if(u.user?.email){try{await sendEmail(u.user.email,"Hall Farm Gym booking confirmed",bookingEmail("payg",b.starts_at,b.party_size))}catch(e){console.error("payg booking email",e)}}}
   }
   if(s.metadata?.kind==="membership"&&s.subscription){const sub=await getStripe().subscriptions.retrieve(typeof s.subscription==="string"?s.subscription:s.subscription.id);await syncSubscription(sub,false);const uid=s.metadata?.user_id;if(uid){const{data:u}=await db.auth.admin.getUserById(uid);if(u.user?.email){try{await sendEmail(u.user.email,"Welcome to The Hall Farm Gym",`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1 style="font-family:Georgia,serif">Welcome to The Hall Farm Gym.</h1><p>Your membership is active and your monthly gym credits are ready to use.</p><p><a href="https://www.hallfarmgym.com/book">Book your first session</a> or open <a href="https://www.hallfarmgym.com/account">My Account</a> to see your credits and membership.</p><p>The Hall Farm Gym</p></div>`)}catch(e){console.error("membership welcome email",e)}}}}
  }else if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"){
   await syncSubscription(event.data.object as any,false);
  }else if(event.type==="customer.subscription.deleted"){
   await syncSubscription(event.data.object as any,false);
  }else if(event.type==="invoice.paid"){
   const inv=event.data.object as any; const sid=invoiceSubscriptionId(inv);
   if(sid){const sub=await getStripe().subscriptions.retrieve(sid);await syncSubscription(sub,false);const {error}=await db.rpc("credit_paid_invoice",{p_subscription_id:sid,p_invoice_id:inv.id});if(error)throw error}
  }else if(event.type==="invoice.payment_failed"){
   const inv=event.data.object as any; const sid=invoiceSubscriptionId(inv);
   if(sid)await db.from("memberships").update({status:"past_due"}).eq("stripe_subscription_id",sid);
  }
  await db.rpc("finish_stripe_event",{p_event_id:event.id,p_success:true,p_error:null});return NextResponse.json({received:true});
 }catch(e){const message=e instanceof Error?e.message:"Webhook processing failed.";await db.rpc("finish_stripe_event",{p_event_id:event.id,p_success:false,p_error:message});return NextResponse.json({error:message},{status:500})}
}
