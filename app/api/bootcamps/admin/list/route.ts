import {NextRequest,NextResponse} from "next/server";
import {adminClient,userClient} from "../../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{
const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
const {data:{user}}=await userClient(token).auth.getUser(token);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
const db=adminClient(),{data:isAdmin}=await userClient(token).rpc("is_admin");if(isAdmin!==true)return NextResponse.json({error:"Admin required"},{status:403});
const {data:classes,error:ce}=await db.from("bootcamp_classes").select("id,title,starts_at,ends_at,capacity,status,description").gte("starts_at",new Date(Date.now()-864e5).toISOString()).order("starts_at").limit(100);
if(ce)throw ce;const ids=(classes||[]).map(x=>x.id);
const {data:bookings,error:be}=ids.length?await db.from("bootcamp_bookings").select("id,class_id,user_id,party_size,status,payment_type,contact_name,contact_email,health_answers,needs_review,attendee_ids").in("class_id",ids).order("created_at",{ascending:false}).limit(200):{data:[],error:null};
if(be)throw be;
const titles=new Map((classes||[]).map(x=>[x.id,x.title]));
return NextResponse.json({classes:classes||[],bookings:(bookings||[]).map(x=>({...x,class_title:titles.get(x.class_id)||"Bootcamp"}))},{headers:{"Cache-Control":"private,no-store"}});
}catch(e){console.error("Admin bootcamp list",e);return NextResponse.json({error:"Unable to load classes"},{status:500})}}
