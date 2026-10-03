import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient,userClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
const stripe=()=>new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://www.hallfarmgym.com";
const GUEST_PRICE=process.env.STRIPE_PRICE_MEMBER_GUEST||"price_1ULU1N6ge2ZP5Q4o5eHFqj49";

export async function POST(req:NextRequest){
 try{
  if(!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
  if(!token) return NextResponse.json({error:"Please sign in first."},{status:401});
  const uc=userClient(token); const {data:{user},error:ue}=await uc.auth.getUser(token);
  if(ue||!user) return NextResponse.json({error:"Please sign in again."},{status:401});
  const body=await req.json(); const db=adminClient();
  if(body.type==="membership"){
    if(body.acceptMembershipTerms!==true||body.immediateServiceRequested!==true||body.termsVersion!=="2026-10-03")return NextResponse.json({error:"Please accept the current membership terms and request immediate service before continuing."},{status:400});
    const {data:cleared,error:ce}=await db.rpc("member_is_cleared",{p_uid:user.id});if(ce||cleared!==true)return NextResponse.json({error:"Please complete your health form, online safety acknowledgement and gym terms before joining."},{status:409});
    const {data:existing}=await db.from("memberships").select("id,status").eq("owner_id",user.id).in("status",["active","past_due","paused"]).limit(1).maybeSingle();if(existing)return NextResponse.json({error:"You already have a membership. Manage it from My Account."},{status:409});
    const code=String(body.plan||"").toLowerCase();
    const {data:plan,error}=await db.from("membership_plans").select("code,stripe_price_id").eq("code",code).eq("active",true).single();
    if(error||!plan?.stripe_price_id) return NextResponse.json({error:"Membership plan unavailable."},{status:400});
    const {data:capacityHold,error:capacityError}=await db.rpc("claim_membership_checkout",{p_user_id:user.id});
    if(capacityError||!capacityHold)return NextResponse.json({error:capacityError?.message||"No memberships currently available. Please contact WrayFitness."},{status:409});
    const acceptedAt=new Date().toISOString();
    const {error:consentError}=await db.from("membership_checkout_holds").update({terms_version:"2026-10-03",terms_accepted_at:acceptedAt,immediate_service_requested_at:acceptedAt}).eq("id",capacityHold).eq("user_id",user.id);if(consentError){await db.from("membership_checkout_holds").delete().eq("id",capacityHold);throw consentError}
    let session:Stripe.Checkout.Session;
    try{session=await stripe().checkout.sessions.create({
      mode:"subscription",customer_email:user.email,line_items:[{price:plan.stripe_price_id,quantity:1}],
      success_url:`${SITE}/account?checkout=success`,cancel_url:`${SITE}/join?plan=${code}&checkout=cancelled`,
      client_reference_id:user.id,expires_at:Math.floor(Date.now()/1000)+30*60,metadata:{kind:"membership",user_id:user.id,plan_code:code,capacity_hold_id:capacityHold,terms_version:"2026-10-03",immediate_service_requested:"true"},
      subscription_data:{metadata:{user_id:user.id,plan_code:code,terms_version:"2026-10-03"}}
    });
    const {error:attach}=await db.from("membership_checkout_holds").update({stripe_checkout_session_id:session.id}).eq("id",capacityHold);
    if(attach)throw attach;
    }catch(e){await db.from("membership_checkout_holds").delete().eq("id",capacityHold);throw e}
    return NextResponse.json({url:session.url});
  }
  if(body.type==="credit_topup"){
    const credits=Math.floor(Number(body.credits));
    if(body.acceptTopupTerms!==true||body.immediateServiceRequested!==true)return NextResponse.json({error:"Please accept the extra-credit terms and request immediate access before continuing."},{status:400});
    if(!Number.isInteger(credits)||credits<1||credits>20)return NextResponse.json({error:"Choose between 1 and 20 extra credits."},{status:400});
    const {data:entitlement,error:ee}=await uc.rpc("my_booking_entitlement");
    const ent=entitlement?.[0];
    if(ee||!ent?.has_active_membership)return NextResponse.json({error:"Extra credits are only available with an active membership."},{status:409});
    if(ent.topups_allowed!==true)return NextResponse.json({error:"Extra credits are not available once a membership has been cancelled."},{status:409});
    if(Number(ent.total_credits||0)>0)return NextResponse.json({error:"Extra credits are available once you have used your existing credits."},{status:409});
    const unitAmount=Number(ent.topup_price_pence);
    if(!Number.isInteger(unitAmount)||unitAmount<1)throw new Error("Extra-credit pricing is not configured");
    const session=await stripe().checkout.sessions.create({
      mode:"payment",customer_email:user.email,
      line_items:[{price_data:{currency:"gbp",unit_amount:unitAmount,product_data:{name:"Hall Farm Gym extra member credit"}},quantity:credits}],
      success_url:`${SITE}/account?topup=success`,cancel_url:`${SITE}/account?topup=cancelled`,
      client_reference_id:user.id,
      metadata:{kind:"credit_topup",user_id:user.id,credits:String(credits),unit_amount_pence:String(unitAmount),plan_code:String(ent.plan_code||""),immediate_service_requested:"true"},
      payment_intent_data:{metadata:{kind:"credit_topup",user_id:user.id,credits:String(credits)}}
    });
    return NextResponse.json({url:session.url});
  }
  if(body.type==="member_guest"){
    const {data:ack}=await db.from("booking_acknowledgements").select("group_responsibility,adult_supervision").eq("user_id",user.id).maybeSingle();
    if(!ack?.group_responsibility||!ack?.adult_supervision)return NextResponse.json({error:"Please confirm the saved booking safety requirements first."},{status:409});
    const startsAt=String(body.startsAt||""); const partySize=Math.max(2,Math.min(6,Number(body.partySize)||2));
    const {data:holdId,error:he}=await db.rpc("create_member_guest_hold",{p_user_id:user.id,p_starts_at:startsAt,p_party_size:partySize});
    if(he)return NextResponse.json({error:he.message},{status:409});
    try{const {data:hold,error:holdError}=await db.from("member_guest_holds").select("guest_count").eq("id",holdId).single();if(holdError||!hold?.guest_count)throw new Error("Guest checkout could not be prepared");const session=await stripe().checkout.sessions.create({mode:"payment",customer_email:user.email,line_items:[{price:GUEST_PRICE,quantity:hold.guest_count}],expires_at:Math.floor(Date.now()/1000)+31*60,success_url:`${SITE}/booking-confirmed?kind=guest&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${SITE}/book?guest=cancelled`,client_reference_id:user.id,metadata:{kind:"member_guest",user_id:user.id,hold_id:holdId,guest_count:String(hold.guest_count)}});await db.rpc("attach_member_guest_checkout",{p_hold_id:holdId,p_session_id:session.id});return NextResponse.json({url:session.url});}
    catch(e){await db.from("member_guest_holds").delete().eq("id",holdId);throw e;}
  }
  if(body.type==="payg"){
    const {data:ack}=await db.from("booking_acknowledgements").select("group_responsibility,adult_supervision").eq("user_id",user.id).maybeSingle();
    if(!ack?.group_responsibility||!ack?.adult_supervision)return NextResponse.json({error:"Please confirm the saved booking safety requirements first."},{status:409});
    const startsAt=String(body.startsAt||""); const partySize=Number(body.partySize);
    if(!Number.isInteger(partySize)||partySize<1||partySize>6)return NextResponse.json({error:"Choose between one and six people."},{status:400});
    const {data:holdId,error:he}=await db.rpc("create_payg_hold",{p_user_id:user.id,p_starts_at:startsAt,p_party_size:partySize});
    if(he) return NextResponse.json({error:he.message},{status:409});
    try{
      const {data:settings,error:se}=await db.from("gym_settings").select("payg_price_pence").single();
      if(se||!settings||settings.payg_price_pence<1)throw new Error("PAYG price is not configured");
      const session=await stripe().checkout.sessions.create({
       mode:"payment",customer_email:user.email,line_items:[{price_data:{currency:"gbp",unit_amount:settings.payg_price_pence+500*(partySize-1),product_data:{name:`The Hall Farm Gym private session for ${partySize} ${partySize===1?"person":"people"}`}},quantity:1}],expires_at:Math.floor(Date.now()/1000)+31*60,
       success_url:`${SITE}/booking-confirmed?kind=payg&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${SITE}/book?payg=cancelled`,
       client_reference_id:user.id,metadata:{kind:"payg",user_id:user.id,hold_id:holdId}
      });
      await db.rpc("attach_checkout_session",{p_hold_id:holdId,p_session_id:session.id});
      return NextResponse.json({url:session.url});
    }catch(e){await db.from("checkout_holds").delete().eq("id",holdId); throw e;}
  }
  return NextResponse.json({error:"Invalid checkout type."},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Checkout failed."},{status:500})}
}
