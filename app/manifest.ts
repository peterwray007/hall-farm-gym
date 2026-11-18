import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{
 return {
  id:"/",
  name:"The Hall Farm Gym",
  short_name:"Hall Farm Gym",
  description:"Pay for drinks, snacks and WrayFitness clothing at Hall Farm Gym.",
  start_url:"/shop",
  scope:"/",
  display:"standalone",
  background_color:"#18201c",
  theme_color:"#18201c",
  orientation:"portrait-primary",
  icons:[
   {src:"/icon-192.png?v=2",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icon-512.png?v=2",sizes:"512x512",type:"image/png",purpose:"any"},
   {src:"/icon-512.png?v=2",sizes:"512x512",type:"image/png",purpose:"maskable"}
  ]
 }
}
