import {readFile,mkdir} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const out=path.join(process.cwd(),"public");
const source=path.join(out,"hall-farm-gym-logo.webp");
await mkdir(out,{recursive:true});
const logo=await readFile(source);
for(const [name,size] of [["apple-touch-icon.png",180],["icon-192.png",192],["icon-512.png",512]]){
 const inner=Math.floor(size*.88);
 const image=await sharp(logo).resize(inner,inner,{fit:"contain",background:"#18201c"}).png().toBuffer();
 await sharp({create:{width:size,height:size,channels:4,background:"#18201c"}})
 .composite([{input:image,gravity:"centre"}]).png().toFile(path.join(out,name));
}
