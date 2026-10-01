import {NextResponse} from "next/server";
import {adminClient} from "../../../lib/supabase-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){try{
 const {data,error}=await adminClient().from("legal_documents").select("id,document_type,title,body,version").eq("active",true).order("created_at");
 if(error)throw error;
 return NextResponse.json({documents:data||[]},{headers:{"Cache-Control":"no-store"}});
}catch(e){console.error("Gym documents lookup",e);return NextResponse.json({error:"Unable to load gym documents"},{status:503})}}
