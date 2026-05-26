import { useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const CLAUDE_API = "https://api.anthropic.com/v1/messages";

function genHistory(base) {
  const pts = []; let v = base; const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    v = Math.max(0.05, Math.min(0.95, v + (Math.random() - 0.48) * 0.04));
    pts.push({ day: `J-${i}`, prob: Math.round(v * 100) });
  }
  return pts;
}
function fmtVol(n) { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1000) return `${(n/1000).toFixed(0)}k`; return n; }
function timeAgo(ts) { const s = Math.floor((Date.now()-ts)/1000); if(s<60) return "à l'instant"; if(s<3600) return `il y a ${Math.floor(s/60)}min`; if(s<86400) return `il y a ${Math.floor(s/3600)}h`; return `il y a ${Math.floor(s/86400)}j`; }

const INIT_MARKETS = [
  { id:1, question:"La France va-t-elle gagner la prochaine Coupe du Monde ?", category:"Sport", yesProb:0.34, volume:142500, closes:"2026-12-01", userBet:null, comments:[{user:"Alex",text:"Les Bleus ont une belle génération !",ts:Date.now()-3600000,likes:4}], history:genHistory(0.34) },
  { id:2, question:"L'IA va-t-elle dépasser l'humain au jeu de Go d'ici 2027 ?", category:"Technologie", yesProb:0.71, volume:89300, closes:"2027-01-01", userBet:null, comments:[{user:"Léo",text:"AlphaGo l'a déjà fait non ?",ts:Date.now()-7200000,likes:8}], history:genHistory(0.71) },
  { id:3, question:"Bitcoin dépassera-t-il 200 000 $ avant fin 2026 ?", category:"Finance", yesProb:0.52, volume:310000, closes:"2026-12-31", userBet:null, comments:[{user:"Crypto_Fan",text:"Le halving va tout changer 🚀",ts:Date.now()-600000,likes:12}], history:genHistory(0.52) },
  { id:4, question:"Haïti tiendra-t-elle des élections avant 2027 ?", category:"Politique", yesProb:0.41, volume:67200, closes:"2027-01-01", userBet:null, comments:[{user:"CitoyenHT",text:"Espérons que la sécurité s'améliore.",ts:Date.now()-900000,likes:6}], history:genHistory(0.41) },
];

const PAYMENTS = [
  { id:"paypal", name:"PayPal", icon:"🅿", color:"#003087", accent:"#009cde", fields:[{key:"email",label:"Email PayPal",placeholder:"votre@email.com",type:"email"}], fee:2.9, feeFixed:0.30, delay:"Instantané" },
  { id:"moncash", name:"MonCash", icon:"🇭🇹", color:"#c0392b", accent:"#e74c3c", fields:[{key:"phone",label:"Numéro MonCash",placeholder:"+509 XXXX XXXX",type:"tel"}], fee:1.5, feeFixed:0, delay:"Instantané" },
  { id:"natcash", name:"NatCash", icon:"🏦", color:"#1a5276", accent:"#2e86c1", fields:[{key:"phone",label:"Numéro NatCash",placeholder:"+509 XXXX XXXX",type:"tel"}], fee:1.0, feeFixed:0, delay:"< 5 min" },
  { id:"card", name:"Carte Bancaire", icon:"💳", color:"#2d1b69", accent:"#7c3aed", fields:[{key:"cardNumber",label:"Numéro de carte",placeholder:"1234 5678 9012 3456",type:"text",maxLen:19},{key:"expiry",label:"Expiration",placeholder:"MM/AA",type:"text",maxLen:5,half:true},{key:"cvv",label:"CVV",placeholder:"123",type:"text",maxLen:3,half:true},{key:"name",label:"Nom sur la carte",placeholder:"JEAN DUPONT",type:"text"}], fee:1.5, feeFixed:0, delay:"Instantané" },
];

const CAT_COLORS = { Sport:"#3b82f6", Technologie:"#a855f7", Finance:"#f59e0b", Politique:"#ef4444", Science:"#10b981", Culture:"#ec4899" };

function ProbBar({ prob }) {
  const pct = Math.round(prob*100);
  return <div style={{height:6,background:"#1a1f2e",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>60?"#00e5a0":pct>40?"#f5c842":"#ff4d6d",borderRadius:3,transition:"width 0.6s ease"}} /></div>;
}

function ChartTip({ active, payload }) {
  if (!active||!payload?.length) return null;
  return <div style={{background:"#161b27",border:"1px solid #1e2736",borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"monospace"}}><div style={{color:"#00e5a0",fontWeight:700}}>{payload[0].value}%</div><div style={{color:"#4a5568"}}>{payload[0].payload.day}</div></div>;
    }
