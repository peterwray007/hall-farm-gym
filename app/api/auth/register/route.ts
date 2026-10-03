import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(){return NextResponse.json({error:"Registration now uses the secure email-verification flow."},{status:410})}
