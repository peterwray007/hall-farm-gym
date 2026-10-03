"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

const questions:[string,string][]=[
 ["heart_condition","Has a doctor ever said you have a heart condition or should only exercise under medical advice?"],
 ["chest_pain","Do you get chest pain during physical activity or at rest?"],
 ["dizziness","Do you lose balance because of dizziness or ever lose consciousness?"],
 ["medical_reason","Do you know of any other medical reason you should not exercise without professional advice?"]
];

export default function HealthDetails(){
 const[answers,setAnswers]=useState<Record<string,boolean>>({}),[consent,setConsent]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const sb=supabase(),{data:{user}}=await sb.auth.getUser();if(!user){location.replace("/login");return}
 const{data,error}=await sb.from("health_declarations").select("answers,consent_given,submitted_at").order("submitted_at",{ascending:false}).limit(1).maybeSingle();
 if(!error&&data?.answers)setAnswers(data.answers);if(data?.consent_given)setConsent(true);setLoading(false)})()},[]);
 async function save(){if(questions.some(([k])=>typeof answers[k]!=="boolean")){setMsg("Please answer every health question.");return}if(!consent){setMsg("Please confirm that we can use this information for gym safety and eligibility.");return}
 setBusy(true);setMsg("");const sb=supabase();const{data,error}=await sb.rpc("update_my_health_answers",{p_answers:answers,p_health_consent:consent});
 if(error){setMsg(error.message);setBusy(false);return}
 try{const{data:{session}}=await sb.auth.getSession();if(session){await fetch("/api/parq/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({kind:"member"})})}}catch{}
 setMsg(data===true?"Thanks — your health information has been updated. One or more answers need review before you train.":"Thanks — your health information has been updated.");setBusy(false)}
 if(loading)return <main><section className="membership-page"><p>Loading your health information…</p></section></main>;
 return <main><section className="membership-page"><p className="eyebrow">MY ACCOUNT</p><h1>Health information</h1><p className="membership-intro">You only need to complete the full gym set-up once. Come back here if anything changes with your health, medication or medical advice that could affect exercise.</p>
 <article className="notice"><strong>Please keep this up to date.</strong><p>If a change means one of these answers becomes Yes, your account may need a quick review before your next session.</p></article>
 {questions.map(([k,q])=><label className="question" key={k}><span>{q}</span><select value={answers[k]===undefined?"":String(answers[k])} onChange={e=>setAnswers(x=>({...x,[k]:e.target.value==="true"}))}><option value="" disabled>Choose…</option><option value="false">No</option><option value="true">Yes</option></select></label>)}
 <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I consent to The Hall Farm Gym using this health information to assess gym safety and eligibility.</label>
 {msg&&<p className="bookingmessage" role="status">{msg}</p>}
 <div className="actions"><button className="primary" disabled={busy} onClick={save}>{busy?"Saving…":"Save health information"}</button><a className="secondary" href="/account">Back to My Account</a></div>
 </section></main>
}