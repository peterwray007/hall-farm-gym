"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {supabase} from "../../lib/supabase";

export default function SiteHeader(){
 const [signedIn,setSignedIn]=useState(false);
 const pathname=usePathname();
 useEffect(()=>{
  supabase().auth.getUser().then(({data:{user}})=>setSignedIn(!!user));
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(e=>console.error("Gym app registration",e));
 },[]);
 const active=(href:string)=>href==="/"?pathname==="/":pathname.startsWith(href);
 const accountHref=signedIn?"/account":"/login";
 return <div className="siteheader">
  <div className="siteheader-inner">
   <a className="brand" href="/" aria-label="The Hall Farm Gym home"><img src="/hall-farm-gym-logo.webp" alt="The Hall Farm Gym"/></a>
   <nav aria-label="Main navigation">
    <a className={active("/membership")?"active":""} href="/membership">Membership</a>
    <a className={active("/book")||active("/payg")?"active":""} href="/book">Book the gym</a>
    <a className={active("/bootcamps")?"active":""} href="/bootcamps">Classes</a>
    <a className={active("/shop")?"active":""} href="/shop">Shop</a>
    <a className={active("/account")||active("/login")?"active":""} href={accountHref}>{signedIn?"My Account":"Sign in"}</a>
   </nav>
  </div>
  <nav className="mobile-app-nav" aria-label="Mobile app navigation">
   <a className={active("/")?"active":""} href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></svg><span>Home</span></a>
   <a className={active("/book")||active("/payg")?"active":""} href="/book"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h2M8 18h3"/></svg><span>Book</span></a>
   <a className={active("/bootcamps")?"active":""} href="/bootcamps"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9v6m3-9v12m3-9v6m6-6v6m3-9v12m3-9v6M3 12h18"/></svg><span>Classes</span></a>
   <a className={active("/shop")?"active":""} href="/shop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8h12l-1 13H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg><span>Shop</span></a>
   <a className={active("/account")||active("/login")?"active":""} href={accountHref}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg><span>{signedIn?"Account":"Sign in"}</span></a>
  </nav>
 </div>
}