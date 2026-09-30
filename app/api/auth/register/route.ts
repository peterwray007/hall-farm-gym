import {NextRequest,NextResponse} from "next/server";
import {adminClient} from "../../../../lib/supabase-server";
export const runtime="nodejs";

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const email=String(body.email||"").trim().toLowerCase();
  const phone=String(body.phone||"").trim().replace(/\s+/g,"");
  const password=String(body.password||"");
  if(!email.includes("@"))return NextResponse.json({error:"Enter a valid email address."},{status:400});
  if(phone.length<10)return NextResponse.json({error:"Enter a valid mobile number."},{status:400});
  if(password.length<8)return NextResponse.json({error:"Your password must be at least 8 characters."},{status:400});
  const db=adminClient();
  const {data,error}=await db.auth.admin.createUser({email,phone,password,email_confirm:true,phone_confirm:true});
  if(error){
   const m=error.message.toLowerCase();
   if(m.includes("already")||m.includes("registered")||m.includes("exists"))return NextResponse.json({error:"You already have an account. Use Member login instead."},{status:409});
   return NextResponse.json({error:error.message},{status:400});
  }
  if(!data.user)return NextResponse.json({error:"Could not create your account."},{status:500});
  await db.from("profiles").upsert({id:data.user.id,phone},{onConflict:"id"});
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create account."},{status:500})}
}