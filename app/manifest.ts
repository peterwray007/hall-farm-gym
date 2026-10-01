import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{
 return {
  id:"/",
  name:"The Hall Farm Gym",
  short_name:"Hall Farm Gym",
  description:"Your private gym at Hall Farm. Book sessions, use membership credits and view your entry code.",
  start_url:"/account",
  scope:"/",
  display:"standalone",
  background_color:"#18201c",
  theme_color:"#18201c",
  orientation:"portrait-primary",
  icons:[
   {src:"/icons/192",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icons/512",sizes:"512x512",type:"image/png",purpose:"any"},
   {src:"/icons/512",sizes:"512x512",type:"image/png",purpose:"maskable"}
  ]
 }
}
