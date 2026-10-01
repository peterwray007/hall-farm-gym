import {NextRequest,NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){const id=new URL(req.url).searchParams.get("session_id")||"";
if(!/^cs_(live|test)_[a-zA-Z0-9]+$/.test(id)||id.length>220)return NextResponse.json({error:"Invalid reference"},{status:400});
const db=adminClient(),{data:b}=await db.from("bootcamp_bookings").select("class_id,status,party_size,needs_review").eq("stripe_checkout_session_id",id).eq("payment_type","payg").maybeSingle();
if(!b)return NextResponse.json({status:"processing"},{headers:{"Cache-Control":"no-store"}});
const {data:c}=await db.from("bootcamp_classes").select("title,starts_at").eq("id",b.class_id).single();
return NextResponse.json({status:b.status,title:c?.title,startsAt:c?.starts_at,needsReview:b.needs_review},{headers:{"Cache-Control":"no-store"}});
}
