import {NextResponse} from "next/server";
import {adminClient} from "../../../lib/supabase-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{
 const {data,error}=await adminClient().from("legal_documents").select("id,title,body,version").eq("document_type","gym_induction").eq("active",true).order("created_at",{ascending:false});
 if(error)throw error;
 return NextResponse.json({documents:data||[]},{headers:{"Cache-Control":"no-store"}});
}catch(e){console.error("Induction instructions",e);return NextResponse.json({error:"Induction temporarily unavailable"},{status:503})}}
