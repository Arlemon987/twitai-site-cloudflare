let API_ROOT_PLACEHOLDER = "";
const API_ROOT = (env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
let cachedAccessToken = null;
let cachedAccessTokenExpires = 0;

function b64url(bytesOrText) {
  const bytes = typeof bytesOrText === "string" ? new TextEncoder().encode(bytesOrText) : bytesOrText;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToArrayBuffer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function jsonResponse(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function apiError(message, status=500, code="INTERNAL_ERROR") {
  const e = new Error(message); e.status = status; e.code = code; return e;
}
async function serviceAccessToken(env) {
  const now = Math.floor(Date.now()/1000);
  if (cachedAccessToken && cachedAccessTokenExpires > now + 90) return cachedAccessToken;
  const email = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (!email || !privateKey || !env.FIREBASE_PROJECT_ID) throw apiError("Firebase service account secrets are missing.", 500, "FIREBASE_CONFIG_MISSING");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, sub: email, aud: TOKEN_URL, iat: now, exp: now+3600, scope: "https://www.googleapis.com/auth/datastore" }));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKey.replace(/\\n/g,"\n")), { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${b64url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, { method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({ grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || !data.access_token) throw apiError(data.error_description || data.error || "Could not obtain Firebase service token.", 502, "FIREBASE_TOKEN_ERROR");
  cachedAccessToken=data.access_token; cachedAccessTokenExpires=now+Number(data.expires_in||3600);
  return cachedAccessToken;
}
async function firestoreFetch(env, path, options={}) {
  const token = await serviceAccessToken(env);
  const response = await fetch(`${API_ROOT(env)}${path}`, { ...options, headers:{ authorization:`Bearer ${token}`, "content-type":"application/json", ...(options.headers||{}) } });
  const text = await response.text();
  let data={}; try { data=text?JSON.parse(text):{}; } catch {}
  if (!response.ok) {
    const message=data?.error?.message || `Firestore request failed (${response.status}).`;
    const status=response.status===404?404:response.status===409||response.status===412?409:502;
    throw apiError(message,status,"FIRESTORE_ERROR");
  }
  return data;
}
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue:null };
  if (v instanceof Date) return { timestampValue:v.toISOString() };
  if (typeof v === "string") return { stringValue:v };
  if (typeof v === "boolean") return { booleanValue:v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue:String(v) } : { doubleValue:v };
  if (Array.isArray(v)) return { arrayValue:{ values:v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue:{ fields:encodeFields(v) } };
  return { stringValue:String(v) };
}
function encodeFields(data) { const result={}; for (const [k,v] of Object.entries(data)) result[k]=encodeValue(v); return result; }
function decodeValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values||[]).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields||{});
  if ("referenceValue" in v) return v.referenceValue;
  return null;
}
function decodeFields(fields={}) { const out={}; for (const [k,v] of Object.entries(fields)) out[k]=decodeValue(v); return out; }
function docName(collection,id) { return `${API_ROOT_PLACEHOLDER}/${collection}/${encodeURIComponent(id)}`; }
function docPath(collection,id) { return `/${collection}/${encodeURIComponent(id)}`; }
function readDoc(raw) { return raw?.name ? { exists:true, name:raw.name, updateTime:raw.updateTime, data:decodeFields(raw.fields||{}) } : { exists:false, data:null }; }
export async function getDoc(env, collection, id, transaction=null) {
  const suffix=transaction?`?transaction=${encodeURIComponent(transaction)}`:"";
  try { return readDoc(await firestoreFetch(env,`${docPath(collection,id)}${suffix}`)); }
  catch(e) { if (e.status===404) return { exists:false,data:null }; throw e; }
}
export async function listDocs(env, collection, {orderBy=null,limit=200}={}) {
  const q=new URLSearchParams({pageSize:String(limit)}); if(orderBy) q.set("orderBy",orderBy);
  const data=await firestoreFetch(env,`/${collection}?${q}`);
  return (data.documents||[]).map(readDoc);
}
export async function queryDocs(env, collection, filters=[], {limit=100, orderBy=null, transaction=null}={}) {
  const where=filters.length===1 ? {fieldFilter:{field:{fieldPath:filters[0][0]},op:"EQUAL",value:encodeValue(filters[0][1])}} : filters.length>1 ? {compositeFilter:{op:"AND",filters:filters.map(([field,value])=>({fieldFilter:{field:{fieldPath:field},op:"EQUAL",value:encodeValue(value)}}))}} : undefined;
  const structuredQuery={from:[{collectionId:collection}],limit};
  if(where) structuredQuery.where=where;
  if(orderBy) structuredQuery.orderBy=[{field:{fieldPath:orderBy.replace(/ (asc|desc)$/i,"")},direction:/ desc$/i.test(orderBy)?"DESCENDING":"ASCENDING"}];
  const body={structuredQuery}; if(transaction) body.transaction=transaction;
  const rows=await firestoreFetch(env,":runQuery",{method:"POST",body:JSON.stringify(body)});
  return rows.filter(x=>x.document).map(x=>readDoc(x.document));
}
function updateWrite(collection,id,data, increments={}, serverTimestamps=[], exists=true) {
  const name=`${API_ROOT_PLACEHOLDER}/${collection}/${id}`;
  const transforms=[];
  for(const [field,amount] of Object.entries(increments)) transforms.push({fieldPath:field,increment:encodeValue(amount)});
  for(const field of serverTimestamps) transforms.push({fieldPath:field,setToServerValue:"REQUEST_TIME"});
  if(Object.keys(data).length===0 && transforms.length) {
    const write={transform:{document:name,fieldTransforms:transforms}};
    if(exists!==null) write.currentDocument={exists};
    return write;
  }
  const write={update:{name,fields:encodeFields(data)}, updateMask:{fieldPaths:Object.keys(data)}};
  if(transforms.length) write.updateTransforms=transforms;
  if(exists!==null) write.currentDocument={exists};
  return write;
}
export async function commitWrites(env,writes,transaction=null) {
  const body={writes}; if(transaction) body.transaction=transaction;
  return firestoreFetch(env,":commit",{method:"POST",body:JSON.stringify(body)});
}
export async function createDoc(env,collection,data) {
  const out=await firestoreFetch(env,`/${collection}`,{method:"POST",body:JSON.stringify({fields:encodeFields(data)})});
  const id=out.name.split("/").pop(); return id;
}
export async function beginTransaction(env) {
  const out=await firestoreFetch(env,":beginTransaction",{method:"POST",body:JSON.stringify({options:{readWrite:{}}})});
  return out.transaction;
}
export async function rollbackTransaction(env,transaction) {
  try { await firestoreFetch(env,":rollback",{method:"POST",body:JSON.stringify({transaction})}); } catch {}
}
export async function verifyFirebaseUser(request,env) {
  const header=request.headers.get("authorization")||"";
  if(!header.startsWith("Bearer ")) throw apiError("Authentication required.",401,"AUTH_REQUIRED");
  const idToken=header.slice(7).trim(); if(!idToken) throw apiError("Authentication required.",401,"AUTH_REQUIRED");
  if(!env.FIREBASE_WEB_API_KEY) throw apiError("FIREBASE_WEB_API_KEY is missing.",500,"FIREBASE_CONFIG_MISSING");
  const response=await fetch(`${IDENTITY_URL}?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idToken,returnSecureToken:false})});
  const result=await response.json().catch(()=>({}));
  const user=result.users?.[0];
  if(!response.ok||!user) throw apiError("Authentication token is invalid or expired.",401,"AUTH_INVALID");
  return {uid:user.localId,email:user.email||"",name:user.displayName||"",picture:user.photoUrl||"",email_verified:user.emailVerified===true};
}
export function json(data,status=200) { return jsonResponse(data,status); }
export function errorResponse(error, fallback="Request failed.") { return jsonResponse({error:error?.message||fallback,code:error?.code||"INTERNAL_ERROR"},error?.status||500); }
export function fieldTimestamp(value) { if(!value) return null; const d=value instanceof Date?value:new Date(value); return Number.isNaN(d.getTime())?null:d; }
export function iso(value) { const d=fieldTimestamp(value); return d?d.toISOString():null; }
export function activeSubscription(data) { const expiry=fieldTimestamp(data.subscriptionExpiry); return data.subscriptionStatus==="active"&&expiry&&expiry.getTime()>Date.now(); }
export function dhakaDate(date=new Date()) { const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date); const x=Object.fromEntries(p.map(v=>[v.type,v.value])); return `${x.year}-${x.month}-${x.day}`; }
export function subtractDays(dateString,days) { const [y,m,d]=dateString.split("-").map(Number); const date=new Date(Date.UTC(y,m-1,d)); date.setUTCDate(date.getUTCDate()-days); return date.toISOString().slice(0,10); }
export function makeUpdate(collection,id,data,{increments={},serverTimestamps=[],exists=true}={}) { return updateWrite(collection,id,data,increments,serverTimestamps,exists); }
export function makeCreate(collection,id,data) { return {update:{name:`${API_ROOT_PLACEHOLDER}/${collection}/${id}`,fields:encodeFields(data)},currentDocument:{exists:false}}; }
export function parseBody(request) { return request.json().catch(()=>({})); }
export function queryParam(request,key) { return new URL(request.url).searchParams.get(key); }
export function requireMethod(request,method) { if(request.method!==method) throw apiError("Method not allowed.",405,"METHOD_NOT_ALLOWED"); }

export function initFirestore(env) {
  API_ROOT_PLACEHOLDER =
    `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}
