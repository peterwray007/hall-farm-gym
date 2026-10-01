import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient,userClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
  if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
  const {data:{user},error}=await userClient(token).auth.getUser(token);
  if(error||!user)return NextResponse.json({error:"Invalid session"},{status:401});
  const u=new URL(req.url),id=u.searchParams.get("id"),sessionId=u.searchParams.get("session_id");
  const db=adminClient();
  let query=db.from("bookings").select("id,starts_at,party_size,kind,guest_fee_paid,status").eq("user_id",user.id).eq("status","confirmed");
  if(sessionId){
   if(!/^cs_(live|test)_[a-zA-Z0-9]+$/.test(sessionId)||sessionId.length>220)return NextResponse.json({error:"Invalid checkout reference"},{status:400});
   query=query.eq("stripe_checkout_session_id",sessionId);
  }else if(id){
   if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid booking reference"},{status:400});
   query=query.eq("id",id);
  }else{
   query=query.gte("starts_at",new Date(Date.now()-3600000).toISOString());
  }
  const {data:b,error:be}=await query.order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(be)throw be;
  if(b)return NextResponse.json({status:"confirmed",booking:b},{headers:{"Cache-Control":"no-store"}});
  if(sessionId&&process.env.STRIPE_SECRET_KEY){
   const session=await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sessionId);
   if(session.metadata?.user_id!==user.id)return NextResponse.json({error:"Booking not found"},{status:404});
   if(session.payment_status==="paid")return NextResponse.json({status:"processing",paymentReceived:true},{headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json({status:"processing",paymentReceived:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("Booking confirmation check",e);return NextResponse.json({error:"Unable to check confirmation"},{status:500})}
}
