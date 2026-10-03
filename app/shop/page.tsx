"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../lib/supabase";

type Category={id:string;slug:string;name:string;sort_order:number};
type Product={id:string;category_id:string;slug:string;name:string;price_pence:number;sizes:string[];sort_order:number};
type CartLine={qty:number;size?:string};

export default function Shop(){
 const[categories,setCategories]=useState<Category[]>([]),[products,setProducts]=useState<Product[]>([]),[cart,setCart]=useState<Record<string,CartLine>>({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const sb=supabase();const[{data:c},{data:p}]=await Promise.all([
  sb.from("shop_categories").select("id,slug,name,sort_order").order("sort_order"),
  sb.from("shop_products").select("id,category_id,slug,name,price_pence,sizes,sort_order").order("sort_order")
 ]);setCategories((c||[]) as Category[]);setProducts((p||[]) as Product[]);setLoading(false)})()},[]);
 const selected=useMemo(()=>products.filter(p=>(cart[p.id]?.qty||0)>0),[products,cart]);
 const total=selected.reduce((sum,p)=>sum+(cart[p.id]?.qty||0)*p.price_pence,0);
 function add(p:Product){setCart(x=>({...x,[p.id]:{qty:(x[p.id]?.qty||0)+1,size:x[p.id]?.size||(p.sizes?.[0]||undefined)}}))}
 function remove(p:Product){setCart(x=>{const q=(x[p.id]?.qty||0)-1;const n={...x};if(q<=0)delete n[p.id];else n[p.id]={...n[p.id],qty:q};return n})}
 async function checkout(){
  if(!selected.length)return;
  setBusy(true);setMsg("");
  const items=selected.map(p=>({id:p.id,quantity:cart[p.id].qty,size:cart[p.id].size||null}));
  const r=await fetch("/api/shop/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});
  const j=await r.json();if(j.url)location.href=j.url;else{setMsg(j.error||"Could not start checkout.");setBusy(false)}
 }
 return <main><section className="shop-page"><p className="eyebrow">HALL FARM GYM SHOP</p><h1>Gym shop</h1><p className="shop-intro">Fancy a drink, snack or some WrayFitness kit? Choose what you’d like below and pay securely on your phone. No account needed.</p>
 {loading&&<p className="emptybooking">Loading the shop…</p>}{!loading&&categories.map(cat=><section className="shop-category" key={cat.id}><div className="shop-category-head"><h2>{cat.name}</h2><span>{cat.slug==="fridge"?"Drinks & snacks available in the gym.":"WrayFitness clothing available in the gym."}</span></div><div className="shop-grid">{products.filter(p=>p.category_id===cat.id).map(p=>{const line=cart[p.id],qty=line?.qty||0;return <article className="shop-product" key={p.id}><div><h3>{p.name}</h3><strong>£{(p.price_pence/100).toFixed(2)}</strong></div>{p.sizes?.length>0&&<label>Size<select value={line?.size||p.sizes[0]} onChange={e=>setCart(x=>({...x,[p.id]:{qty:Math.max(1,x[p.id]?.qty||1),size:e.target.value}}))}>{p.sizes.map(s=><option key={s}>{s}</option>)}</select></label>}<div className="shop-qty"><button className="secondary" onClick={()=>remove(p)} disabled={qty===0} aria-label={"Remove "+p.name}>−</button><span>{qty}</span><button className="primary" onClick={()=>add(p)} aria-label={"Add "+p.name}>+</button></div></article>})}</div></section>)}
 <div className="shop-cart"><div><span>{selected.reduce((n,p)=>n+(cart[p.id]?.qty||0),0)} items</span><strong>£{(total/100).toFixed(2)}</strong></div><button className="primary" disabled={!selected.length||busy} onClick={checkout}>{busy?"Opening checkout…":"Pay now"}</button>{msg&&<p className="bookingmessage">{msg}</p>}</div>
 </section></main>
}