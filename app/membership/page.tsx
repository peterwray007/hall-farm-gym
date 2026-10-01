"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../lib/supabase";

type Plan={code:string;name:string;price_pence:number;monthly_bookings:number;named_members:number;guest_passes:number};
export default function MembershipPage(){
 const[plans,setPlans]=useState<Plan[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{supabase().from("membership_plans").select("code,name,price_pence,monthly_bookings,named_members,guest_passes").eq("active",true).order("price_pence").then(({data,error:e})=>{setPlans(data||[]);if(e)setError("Membership plans aren't available right now. Please try again shortly.");setLoading(false)})},[]);
 return <main><section className="membership-page"><p className="eyebrow">JOIN THE HALL FARM GYM</p><h1>Choose your membership.</h1><p className="membership-intro">Your own private gym, without the crowds. Choose whether you'd like to train on your own, with a partner or as a group of three.</p>
 {loading&&<p>Loading memberships…</p>}{error&&<p role="alert">{error}</p>}
 <div className="cards membership-cards">{plans.map(p=><article key={p.code}><h3>{p.name}</h3><div className="price">£{(p.price_pence/100).toFixed(p.price_pence%100?2:0)}<small>/month</small></div><p><strong>{p.monthly_bookings} private gym bookings each month</strong></p><p>{p.named_members===1?"The whole gym to yourself.":p.named_members===2?"You and your partner can train together during each booked session.":"All three named members can train together during each booked session."}</p><p>Each visit uses one booking, however many named members train together.</p><a className="primary membership-cta" href={`/join?plan=${encodeURIComponent(p.code)}`}>Choose {p.name} membership</a></article>)}</div>
 <p className="membership-note">Each booking reserves the whole gym for your group. You can add one extra non-member to a session for £5. <a href="/terms-of-service">See our membership terms</a>.</p>
 <p className="membership-note">Not ready to join? <a href="/book">Book a PAYG session instead.</a></p></section></main>
}
