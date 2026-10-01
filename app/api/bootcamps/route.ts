import {NextResponse} from "next/server";
import {adminClient} from "../../../lib/supabase-server";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){try{
 const db=adminClient(),{data,error}=await db.from("bootcamp_classes").select("id,title,description,starts_at,ends_at,capacity,price_pence").eq("status","scheduled").gte("starts_at",new Date().toISOString()).order("starts_at").limit(50);
 if(error)throw error;
 const ids=(data||[]).map(x=>x.id);
 const {data:bookings,error:be}=ids.length?await db.from("bootcamp_bookings").select("class_id,party_size,status,hold_expires_at").in("class_id",ids):{data:[],error:null};
 if(be)throw be;const now=Date.now();
 return NextResponse.json({classes:(data||[]).map(x=>({...x,booked:(bookings||[]).filter(b=>b.class_id===x.id&&b.status==="confirmed").reduce((sum,b)=>sum+b.party_size,0),remaining:Math.max(0,x.capacity-(bookings||[]).filter(b=>b.class_id===x.id&&(b.status==="confirmed"||(b.status==="pending"&&new Date(b.hold_expires_at).getTime()>now))).reduce((sum,b)=>sum+b.party_size,0))}))},{headers:{"Cache-Control":"no-store"}});
}catch(e){console.error("Bootcamps lookup",e);return NextResponse.json({error:"Unable to load bootcamps"},{status:500})}}
