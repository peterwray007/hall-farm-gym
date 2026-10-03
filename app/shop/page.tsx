"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../lib/supabase";

type Category={id:string;slug:string;name:string;sort_order:number};
type Product={id:string;category_id:string;slug:string;name:string;price_pence:number;sizes:string[];sort_order:number};
type CartLine={productId:string;size:string|null;qty:number};

const lineKey=(productId:string,size?:string|null)=>productId+"::"+(size||"");
const quantities=Array.from({length:11},(_,i)=>i);

export default function Shop(){
 const[categories,setCategories]=useState<Category[]>([]),[products,setProducts]=useState<Product[]>([]),[cart,setCart]=useState<Record<string,CartLine>>({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");
 useEffect(()=>{(async()=>{const sb=supabase();const[{data:c},{data:p}]=await Promise.all([
  sb.from("shop_categories").select("id,slug,name,sort_order").order("sort_order"),
  sb.from("shop_products").select("id,category_id,slug,name,price_pence,sizes,sort_order").order("sort_order")
 ]);setCategories((c||[]) as Category[]);setProducts((p||[]) as Product[]);setLoading(false)})()},[]);

 function setQty(p:Product,size:string|null,qty:number){
  const k=lineKey(p.id,size);
  setCart(x=>{const n={...x};if(qty<=0)delete n[k];else n[k]={productId:p.id,size,qty};return n});
 }
 const selected=useMemo(()=>Object.values(cart).filter(x=>x.qty>0),[cart]);
 const byId=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);
 const total=selected.reduce((sum,line)=>sum+(byId.get(line.productId)?.price_pence||0)*line.qty,0);
 const itemCount=selected.reduce((n,line)=>n+line.qty,0);

 async function checkout(){
  if(!selected.length)return;
  setBusy(true);setMsg("");
  const items=selected.map(line=>({id:line.productId,quantity:line.qty,size:line.size}));
  const r=await fetch("/api/shop/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});
  const j=await r.json();if(j.url)location.href=j.url;else{setMsg(j.error||"Could not start checkout.");setBusy(false)}
 }

 return <main><section className="shop-page"><p className="eyebrow">HALL FARM GYM SHOP</p><h1>Picked something up?</h1><p className="shop-intro">Choose exactly what you’ve taken from the fridge or shop rail, including quantity and clothing size, then pay securely before you leave. No account needed.</p>
 {loading&&<p className="emptybooking">Loading the shop…</p>}
 {!loading&&categories.map(cat=><section className="shop-category" key={cat.id}>
  <div className="shop-category-head"><h2>{cat.name}</h2><span>{cat.slug==="fridge"?"Grab it, scan it, pay here.":"Choose the size and quantity you’ve taken."}</span></div>
  <div className="shop-grid">{products.filter(p=>p.category_id===cat.id).map(p=><article className="shop-product" key={p.id}>
   <div><h3>{p.name}</h3><strong>£{(p.price_pence/100).toFixed(2)}</strong></div>
   {p.sizes?.length?<div className="shop-size-list">{p.sizes.map(size=>{const qty=cart[lineKey(p.id,size)]?.qty||0;return <label className="shop-size-row" key={size}><span>Size <strong>{size}</strong></span><span className="shop-qty-label">Qty <select value={qty} onChange={e=>setQty(p,size,Number(e.target.value))}>{quantities.map(n=><option key={n} value={n}>{n}</option>)}</select></span></label>})}</div>:<label className="shop-single-qty"><span>Quantity</span><select value={cart[lineKey(p.id)]?.qty||0} onChange={e=>setQty(p,null,Number(e.target.value))}>{quantities.map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
  </article>)}</div>
 </section>)}
 <div className="shop-cart"><div><span>{itemCount} {itemCount===1?"item":"items"}</span><strong>£{(total/100).toFixed(2)}</strong></div><button className="primary" disabled={!selected.length||busy} onClick={checkout}>{busy?"Opening checkout…":"Pay now"}</button>{msg&&<p className="bookingmessage">{msg}</p>}</div>
 </section></main>
}