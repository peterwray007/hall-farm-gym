import {ImageResponse} from "next/og";
export function gymIcon(size:number){
 return new ImageResponse(
  <div style={{height:"100%",width:"100%",background:"#18251d",display:"flex",alignItems:"center",justifyContent:"center",padding:size*.12}}>
   <div style={{width:"100%",height:"100%",borderRadius:"50%",border:`${Math.max(3,Math.round(size*.025))}px solid #a0b99e`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#21362a",color:"#f3efe6"}}>
    <div style={{fontSize:size*.29,fontWeight:700,letterSpacing:"-0.07em",lineHeight:1.1,paddingRight:size*.022}}>HF</div>
    <div style={{width:"61%",height:Math.max(2,size*.009),background:"#a0b99e",marginTop:size*.008,marginBottom:size*.026}}/>
    <div style={{fontSize:size*.082,fontWeight:700,letterSpacing:".16em"}}>GYM</div>
   </div>
  </div>,
  {width:size,height:size}
 );
}
