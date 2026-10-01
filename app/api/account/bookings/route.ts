import {NextRequest,NextResponse} from "next/server";
import {adminClient,userClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
  if(!token)return NextResponse.json({error:"Sign in required"},{status:401});
  const {data:{user},error}=await userClient(token).auth.getUser(token);
  if(error||!user)return NextResponse.json({error:"Invalid session"},{status:401});
  const {data,error:e}=await adminClient().from("bookings").select("id,starts_at,status,party_size,kind,bringing_guest,guest_name,guest_access_token").eq("user_id",user.id).eq("status","confirmed").gte("starts_at",new Date().toISOString()).order("starts_at");
  if(e)throw e;
  return NextResponse.json({bookings:data||[]},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("Account bookings lookup failed",e);return NextResponse.json({error:"Unable to load your bookings."},{status:500})}
}
