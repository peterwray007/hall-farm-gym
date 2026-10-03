"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

export default function PersonalDetails(){
 const[f,setF]=useState({name:"",phone:"",dob:"",emergencyName:"",emergencyPhone:""}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const sb=supabase(),{data:{user}}=await sb.auth.getUser();if(!user){location.replace("/login");return}
 const{data,error}=await sb.from("profiles").select("full_name,phone,date_of_birth,emergency_name,emergency_phone").eq("id",user.id).single();
 if(!error&&data)setF({name:data.full_name||"",phone:data.phone||"",dob:data.date_of_birth||"",emergencyName:data.emergency_name||"",emergencyPhone:data.emergency_phone||""});
 setLoading(false)})()},[]);
 async function save(){
  const normName=(s:string)=>s.trim().toLowerCase().replace(/\s+/g," ");
  const normPhone=(s:string)=>s.replace(/\D/g,"");
  if(!f.name.trim()||!f.phone.trim()||!f.dob||!f.emergencyName.trim()||!f.emergencyPhone.trim()){setMsg("Please complete every field.");return}
  if(normName(f.name)===normName(f.emergencyName)){setMsg("Your emergency contact must be someone other than you.");return}
  if(normPhone(f.phone)===normPhone(f.emergencyPhone)){setMsg("Your emergency contact phone number must be different from your own.");return}
  setSaving(true);setMsg("");
  const{error}=await supabase().rpc("update_my_profile_details",{p_full_name:f.name,p_phone:f.phone,p_date_of_birth:f.dob,p_emergency_name:f.emergencyName,p_emergency_phone:f.emergencyPhone});
  setMsg(error?error.message:"Your personal and emergency details have been updated.");setSaving(false)
 }
 if(loading)return <main><section className="membership-page"><p>Loading your details…</p></section></main>;
 return <main><section className="membership-page"><p className="eyebrow">MY ACCOUNT</p><h1>Personal &amp; emergency details</h1><p className="membership-intro">Keep these details up to date so we can contact you, and someone else, if there is ever an emergency.</p>
 <div className="formgrid"><input autoComplete="name" placeholder="Full name" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input type="tel" inputMode="tel" autoComplete="tel" placeholder="Mobile number" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/><label className="field-label"><span>Date of birth</span><input type="date" autoComplete="bday" value={f.dob} onChange={e=>setF({...f,dob:e.target.value})}/></label><div></div><input autoComplete="off" placeholder="Emergency contact name (someone other than you)" value={f.emergencyName} onChange={e=>setF({...f,emergencyName:e.target.value})}/><input type="tel" inputMode="tel" autoComplete="off" placeholder="Emergency contact phone" value={f.emergencyPhone} onChange={e=>setF({...f,emergencyPhone:e.target.value})}/></div>
 <p className="formhint">Your emergency contact must be someone other than you and must have a different phone number from your own.</p>{msg&&<p className="bookingmessage" role="status">{msg}</p>}
 <div className="actions"><button className="primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save details"}</button><a className="secondary" href="/account">Back to My Account</a></div>
 </section></main>
}