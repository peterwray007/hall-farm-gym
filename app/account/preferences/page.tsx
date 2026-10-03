"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

export default function BookingPreferences(){
 const[group,setGroup]=useState(false),[adult,setAdult]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const sb=supabase(),{data:{user}}=await sb.auth.getUser();if(!user){location.replace("/login");return}
 const{data}=await sb.from("booking_acknowledgements").select("group_responsibility,adult_supervision").eq("user_id",user.id).maybeSingle();
 setGroup(data?.group_responsibility===true);setAdult(data?.adult_supervision===true);setLoading(false)})()},[]);
 async function save(){setSaving(true);setMsg("");const sb=supabase(),{data:{user}}=await sb.auth.getUser();if(!user){location.replace("/login");return}const now=new Date().toISOString();
 const{error}=await sb.from("booking_acknowledgements").upsert({user_id:user.id,group_responsibility:group,adult_supervision:adult,group_responsibility_at:group?now:null,adult_supervision_at:adult?now:null,updated_at:now});
 setMsg(error?error.message:"Your booking & safety preferences have been saved.");setSaving(false)}
 if(loading)return <main><section className="membership-page"><p>Loading your preferences…</p></section></main>;
 return <main><section className="membership-page"><p className="eyebrow">MY ACCOUNT</p><h1>Booking &amp; safety preferences</h1><p className="membership-intro">These are the recurring confirmations used when you book the gym. Once saved, you won’t need to tick them every time.</p>
 <article className="notice"><label className="check"><input type="checkbox" checked={group} onChange={e=>setGroup(e.target.checked)}/><span>I am at least 18 and will ensure everyone in my booking is registered and follows the gym rules.</span></label><label className="check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I understand anyone under 18 must be accompanied and supervised by an adult aged 18 or over throughout their visit.</span></label></article>
 <p className="formhint">If you untick either option, the booking page will ask you to confirm it again before your next booking.</p>{msg&&<p className="bookingmessage" role="status">{msg}</p>}
 <div className="actions"><button className="primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save preferences"}</button><a className="secondary" href="/account">Back to My Account</a></div>
 </section></main>
}