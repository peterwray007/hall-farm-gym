import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://www.hallfarmgym.com";

export async function POST(req:NextRequest){
 try{
  if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");
  const body=await req.json();
  const raw=Array.isArray(body?.items)?body.items:[];
  if(raw.length<1||raw.length>20)return NextResponse.json({error:"Choose at least one shop item."},{status:400});
  const ids=[...new Set(raw.map((x:any)=>String(x.id||"")).filter(Boolean))];
  const db=adminClient();
  const {data:products,error}=await db.from("shop_products").select("id,name,price_pence,sizes,active").in("id",ids).eq("active",true);
  if(error)throw error;
  const map=new Map((products||[]).map((p:any)=>[p.id,p]));
  const lines:any[]=[];const summary:any[]=[];
  for(const item of raw){
   const p:any=map.get(String(item.id||""));const quantity=Math.floor(Number(item.quantity));
   if(!p||!Number.isInteger(quantity)||quantity<1||quantity>10)return NextResponse.json({error:"One of the shop items is invalid."},{status:400});
   const sizes=Array.isArray(p.sizes)?p.sizes:[];const size=sizes.length?String(item.size||""):"";
   if(sizes.length&&!sizes.includes(size))return NextResponse.json({error:"Choose a valid size for "+p.name+"."},{status:400});
   const label=size?p.name+" · "+size:p.name;
   lines.push({price_data:{currency:"gbp",unit_amount:p.price_pence,product_data:{name:label}},quantity});
   summary.push({id:p.id,name:p.name,quantity,size:size||null,unit_amount:p.price_pence});
  }
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const session=await stripe.checkout.sessions.create({
   mode:"payment",
   line_items:lines,
   success_url:SITE+"/shop/success?session_id={CHECKOUT_SESSION_ID}",
   cancel_url:SITE+"/shop?checkout=cancelled",
   metadata:{kind:"shop",items:JSON.stringify(summary).slice(0,480)},
   payment_intent_data:{metadata:{kind:"shop"}}
  });
  return NextResponse.json({url:session.url});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not start shop checkout."},{status:500})}
}