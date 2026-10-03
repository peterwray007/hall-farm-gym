import {accessCodeEmail} from "./gym-access";
const FROM="The Hall Farm Gym <bookings@hallfarmgym.com>";
export async function sendEmail(to:string,subject:string,html:string){
 const key=process.env.RESEND_API_KEY;
 if(!key||!to)return {ok:false,skipped:!key,error:!key?"Email service not configured":"No recipient"};
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[to],subject,html})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j?.message||"Email could not be sent");
 return {ok:true,id:j?.id};
}
export function bookingEmail(kind:string,startsAt:string,partySize:number,extra="",includeAccessCode=true){
 const d=new Date(startsAt);
 const date=d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/London"});
 const time=d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"});
 const payment=kind==="member"?"1 member credit":kind==="member_guest"?"1 gym credit + paid guest add-on":`£${(12.5+5*Math.max(0,partySize-1)).toFixed(2)} PAYG`;
 return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1 style="font-family:Georgia,serif">Your gym session is booked.</h1><p><strong>${date}</strong><br><strong>${time}</strong><br>${partySize} ${partySize===1?"person":"people"} · private gym</p><p>${payment}</p><p>The shower is available during your booked 50 minutes. Please allow time to shower, get changed and leave before the session ends.</p><p>Please read and acknowledge the <a href="https://www.hallfarmgym.com/induction">online gym safety instructions</a> before training. An in-person induction is optional; request a walkthrough if you are unfamiliar with any equipment.</p>${includeAccessCode?accessCodeEmail():"<p><strong>Gym access:</strong> Your guest needs to complete their health and safety registration before we can release your entry code.</p>"}${extra}<p>Everyone attending must complete their required safety information. Anyone under 18 must be accompanied and supervised by an adult aged 18 or over throughout their visit.</p><p>You can view or cancel your booking from <a href="https://www.hallfarmgym.com/account">My Account</a>.</p><p>The Hall Farm Gym</p></div>`;
}
export function cancellationEmail(startsAt:string,message:string){
 const d=new Date(startsAt);
 return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1 style="font-family:Georgia,serif">Your booking has been cancelled.</h1><p><strong>${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"Europe/London"})}</strong> at <strong>${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}</strong></p><p>${message}</p><p>The Hall Farm Gym</p></div>`;
}