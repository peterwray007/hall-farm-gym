import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){const db=adminClient();let holdId:string|null=null;try{
const b=await req.json();
if(!b.classId||!b.acceptTerms||!b.healthConsent||!b.name||!b.email||!b.phone||!b.emergencyName||!b.emergencyPhone||["heart_condition","chest_pain","dizziness","medical_reason"].some(k=>typeof b.answers?.[k]!=="boolean"))return NextResponse.json({error:"Complete your details and every health question"},{status:400});
if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Payments are unavailable"},{status:503});
const {data:id,error}=await db.rpc("hold_bootcamp_payg",{p_class_id:b.classId,p_name:b.name,p_email:b.email,p_phone:b.phone,p_emergency_name:b.emergencyName,p_emergency_phone:b.emergencyPhone,p_answers:b.answers});
if(error)return NextResponse.json({error:error.message},{status:409});holdId=id;
const {data:c}=await db.from("bootcamp_classes").select("title,price_pence").eq("id",b.classId).single();if(!c)throw Error("Class unavailable");
const site=process.env.NEXT_PUBLIC_SITE_URL||"https://www.hallfarmgym.com";
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:String(b.email).trim(),client_reference_id:id,expires_at:Math.floor(Date.now()/1000)+31*60,line_items:[{price_data:{currency:"gbp",unit_amount:c.price_pence,product_data:{name:c.title+" · bootcamp place"}},quantity:1}],success_url:site+"/bootcamps/confirmed?session_id={CHECKOUT_SESSION_ID}",cancel_url:site+"/bootcamps?cancelled=true",metadata:{kind:"bootcamp_payg",booking_id:id}});
const {error:attach}=await db.from("bootcamp_bookings").update({stripe_checkout_session_id:session.id}).eq("id",id);
if(attach)throw attach;
return NextResponse.json({url:session.url});
}catch(e){if(holdId)await db.from("bootcamp_bookings").update({status:"cancelled"}).eq("id",holdId).eq("status","pending");console.error("Bootcamp checkout",e);return NextResponse.json({error:"Could not start checkout"},{status:500})}}
