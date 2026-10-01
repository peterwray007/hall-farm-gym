"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../lib/supabase";
type Slot={starts_at:string;ends_at:string;is_available:boolean};
const londonDay=(v:string)=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));const get=(x:string)=>p.find(t=>t.type===x)?.value||"";return get("year")+"-"+get("month")+"-"+get("day")};
const time=(v:string)=>new Date(v).toLocaleTimeString("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"});
const dayLabel=(v:string)=>new Date(v).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short"});
export default function AdminBulkCalendar(){
 const[slots,setSlots]=useState<Slot[]>([]),[loading,setLoading]=useState(true),[selectedDay,setSelectedDay]=useState(""),[selected,setSelected]=useState<string[]>([]),[purpose,setPurpose]=useState("pt"),[note,setNote]=useState("Personal training"),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function refresh(){
  setLoading(true);
  try{
   const sb=supabase();const from=new Date();const to=new Date(from.getTime()+31*86400000);
   const{data,error}=await sb.rpc("admin_available_slots",{p_from:from.toISOString(),p_to:to.toISOString()});
   if(error)throw error;
   const next=(data||[]) as Slot[];
   setSlots(next);
   setSelectedDay(previous=>previous&&next.some(s=>londonDay(s.starts_at)===previous)?previous:next.length?londonDay(next[0].starts_at):"");
  }catch(e:any){setNotice(e.message||"Unable to load the admin calendar.")}finally{setLoading(false)}
 }
 useEffect(()=>{refresh()},[]);
 const days=useMemo(()=>[...new Set(slots.map(s=>londonDay(s.starts_at)))], [slots]);
 const visible=slots.filter(s=>londonDay(s.starts_at)===selectedDay);
 function toggle(id:string){setNotice("");setSelected(prev=>prev.includes(id)?prev.filter(t=>t!==id):prev.length>=100?prev:[...prev,id].sort())}
 function setType(v:string){setPurpose(v);setNote(v==="pt"?"Personal training":v==="maintenance"?"Maintenance":"Gym reserved")}
 async function confirm(){
  if(!selected.length||busy)return;
  setBusy(true);setNotice("");
  const {data,error}=await supabase().rpc("admin_block_slots",{p_starts_at:selected,p_kind:purpose,p_note:note});
  if(error){setNotice(error.message);await refresh()}else{setSelected([]);await refresh();setNotice(`${data} ${data===1?"session":"sessions"} reserved. They are now unavailable to customers.`);window.dispatchEvent(new Event("hallfarm-admin-bookings-updated"))}
  setBusy(false);
 }
 return <div className="admin-bulk notice">
  <p className="eyebrow">QUICK RESERVATIONS · NEXT 30 DAYS</p>
  <h3>Tap the sessions you need</h3>
  <p>Choose a day, tap as many available times as you need, then confirm them all together. Already-booked or held sessions cannot be selected. Customers' booking windows stay unchanged.</p>
  <div className="admin-bulk-type"><label>Reserve for <select aria-label="Reservation type" value={purpose} onChange={e=>setType(e.target.value)}><option value="pt">Personal training</option><option value="admin_block">Close gym / other (not a bookable class)</option><option value="maintenance">Maintenance</option></select></label><label>Note <input aria-label="Reservation note" maxLength={250} value={note} onChange={e=>setNote(e.target.value)}/></label></div>
  {loading&&<p>Loading the next 30 days…</p>}
  {!loading&&<><div className="admin-bulk-days" aria-label="Choose a date">{days.map(d=><button key={d} className={d===selectedDay?"admin-day active":"admin-day"} onClick={()=>setSelectedDay(d)} type="button"><strong>{dayLabel(slots.find(s=>londonDay(s.starts_at)===d)!.starts_at)}</strong><small>{slots.filter(s=>londonDay(s.starts_at)===d&&s.is_available).length} free</small></button>)}</div>
  <div className="admin-bulk-times">{visible.map(s=>{const picked=selected.includes(s.starts_at);return <button key={s.starts_at} type="button" disabled={!s.is_available} aria-pressed={picked} onClick={()=>toggle(s.starts_at)} className={picked?"admin-time selected":s.is_available?"admin-time":"admin-time unavailable"}><strong>{time(s.starts_at)}</strong><small>{picked?"✓ Selected":s.is_available?"Available":"Unavailable"}</small></button>})}</div></>}
  <div className="admin-bulk-confirm"><strong>{selected.length} {selected.length===1?"session":"sessions"} selected</strong><button type="button" className="secondary" onClick={()=>setSelected([])} disabled={!selected.length||busy}>Clear</button><button type="button" className="primary" disabled={!selected.length||busy} onClick={confirm}>{busy?"Reserving…":`Confirm ${selected.length||""} ${selected.length===1?"session":"sessions"}`}</button></div>
  {selected.length>0&&<details className="admin-bulk-review"><summary>Review selected dates and times</summary><p>{selected.map(t=>dayLabel(t)+" at "+time(t)).join(" · ")}</p></details>}
  {notice&&<p className="admin-bulk-status" role="status">{notice}</p>}
 </div>
}
