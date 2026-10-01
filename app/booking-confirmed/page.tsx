"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../lib/supabase";
type Booking={id:string;starts_at:string;party_size:number;kind:string;guest_fee_paid:boolean;status:string};
export default function Confirmed(){
 const[b,setB]=useState<Booking|null>(null),[pending,setPending]=useState(true),[paid,setPaid]=useState(false),[tries,setTries]=useState(0),[message,setMessage]=useState("");
 useEffect(()=>{
  let timer:any;let cancelled=false;
  async function load(){
   const sb=supabase(),{data:{session}}=await sb.auth.getSession();
   if(!session){location.replace("/login");return}
   const p=new URLSearchParams(location.search),sessionId=p.get("session_id"),id=p.get("id");
   const q=new URLSearchParams();if(sessionId)q.set("session_id",sessionId);else if(id)q.set("id",id);
   try{
    const r=await fetch("/api/bookings/confirmation?"+q.toString(),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
    const x=await r.json();if(cancelled)return;
    if(!r.ok){setMessage("We couldn't check the booking just now. Please try again.");setPending(false);return}
    if(x.status==="confirmed"&&x.booking){setB(x.booking);setPending(false);return}
    setPaid(!!x.paymentReceived);
    if(tries<20)timer=setTimeout(()=>setTries(n=>n+1),1500);
    else setPending(false);
   }catch(e){if(!cancelled){setMessage("We couldn't check the booking just now. Please try again.");setPending(false)}}
  }
  load();return()=>{cancelled=true;clearTimeout(timer)}
 },[tries]);
 function retry(){setPending(true);setMessage("");setTries(0)}
 const when=b?new Date(b.starts_at):null;
 return <main><section className="booking-success">
  {b?<><div className="success-icon" aria-hidden="true">✓</div><p className="eyebrow">BOOKING CONFIRMED</p><h1>You're booked in!</h1>
   <p className="success-intro">Your private session at The Hall Farm Gym is confirmed. We've sent the details to your email.</p>
   <article className="success-details"><p className="eyebrow">YOUR SESSION</p><h2>{when?.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/London"})}</h2><p className="success-time">{when?.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}</p><p>{b.party_size} {b.party_size===1?"person":"people"} · 50-minute private gym session</p><p>{b.kind==="member"?(b.guest_fee_paid?"1 member credit + £5 guest":"1 member credit used"):"£12.50 PAYG"}</p></article>
   <div className="actions"><a className="primary" href="/account">View your bookings</a><a className="secondary" href="/">Back to homepage</a></div>
  </>:<><p className="eyebrow">{paid?"PAYMENT RECEIVED":"CHECKING YOUR BOOKING"}</p><h1>{paid?"Payment received. Just finalising your booking.":"Confirming your booking…"}</h1>
   <p className="success-intro">{message||"Please don't pay again. We'll check your booking automatically and confirm it as soon as it's ready."}</p>
   {!pending&&<div className="actions"><button className="primary" onClick={retry}>Check again</button><a className="secondary" href="/account">My Account</a></div>}
   <p className="formhint">If you have already paid, check your confirmation email. <a href="/contact">Contact us</a> if it hasn't arrived after a few minutes.</p>
  </>}
 </section></main>
}
