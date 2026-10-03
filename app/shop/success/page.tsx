"use client";
import {useEffect,useState} from "react";
export default function ShopSuccess(){
 const[data,setData]=useState<any>(null),[msg,setMsg]=useState("Checking payment…");
 useEffect(()=>{const id=new URLSearchParams(location.search).get("session_id")||"";fetch("/api/shop/confirmation?session_id="+encodeURIComponent(id),{cache:"no-store"}).then(r=>r.json()).then(x=>{setData(x);setMsg(x.error||"")}).catch(()=>setMsg("Could not confirm the payment."))},[]);
 return <main><section className="booking-success"><div className="success-icon">✓</div><p className="eyebrow">HALL FARM GYM SHOP</p><h1>{data?.paid?"Payment received":"Checking payment"}</h1>{msg&&<p className="success-intro">{msg}</p>}{data?.paid&&<><p className="success-intro">Thanks — your shop payment has gone through.</p><article className="success-details"><h2>Your purchase</h2>{data.items?.map((x:any,i:number)=><p key={i}>{x.quantity} × {x.description}</p>)}<p className="success-time">£{(data.amount_total/100).toFixed(2)}</p></article><div className="actions"><a className="primary" href="/shop">Back to shop</a><a className="secondary" href="/">Home</a></div></>}</section></main>
}