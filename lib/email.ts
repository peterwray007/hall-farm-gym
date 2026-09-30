const FROM="The Hall Farm Gym <bookings@hallfarmgym.com>";
export async function sendEmail(to:string,subject:string,html:string){
 const key=process.env.RESEND_API_KEY;
 if(!key||!to)return {ok:false,skipped:!key,error:!key?"Email service not configured":"No recipient"};
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[to],subject,html})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j?.message||"Email could not be sent");
 return {ok:true,id:j?.id};
}
export function bookingEmail(kind:string,startsAt:string,partySize:number,extra=""){
 const d=new Date(startsAt);
 const date=d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/London"});
 const time=d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"});
 const payment=kind==="member"?"1 member credit":kind==="member_guest"?"1 member credit + £5 guest add-on":"£12.50 PAYG";
 return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1 style="font-family:Georgia,serif">Your gym session is booked.</h1><p><strong>${date}</strong><br><strong>${time}</strong><br>${partySize} ${partySize===1?"person":"people"} · private gym</p><p>${payment}</p>${extra}<p>You can view or cancel your booking from <a href="https://www.hallfarmgym.com/account">My Account</a>.</p><p>The Hall Farm Gym</p></div>`;
}
export function cancellationEmail(startsAt:string,message:string){
 const d=new Date(startsAt);
 return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18201c"><h1 style="font-family:Georgia,serif">Your booking has been cancelled.</h1><p><strong>${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"Europe/London"})}</strong> at <strong>${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}</strong></p><p>${message}</p><p>The Hall Farm Gym</p></div>`;
}