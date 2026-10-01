import {NextRequest,NextResponse} from "next/server";
import {adminClient,userClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
 if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data:{user}}=await userClient(token).auth.getUser(token);
 if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const db=adminClient(),{data,error}=await db.from("bootcamp_bookings").select("id,class_id,status,party_size,payment_type").eq("user_id",user.id).eq("status","confirmed").order("created_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({error:"Unable to load classes"},{status:500});
 const ids=(data||[]).map(x=>x.class_id),{data:classes}=ids.length?await db.from("bootcamp_classes").select("id,title,starts_at").in("id",ids):{data:[]};
 const map=new Map((classes||[]).map(c=>[c.id,c]));
 const results=(data||[]).map(b=>({...b,title:map.get(b.class_id)?.title,starts_at:map.get(b.class_id)?.starts_at})).filter(b=>b.starts_at&&new Date(b.starts_at)>=new Date());
 return NextResponse.json({bookings:results},{headers:{"Cache-Control":"private,no-store"}});
}
