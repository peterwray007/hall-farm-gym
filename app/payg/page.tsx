"use client";
import {useEffect,useState} from "react";
const questions:[string,string][]=[
 ["heart_condition","Has a doctor advised you to exercise only under medical supervision, or do you have a heart condition?"],
 ["chest_pain","Do you experience chest pain during exercise or at rest?"],
 ["dizziness","Do you experience dizziness, lose your balance or lose consciousness?"],
 ["medical_reason","Is there any other medical reason you should not exercise without professional advice?"]
];
export default function Payg(){
 const[slot,setSlot]=useState(""),[party,setParty]=useState(1),[settings,setSettings]=useState<{price:number,max:number}|null>(null);
 const[f,setF]=useState({name:"",email:"",phone:"",emergencyName:"",emergencyPhone:""});
 const[answers,setAnswers]=useState<Record<string,boolean>>({}),[healthConsent,setHealthConsent]=useState(false),[acceptTerms,setAcceptTerms]=useState(false),[induction,setInduction]=useState(false),[docs,setDocs]=useState<any[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{const u=new URLSearchParams(location.search);setSlot(u.get("startsAt")||"");setParty(Number(u.get("partySize")||1));fetch("/api/induction").then(r=>r.json()).then(j=>setDocs(j.documents||[])).catch(()=>{});fetch("/api/payg/details").then(r=>r.json()).then(x=>setSettings(x)).catch(()=>{})},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setMsg("");
  if(questions.some(([k])=>typeof answers[k]!=="boolean")||!healthConsent||!acceptTerms||!induction){setMsg("Please answer all health questions and complete the induction and consent boxes.");return}
  setBusy(true);
  try{
   const r=await fetch("/api/payg/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,answers,healthConsent,acceptTerms,inductionAccepted:induction,startsAt:slot,partySize:party})});
   const j=await r.json();if(!r.ok||!j.url){setMsg(j.error||"Unable to start payment.");setBusy(false);return}
   location.href=j.url;
  }catch(e){setMsg("Something went wrong. Please try again.");setBusy(false)}
 }
 const when=slot&&Number.isFinite(new Date(slot).getTime())?new Date(slot):null;
 return <main><section className="policy payg-form">
  <p className="eyebrow">PAY AS YOU GO · NO ACCOUNT NEEDED</p><h2>Nearly ready to train.</h2>
  <p>Just fill in your details and a short health questionnaire, then pay securely. We’ll email your booking confirmation and a private link if you need to cancel.</p>
  {when?<article className="notice"><strong>{when.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"Europe/London"})} at {when.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}</strong><p>{party} {party===1?"person":"people"} · 50-minute private session · Shower available within your booked 50 minutes {settings?.price?"· £"+(settings.price/100).toFixed(2):""}</p><a href="/book">Change your session</a></article>:<p role="alert">Choose a session from <a href="/book">the booking page</a> first.</p>}
  <form onSubmit={submit}><h3>Your details</h3>
   <div className="formgrid">{([["name","Full name","text"],["email","Email address","email"],["phone","Mobile number","tel"],["emergencyName","Emergency contact name","text"],["emergencyPhone","Emergency contact number","tel"]] as const).map(([k,placeholder,type])=><input key={k} type={type} required aria-label={placeholder} placeholder={placeholder} value={f[k]} onChange={e=>setF(x=>({...x,[k]:e.target.value}))}/>)}</div>
   <h3>Quick health questionnaire</h3>
   <p>Please answer each question before you train. If an answer needs a health review, we’ll get in touch before you use the gym.</p>
   {questions.map(([k,q])=><label key={k} className="question"><span>{q}</span><select aria-label={q} value={answers[k]===undefined?"":String(answers[k])} required onChange={e=>setAnswers(x=>({...x,[k]:e.target.value==="true"}))}><option value="" disabled>Choose…</option><option value="false">No</option><option value="true">Yes</option></select></label>)}
   <label className="check"><input type="checkbox" required checked={healthConsent} onChange={e=>setHealthConsent(e.target.checked)}/>I consent to The Hall Farm Gym using my health answers to assess my safety and eligibility to train.</label>
   <h3>Self-guided gym induction</h3>{docs.length?docs.map(d=><article className="legal" key={d.id}><strong>{d.title}</strong><p style={{whiteSpace:"pre-line"}}>{d.body}</p><small>Version {d.version}</small></article>):<p>Loading gym safety instructions…</p>}<label className="check"><input type="checkbox" required disabled={!docs.length} checked={induction} onChange={e=>setInduction(e.target.checked)}/> I have read and understood the self-guided induction, will follow the safety rules and will ask for a personal walkthrough before using unfamiliar equipment.</label><p className="formhint">Need a personal induction? <a href="/contact">Contact WrayFitness</a> before your session.</p><label className="check"><input type="checkbox" required checked={acceptTerms} onChange={e=>setAcceptTerms(e.target.checked)}/>I agree to the <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">gym terms and cancellation policy</a> and have read the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">privacy policy</a>.</label>
   {party>1&&<p className="notice">Everyone in your group must complete the required health and safety registration before training. Please contact us for any additional guests.</p>}
   {msg&&<p role="alert" className="bookingmessage">{msg}</p>}
   <button type="submit" className="primary" disabled={busy||!when}>{busy?"Opening secure payment…":"Continue to secure payment"}</button>
  </form>
 </section></main>
}
