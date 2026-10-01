"use client";
import {useEffect,useState} from "react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function AppInstall({compact=false}:{compact?:boolean}){
 const[prompt,setPrompt]=useState<InstallEvent|null>(null);
 const[installed,setInstalled]=useState(false);
 const[apple,setApple]=useState(false);
 useEffect(()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(e=>console.error("Gym app registration",e));
  const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  setInstalled(standalone);
  setApple(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  const listener=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent)};
  window.addEventListener("beforeinstallprompt",listener);
  const done=()=>{setInstalled(true);setPrompt(null)};
  window.addEventListener("appinstalled",done);
  return()=>{window.removeEventListener("beforeinstallprompt",listener);window.removeEventListener("appinstalled",done)};
 },[]);
 async function install(){if(!prompt)return;await prompt.prompt();const response=await prompt.userChoice;if(response.outcome==="accepted")setPrompt(null)}
 if(installed)return compact?null:<p className="formhint">You are using the installed Hall Farm Gym app. Your bookings and credits stay up to date whenever you're online.</p>;
 return <div className={compact?"app-install-compact":"app-install-panel"}>
  {prompt?<button className="secondary" onClick={install}>Install Hall Farm Gym app</button>:apple?<p>{compact?"On iPhone: tap Safari Share → Add to Home Screen.":"On iPhone or iPad: open this site in Safari, tap Share (the square with an arrow), then choose Add to Home Screen and tap Add."}</p>:<p>{compact?"Open your browser menu and choose Install app or Add to Home screen.":"On Android, open the browser menu and choose Install app or Add to Home screen. On desktop, look for Install in your browser's address bar or menu."}</p>}
 </div>
}
