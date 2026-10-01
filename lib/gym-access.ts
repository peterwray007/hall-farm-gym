import "server-only";
export function gymAccessCode(){
 const value=process.env.GYM_ACCESS_CODE?.trim()||"";
 return /^[0-9]{4}$/.test(value)?value:null;
}
export function accessCodeEmail(){
 const code=gymAccessCode();
 return code?`<div style="border:1px solid #b0c2b1;border-radius:8px;background:#eef4ed;padding:18px 22px;margin:22px 0"><p style="margin:0 0 8px;font-weight:bold">Your gym access code</p><p style="font-size:32px;letter-spacing:7px;font-weight:bold;margin:0 0 10px">${code}</p><p style="margin:0;font-size:13px">Enter this code on the key box when you arrive. Please keep it private and use it only for your booked session.</p></div>`:`<p><strong>Gym access:</strong> Your access code will be provided before your session once the key box is ready. If your booking is soon, please contact WrayFitness.</p>`;
}
