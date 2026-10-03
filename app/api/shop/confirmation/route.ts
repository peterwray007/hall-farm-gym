import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const id=new URL(req.url).searchParams.get("session_id")||"";
  if(!id.startsWith("cs_")||!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Invalid checkout."},{status:400});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const s=await stripe.checkout.sessions.retrieve(id);
  if(s.metadata?.kind!=="shop")return NextResponse.json({error:"Shop checkout not found."},{status:404});
  const items=await stripe.checkout.sessions.listLineItems(id,{limit:20});
  return NextResponse.json({paid:s.payment_status==="paid",amount_total:s.amount_total||0,currency:s.currency||"gbp",items:items.data.map(x=>({description:x.description,quantity:x.quantity,amount_total:x.amount_total}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not confirm this payment."},{status:500})}
}