import {NextRequest,NextResponse} from "next/server";
import {userClient,adminClient} from "../../../../lib/supabase-server";
import {sendEmail} from "../../../../lib/email";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{
const token=req.headers.get("authorization")?.replace(/^Bearer\s+/,"");
if(!token)return NextResponse.json({error:"Please sign in"},{status:401});
const uc=userClient(token),{data:{user}}=await uc.auth.getUser(token);
if(!user)return NextResponse.json({error:"Please sign in"},{status:401});
const b=await req.json(),attendees=b.attendeeIds;
if(!Array.isArray(attendees)||attendees.length<1||attendees.length>3||attendees.some(x=>typeof x!=="string"))return NextResponse.json({error:"Choose the named members attending"},{status:400});
const {data:id,error}=await uc.rpc("book_bootcamp_with_credit",{p_class_id:b.classId,p_attendee_ids:attendees});
if(error)return NextResponse.json({error:error.message},{status:409});
const {data:c}=await adminClient().from("bootcamp_classes").select("title,starts_at").eq("id",b.classId).single();
if(c&&user.email){const when=new Date(c.starts_at).toLocaleString("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/London"});try{await sendEmail(user.email,"Hall Farm Gym bootcamp confirmed",'<h2>Your bootcamp is booked!</h2><p>'+c.title+'</p><p>'+when+'</p><p>'+attendees.length+' named '+(attendees.length===1?'member':'members')+' attending · 1 membership credit used.</p><p>If you need to cancel, please contact WrayFitness.</p>')}catch(e){console.error("Bootcamp member email",e)}}
return NextResponse.json({id});}catch(e){console.error(e);return NextResponse.json({error:"Unable to book bootcamp"},{status:500})}}
