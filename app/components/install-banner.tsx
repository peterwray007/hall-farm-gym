"use client";
import {useEffect,useState} from "react";
export default function InstallBanner(){
 const[show,setShow]=useState(false);
 useEffect(()=>{
  const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  const update=()=>setShow(!standalone()&&localStorage.getItem("hallFarmAppInstalled")!=="yes"&&window.location.pathname!=="/install");
  update();
  const done=()=>{localStorage.setItem("hallFarmAppInstalled","yes");setShow(false)};
  window.addEventListener("appinstalled",done);
  window.addEventListener("hallfarm-app-installed",done);
  window.addEventListener("pageshow",update);
  return()=>{window.removeEventListener("appinstalled",done);window.removeEventListener("hallfarm-app-installed",done);window.removeEventListener("pageshow",update)};
 },[]);
 if(!show)return null;
 return <aside className="get-app-banner" aria-label="Install the Hall Farm Gym app">
  <div className="get-app-banner-inner">
   <img src="/hall-farm-gym-logo.webp" width="56" height="56" alt="" className="get-app-banner-logo"/>
   <div className="get-app-banner-copy"><strong>Get the Hall Farm Gym app</strong><span>Book sessions and see your credits straight from your home screen.</span></div>
   <a className="get-app-banner-button" href="/install">Get the app ↗</a>
   <button className="get-app-banner-dismiss" type="button" onClick={()=>{localStorage.setItem("hallFarmAppInstalled","yes");setShow(false)}} aria-label="I have installed the app. Hide this message" title="Already installed? Hide this message">×</button>
  </div>
 </aside>
}
