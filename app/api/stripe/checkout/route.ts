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
    const {data:cleared,error:ce}=await db.rpc("member_is_cleared",{p_uid:user.id});if(ce||cleared!==true)return NextResponse.json({error:"Please complete your health form, gym induction and gym terms before joining."},{status:409});
    const {data:existing}=await db.from("memberships").select("id,status").eq("owner_id",user.id).in("status",["active","past_due","paused"]).limit(1).maybeSingle();if(existing)return NextResponse.json({error:"You already have a membership. Manage it from My Account."},{status:409});
    const code=String(body.plan||"").toLowerCase();
    const {data:plan,error}=await db.from("membership_plans").select("code,stripe_price_id").eq("code",code).eq("active",true).single();
    if(error||!plan?.stripe_price_id) return NextResponse.json({error:"Membership plan unavailable."},{status:400});
    const {data:capacityHold,error:capacityError}=await db.rpc("claim_membership_checkout",{p_user_id:user.id});
    if(capacityError||!capacityHold)return NextResponse.json({error:capacityError?.message||"No memberships currently available. Please contact WrayFitness."},{status:409});
    let session:Stripe.Checkout.Session;
    try{session=await stripe().checkout.sessions.create({
      mode:"subscription",customer_email:user.email,line_items:[{price:plan.stripe_price_id,quantity:1}],
      success_url:`${SITE}/account?checkout=success`,cancel_url:`${SITE}/join?plan=${code}&checkout=cancelled`,
      client_reference_id:user.id,expires_at:Math.floor(Date.now()/1000)+30*60,metadata:{kind:"membership",user_id:user.id,plan_code:code,capacity_hold_id:capacityHold},
      subscription_data:{metadata:{user_id:user.id,plan_code:code}}
    });
    const {error:attach}=await db.from("membership_checkout_holds").update({stripe_checkout_session_id:session.id}).eq("id",capacityHold);
    if(attach)throw attach;
    }catch(e){await db.from("membership_checkout_holds").delete().eq("id",capacityHold);throw e}
    return NextResponse.json({url:session.url});
  }
  if(body.type==="member_guest"){
    const startsAt=String(body.startsAt||""); const partySize=Math.max(2,Math.min(5,Number(body.partySize)||2));
    const {data:holdId,error:he}=await db.rpc("create_member_guest_hold",{p_user_id:user.id,p_starts_at:startsAt,p_party_size:partySize});
    if(he)return NextResponse.json({error:he.message},{status:409});
    try{const session=await stripe().checkout.sessions.create({mode:"payment",customer_email:user.email,line_items:[{price:GUEST_PRICE,quantity:1}],expires_at:Math.floor(Date.now()/1000)+31*60,success_url:`${SITE}/booking-confirmed?kind=guest&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${SITE}/book?guest=cancelled`,client_reference_id:user.id,metadata:{kind:"member_guest",user_id:user.id,hold_id:holdId}});await db.rpc("attach_member_guest_checkout",{p_hold_id:holdId,p_session_id:session.id});return NextResponse.json({url:session.url});}
    catch(e){await db.from("member_guest_holds").delete().eq("id",holdId);throw e;}
  }
  if(body.type==="payg"){
    const startsAt=String(body.startsAt||""); const partySize=Math.max(1,Math.min(5,Number(body.partySize)||1));
    const {data:holdId,error:he}=await db.rpc("create_payg_hold",{p_user_id:user.id,p_starts_at:startsAt,p_party_size:partySize});
    if(he) return NextResponse.json({error:he.message},{status:409});
    try{
      const {data:settings,error:se}=await db.from("gym_settings").select("payg_price_pence").single();
      if(se||!settings||settings.payg_price_pence<1)throw new Error("PAYG price is not configured");
      const session=await stripe().checkout.sessions.create({
       mode:"payment",customer_email:user.email,line_items:[{price_data:{currency:"gbp",unit_amount:settings.payg_price_pence,product_data:{name:"The Hall Farm Gym private session"}},quantity:1}],expires_at:Math.floor(Date.now()/1000)+31*60,
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
