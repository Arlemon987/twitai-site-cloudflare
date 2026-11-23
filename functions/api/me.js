import {initFirestore,verifyFirebaseUser,getDoc,queryDocs,commitWrites,makeUpdate,json,errorResponse,requireMethod,iso,fieldTimestamp,activeSubscription} from "../_lib/firebase.js";
export async function onRequest({request,env}) { try {
 initFirestore(env); requireMethod(request,"GET"); const user=await verifyFirebaseUser(request,env);
 let doc=await getDoc(env,"users",user.uid); let data=doc.data;
 if(!doc.exists){ data={uid:user.uid,email:user.email,displayName:user.name,photoURL:user.picture,freeTweetsUsed:0,totalTweetsSubmitted:0,totalRepliesGenerated:0,plan:"free",planLabel:"Free",subscriptionStatus:"free",subscriptionStart:null,subscriptionExpiry:null}; await commitWrites(env,[makeUpdate("users",user.uid,data,{serverTimestamps:["createdAt","updatedAt"],exists:false})]); doc=await getDoc(env,"users",user.uid); data=doc.data||data; }
 const expiry=fieldTimestamp(data.subscriptionExpiry); const active=activeSubscription(data);
 if(data.subscriptionStatus==="active"&&expiry&&expiry.getTime()<=Date.now()){await commitWrites(env,[makeUpdate("users",user.uid,{subscriptionStatus:"expired"},{serverTimestamps:["updatedAt"]})]);data.subscriptionStatus="expired";}
 const pending=(await queryDocs(env,"subscriptionRequests",[["uid",user.uid],["status","pending"]],{limit:1})).length>0;
 const status=active?"active":data.subscriptionStatus==="expired"?"expired":pending?"pending":(data.subscriptionStatus||"free");
 return json({uid:user.uid,email:data.email||user.email,displayName:data.displayName||user.name,photoURL:data.photoURL||user.picture,freeTweetsUsed:Number(data.freeTweetsUsed||0),totalTweetsSubmitted:Number(data.totalTweetsSubmitted||0),totalRepliesGenerated:Number(data.totalRepliesGenerated||0),plan:data.plan||"free",planLabel:data.planLabel||"Free",subscriptionStatus:status,subscriptionStart:iso(data.subscriptionStart),subscriptionExpiry:iso(data.subscriptionExpiry),pendingPayment:pending});
 } catch(e){return errorResponse(e,"Could not load account.");} }
