"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
export default function ClassConfirmed(){
 const[data,setData]=useState<any>(null),[tries,setTries]=useState(0);
 useEffect(()=>{const p=new URLSearchParams(location.search),bookingId=p.get("booking_id"),sessionId=p.get("session_id");let timeout:any;
 async function check(){
  try{let r:Response;
   if(bookingId){const{data:{session}}=await supabase().auth.getSession();if(!session){location.href="/login";return}r=await fetch("/api/bootcamps/manage?id="+encodeURIComponent(bookingId),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});}
   else if(sessionId){r=await fetch("/api/bootcamps/status?session_id="+encodeURIComponent(sessionId),{cache:"no-store"});}
   else{setData({status:"invalid"});return}
   const v=await r.json();const result=bookingId?{status:v.booking?.status,title:v.booking?.title,startsAt:v.booking?.startsAt,partySize:v.booking?.partySize,member:true}:v;
   setData(result);if(result.status==="processing"&&tries<20)timeout=setTimeout(()=>setTries(n=>n+1),1500);
  }catch(e){setData({status:"processing"});}
 }
 check();return()=>clearTimeout(timeout);
 },[tries]);
 return <main><section className="booking-success">{data?.status==="confirmed"?<><div className="success-icon" aria-hidden="true">✓</div><p className="eyebrow">BOOTCAMP BOOKING CONFIRMED</p><h1>You're booked in!</h1><article className="success-details"><h2>{data.title}</h2><p>{data.startsAt?new Date(data.startsAt).toLocaleString("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/London"}):""}</p><p>{data.member?data.partySize+" attending · 1 membership credit used":"£12.50 paid · 1 place"}</p>{data.needsReview&&<p>We'll contact you about your health review before the class.</p>}</article><p>We've sent the confirmation to your email.</p></>:<><h1>{data?.status==="invalid"?"Booking reference missing":"Confirming your bootcamp…"}</h1><p>If you have paid, please don't pay again. We'll email your confirmation once your booking is ready.</p></>}<a className="secondary" href="/bootcamps">Back to classes</a></section></main>
}
