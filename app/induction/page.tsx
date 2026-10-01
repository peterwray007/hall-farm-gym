import {adminClient} from "../../lib/supabase-server";
export const dynamic="force-dynamic";
export const metadata={title:"Self-guided gym induction | Hall Farm Gym",description:"Read the Hall Farm Gym induction and safety instructions before your first visit."};
export default async function Induction(){
 const {data:docs,error}=await adminClient().from("legal_documents").select("id,title,version,body").eq("document_type","gym_induction").eq("active",true).order("created_at",{ascending:false}).limit(1);
 const d=docs?.[0];
 return <main><section className="policy"><p className="eyebrow">BEFORE YOUR FIRST VISIT</p><h2>Gym induction & safety</h2><p>Read these instructions before using The Hall Farm Gym. An in-person tour is optional. If you are comfortable using the equipment, you can opt out and train independently after reading and acknowledging these online safety instructions. If you would prefer a walkthrough or are unsure how to use any equipment, arrange a personal induction before using it.</p>
 {error||!d?<p role="alert">The induction is temporarily unavailable. Please contact WrayFitness before training.</p>:<article className="legal"><h3>{d.title}</h3><p style={{whiteSpace:"pre-line"}}>{d.body}</p><small>Version {d.version}</small></article>}
 <p><strong>Completing this page does not register your acceptance.</strong> New members and PAYG customers must tick the online safety acknowledgement in their registration or booking form. This does not mean that you must attend an in-person induction.</p><p><a className="primary" href="/contact">Request an in-person induction</a> <a className="secondary" href="/book">Book the gym</a></p></section></main>
}
