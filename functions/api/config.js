import { json, errorResponse, requireMethod } from "../_lib/firebase.js";
const PAYMENT_CONFIG={network:"BNB SMART CHAIN || ETHEREUM MAIN CHAIN || BASE || ARBITRUM",wallet:"0xEd0705Eab4eD0579466FF7aFF6B3adB7131F1868",plans:{month:{label:"1 Month",months:1,amount:"$4.90"},three_months:{label:"3 Months",months:3,amount:"$12.9"},six_months:{label:"6 Months",months:6,amount:"$24.9"},year:{label:"1 Year",months:12,amount:"$42.9"}}};
export async function onRequest({request}) { try { requireMethod(request,"GET"); return json(PAYMENT_CONFIG); } catch(e) { return errorResponse(e); } }
