import {NextRequest,NextResponse} from "next/server";
import {adminClient,userClient} from "../../../../../lib/supabase-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{
const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
const {data:{user}}=await userClient(token).auth.getUser(token);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
const db=adminClient(),{data:isAdmin}=await userClient(token).rpc("is_admin");if(isAdmin!==true)return NextResponse.json({error:"Admin required"},{status:403});
const{id}=await req.json();const{data:b}=await db.from("bootcamp_bookings").select("id,status,needs_review").eq("id",id).single();
if(!b||b.status!=="confirmed"||!b.needs_review)return NextResponse.json({error:"Review not found"},{status:404});
const {error}=await db.from("bootcamp_bookings").update({needs_review:false}).eq("id",id);if(error)throw error;
return NextResponse.json({ok:true});
}catch(e){console.error("Clear bootcamp review",e);return NextResponse.json({error:"Unable to clear review"},{status:500})}}
