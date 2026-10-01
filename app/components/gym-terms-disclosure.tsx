"use client";
type Doc={id:string;document_type:string;title:string;body:string;version:string};
const summaries:Record<string,string>={
 participation_waiver:"Exercise carries risks. Please give accurate health information, train within your abilities, use equipment safely and stop if you feel unwell. Your legal rights remain protected.",
 privacy:"We use your contact, booking, membership and necessary health information to run the gym and support safety. Stripe handles your payment details. You can contact us about your personal information.",
 gym_rules:"Only registered people on your booking may attend (maximum five). Use equipment safely, tidy up, report faults and follow emergency instructions. Leave within your booked session; the 12-hour cancellation policy applies."
};
export default function GymTermsDisclosure({doc}:{doc:Doc}){
 return <article className="legal induction-summary">
  <strong>{doc.title}</strong>
  <p>{summaries[doc.document_type]||"Please review this document before accepting the gym terms."}</p>
  <details className="induction-expand"><summary>Read full details</summary><p style={{whiteSpace:"pre-line"}}>{doc.body}</p></details>
  <small>Version {doc.version}</small>
 </article>
}
