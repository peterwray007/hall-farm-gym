import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient,userClient} from "../../../../lib/supabase-server";
import {sendEmail} from "../../../../lib/email";
export const runtime="nodejs";
async function find(req:NextRequest,body:any){
 const db=adminClient(),token=String(body.token||""),id=String(body.id||"");
 if(token&&/^[0-9a-f-]{36}$/i.test(token)){const {data}=await db.from("bootcamp_bookings").select("*").eq("access_token",token).eq("payment_type","payg").maybeSingle();return data}
 const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
 if(!bearer||!id)return null;
 const {data:{user}}=await userClient(bearer).auth.getUser(bearer);if(!user)return null;
 const{data}=await db.from("bootcamp_bookings").select("*").eq("id",id).eq("user_id",user.id).eq("payment_type","member").maybeSingle();
 return data;
}
export async function GET(req:NextRequest){const p=new URL(req.url).searchParams;const b=await find(req,{token:p.get("token"),id:p.get("id")});if(!b)return NextResponse.json({error:"Booking not found"},{status:404});
 const{data:c}=await adminClient().from("bootcamp_classes").select("title,starts_at").eq("id",b.class_id).single();
 return NextResponse.json({booking:{id:b.id,status:b.status,partySize:b.party_size,title:c?.title,startsAt:c?.starts_at}},{headers:{"Cache-Control":"private,no-store"}});
}
export async function POST(req:NextRequest){try{
 const b=await find(req,await req.json());if(!b)return NextResponse.json({error:"Booking not found"},{status:404});
 if(b.status!=="confirmed")return NextResponse.json({error:"Booking already cancelled or unavailable"},{status:409});
 const db=adminClient(),{data:c}=await db.from("bootcamp_classes").select("title,starts_at").eq("id",b.class_id).single();
 if(!c)return NextResponse.json({error:"Class not found"},{status:404});
 const{data:setting}=await db.from("gym_settings").select("cancellation_hours").single();
 const refundable=new Date(c.starts_at).getTime()>=Date.now()+(setting?.cancellation_hours??12)*3600000;
 if(refundable&&b.payment_type==="payg"){
  if(!b.stripe_payment_intent_id||!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Contact WrayFitness about the refund"},{status:409});
  await new Stripe(process.env.STRIPE_SECRET_KEY).refunds.create({payment_intent:b.stripe_payment_intent_id},{idempotencyKey:"bootcamp-refund-"+b.id});
 }
 const {data:updated,error}=await db.from("bootcamp_bookings").update({status:"cancelled"}).eq("id",b.id).eq("status","confirmed").select("id").maybeSingle();
 if(error)throw error;if(!updated)return NextResponse.json({error:"Booking was already changed"},{status:409});
 if(refundable&&b.payment_type==="member"){
  if(b.credit_source==="gift"){const{error:ce}=await db.rpc("restore_bootcamp_credit",{p_membership_id:b.membership_id||null,p_user_id:b.user_id,p_credit_source:"gift"});if(ce)console.error("Gifted bootcamp credit restoration failed",ce)}
  else if(b.membership_id){const{data:m}=await db.from("memberships").select("status,period_end").eq("id",b.membership_id).single();if(m?.status==="active"&&(!m.period_end||new Date(m.period_end)>new Date())){const{error:ce}=await db.rpc("restore_bootcamp_credit",{p_membership_id:b.membership_id,p_user_id:b.user_id,p_credit_source:"membership"});if(ce)console.error("Bootcamp credit restoration failed",ce)}}
 }
 const email=b.contact_email||(b.user_id?(await db.auth.admin.getUserById(b.user_id)).data.user?.email:null);
 const message=refundable?(b.payment_type==="member"?(b.credit_source==="gift"?"Your gifted credit has been returned.":"Your membership credit has been returned if your billing period is still active."):"Your £12.50 payment has been refunded."):"This was within the cancellation window, so no credit or refund is due.";
 if(email)try{await sendEmail(email,"Hall Farm Gym bootcamp cancelled",'<h2>Your bootcamp place has been cancelled</h2><p>'+c.title+' · '+new Date(c.starts_at).toLocaleString("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/London"})+'</p><p>'+message+'</p>')}catch(e){console.error("Bootcamp cancellation email",e)}
 return NextResponse.json({message:"Booking cancelled. "+message});
}catch(e){console.error("Bootcamp cancellation",e);return NextResponse.json({error:"Unable to cancel. Contact WrayFitness."},{status:500})}}
