"use client";
type InductionDoc={id:string;title:string;body:string;version:string};
export default function InductionDisclosure({doc}:{doc:InductionDoc}){
 return <article className="legal induction-summary">
  <strong>{doc.title}</strong>
  <p>Use only equipment you know how to operate safely. Check equipment before use, keep exits clear, tidy up afterwards and follow the gym's emergency instructions. Only your booked group may attend, and you must finish training, showering and changing within your 50-minute session. If you feel unwell, stop training. You can opt out of an in-person induction if you are confident using the equipment. If you need help, request a walkthrough before using unfamiliar equipment.</p>
  <details className="induction-expand"><summary>Read full induction</summary><p style={{whiteSpace:"pre-line"}}>{doc.body}</p></details>
  <small>Version {doc.version} · <a href="/induction" target="_blank" rel="noopener noreferrer">Open full induction in a separate tab</a></small>
 </article>
}
