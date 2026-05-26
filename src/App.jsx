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
   }function DepositModal({ onClose, onDeposit }) {
  const [step, setStep] = useState("method");
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState(50);
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const pm = PAYMENTS.find(p => p.id === sel);
  const feeAmt = pm ? ((amount * pm.fee/100) + pm.feeFixed).toFixed(2) : "0.00";
  const total = pm ? (amount + parseFloat(feeAmt)).toFixed(2) : amount.toFixed(2);

  function handleField(key, val) {
    let v = val;
    if (key==="cardNumber") v = val.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
    if (key==="expiry") { const d=val.replace(/\D/g,"").slice(0,4); v=d.length>2?d.slice(0,2)+"/"+d.slice(2):d; }
    setFields(f=>({...f,[key]:v})); setErrors(e=>({...e,[key]:null}));
  }
  function validate() {
    const errs={};
    pm.fields.forEach(f=>{if(!fields[f.key]?.trim()) errs[f.key]="Requis";});
    if(pm.id==="card"){if((fields.cardNumber||"").replace(/\s/g,"").length<16)errs.cardNumber="Invalide";if(!/^\d{2}\/\d{2}$/.test(fields.expiry||""))errs.expiry="MM/AA";if((fields.cvv||"").length<3)errs.cvv="3 chiffres";}
    if(["moncash","natcash"].includes(pm.id)&&(fields.phone||"").replace(/\D/g,"").length<8)errs.phone="Invalide";
    if(pm.id==="paypal"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email||""))errs.email="Email invalide";
    setErrors(errs); return !Object.keys(errs).length;
  }
  async function submit() {
    if(!validate()) return;
    setLoading(true); await new Promise(r=>setTimeout(r,1600)); setLoading(false);
    setStep("success"); setTimeout(()=>{onDeposit(amount);onClose();},2000);
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#0d1117",border:"1px solid #1e2736",borderRadius:24,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.7)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #1e2736",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#e2e8f0",fontFamily:"monospace"}}>{step==="success"?"✓ Dépôt confirmé !":"Déposer des fonds"}</div>
          <button onClick={onClose} style={{background:"#1e2736",border:"none",borderRadius:8,color:"#64748b",width:28,height:28,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
        <div style={{padding:"18px 22px 22px"}}>
          {step==="method" && <>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:"#64748b",fontFamily:"monospace",marginBottom:8,letterSpacing:1}}>MONTANT</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {[10,25,50,100,250].map(p=><button key={p} onClick={()=>setAmount(p)} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"monospace",background:amount===p?"#00e5a0":"#161b27",color:amount===p?"#000":"#64748b",border:`1px solid ${amount===p?"#00e5a0":"#1e2736"}`}}>${p}</button>)}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#4a5568",fontFamily:"monospace",fontSize:18}}>$</span>
                <input type="number" min={1} value={amount} onChange={e=>setAmount(Math.max(1,+e.target.value))} style={{flex:1,background:"#161b27",border:"1px solid #1e2736",borderRadius:10,padding:"9px 12px",color:"#e2e8f0",fontSize:18,fontWeight:800,fontFamily:"monospace",outline:"none"}} />
              </div>
            </div>
            <div style={{fontSize:10,color:"#64748b",fontFamily:"monospace",marginBottom:10,letterSpacing:1}}>MÉTHODE</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {PAYMENTS.map(p=>(
                <button key={p.id} onClick={()=>{setSel(p.id);setStep("form");setFields({});setErrors({});}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#161b27",border:"1px solid #1e2736",borderRadius:14,cursor:"pointer",textAlign:"left",width:"100%"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${p.color},${p.accent})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{p.icon}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{p.name}</div><div style={{fontSize:10,color:"#4a5568"}}>Frais: {p.fee}%{p.feeFixed?` + $${p.feeFixed}`:""} • {p.delay}</div></div>
                  <span style={{color:"#4a5568"}}>›</span>
                </button>
              ))}
            </div>
          </>}
          {step==="form" && pm && <>
            <button onClick={()=>setStep("method")} style={{background:"transparent",border:"none",color:"#64748b",cursor:"pointer",fontSize:12,padding:0,marginBottom:14}}>‹ Retour</button>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14}}>
              {pm.fields.map(f=>(
                <div key={f.key} style={{width:f.half?"calc(50% - 5px)":"100%"}}>
                  <label style={{fontSize:10,color:"#64748b",fontFamily:"monospace",display:"block",marginBottom:5}}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={fields[f.key]||""} maxLength={f.maxLen} onChange={e=>handleField(f.key,e.target.value)}
                    style={{width:"100%",background:"#080c14",border:`1px solid ${errors[f.key]?"#ff4d6d":"#1e2736"}`,borderRadius:9,padding:"9px 12px",color:"#e2e8f0",fontSize:13,fontFamily:"monospace",outline:"none"}} />
                  {errors[f.key]&&<div style={{fontSize:10,color:"#ff4d6d",marginTop:3}}>{errors[f.key]}</div>}
                </div>
              ))}
            </div>
            <div style={{background:"#080c14",border:"1px solid #1e2736",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
              {[{l:"Montant",v:`$${amount.toFixed(2)}`},{l:`Frais (${pm.fee}%)`,v:`$${feeAmt}`,sub:true},{l:"Total",v:`$${total}`,bold:true}].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",marginBottom:r.bold?0:6,paddingTop:r.bold?6:0,borderTop:r.bold?"1px solid #1e2736":"none"}}>
                  <span style={{fontSize:11,color:r.sub?"#4a5568":"#94a3b8"}}>{r.l}</span>
                  <span style={{fontSize:12,fontWeight:r.bold?800:500,color:r.bold?"#00e5a0":"#94a3b8",fontFamily:"monospace"}}>{r.v}</span>
                </div>
              ))}
            </div>
            <button onClick={submit} disabled={loading} style={{width:"100%",padding:"12px 0",background:loading?"#1e2736":`linear-gradient(135deg,${pm.accent},${pm.color})`,color:loading?"#4a5568":"#fff",border:"none",borderRadius:12,fontWeight:800,fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:"monospace"}}>
              {loading?<span style={{animation:"pulse 1s infinite",display:"inline-block"}}>TRAITEMENT…</span>:`CONFIRMER • $${total}`}
            </button>
          </>}
          {step==="success" && (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{width:68,height:68,borderRadius:"50%",background:"rgba(0,229,160,0.12)",border:"2px solid #00e5a0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px"}}>✓</div>
              <div style={{fontSize:20,fontWeight:800,color:"#00e5a0",fontFamily:"monospace",marginBottom:6}}>+${amount} crédités !</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketDetail({ market, onClose, onBet }) {
  const [side, setSide] = useState("yes");
  const [amount, setAmount] = useState(10);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(market.comments||[]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const pct = Math.round(market.yesProb*100);

  async function analyze() {
    setAiLoading(true);
    try {
      const res = await fetch(CLAUDE_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:`Analyse ce marché: "${market.question}". Prob: ${pct}%. Volume: $${fmtVol(market.volume)}. 3-4 phrases en français.`}]})});
      const d = await res.json();
      setAiText(d.content?.find(b=>b.type==="text")?.text||"Indisponible.");
    } catch { setAiText("Analyse indisponible."); }
    setAiLoading(false);
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#0d1117",border:"1px solid #1e2736",borderRadius:24,width:"100%",maxWidth:600,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #1e2736",display:"flex",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"#e2e8f0"}}>{market.question}</div></div>
          <button onClick={onClose} style={{background:"#1e2736",border:"none",borderRadius:8,color:"#64748b",width:28,height:28,cursor:"pointer",flexShrink:0}}>✕</button>
        </div>
        <div style={{padding:"18px 22px"}}>
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            {[{l:"Prob. OUI",v:`${pct}%`,c:pct>60?"#00e5a0":pct>40?"#f5c842":"#ff4d6d"},{l:"Volume",v:`$${fmtVol(market.volume)}`,c:"#3b82f6"}].map(s=>(
              <div key={s.l} style={{flex:1,minWidth:90,background:"#161b27",border:"1px solid #1e2736",borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:17,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
                <div style={{fontSize:10,color:"#4a5568",marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",fontFamily:"monospace",marginBottom:8}}>📈 ÉVOLUTION 30 JOURS</div>
            <div style={{background:"#080c14",border:"1px solid #1e2736",borderRadius:12,padding:"10px 6px 4px"}}>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={market.history}>
                  <XAxis dataKey="day" tick={{fontSize:8,fill:"#4a5568"}} tickLine={false} axisLine={false} interval={9}/>
                  <YAxis domain={[0,100]} tick={{fontSize:8,fill:"#4a5568"}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} width={30}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine y={50} stroke="#1e2736" strokeDasharray="4 4"/>
                  <Line type="monotone" dataKey="prob" stroke="#00e5a0" strokeWidth={2} dot={false} activeDot={{r:4,fill:"#00e5a0"}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{background:"#161b27",border:"1px solid #1e2736",borderRadius:14,padding:"14px 16px",marginBottom:18}}>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {["yes","no"].map(s=><button key={s} onClick={()=>setSide(s)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${side===s?(s==="yes"?"#00e5a0":"#ff4d6d"):"#1e2736"}`,background:side===s?(s==="yes"?"rgba(0,229,160,0.12)":"rgba(255,77,109,0.12)"):"transparent",color:side===s?(s==="yes"?"#00e5a0":"#ff4d6d"):"#64748b",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"monospace"}}>{s==="yes"?"✓ OUI":"✗ NON"}</button>)}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input type="number" min={1} value={amount} onChange={e=>setAmount(+e.target.value)} style={{flex:1,background:"#0d1117",border:"1px solid #1e2736",borderRadius:9,padding:"8px 12px",color:"#e2e8f0",fontSize:14,fontFamily:"monospace",outline:"none"}}/>
              <button onClick={()=>{onBet(market.id,side,amount);onClose();}} style={{padding:"8px 18px",background:side==="yes"?"#00e5a0":"#ff4d6d",color:"#000",border:"none",borderRadius:9,fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"monospace"}}>PARIER</button>
            </div>
          </div>
          <div style={{background:"rgba(0,229,160,0.04)",border:"1px solid rgba(0,229,160,0.15)",borderRadius:14,padding:"12px 16px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiText?8:0}}>
              <div style={{fontSize:11,fontWeight:700,color:"#00e5a0",fontFamily:"monospace"}}>✦ ANALYSE IA</div>
              {!aiText&&!aiLoading&&<button onClick={analyze} style={{padding:"4px 12px",background:"rgba(0,229,160,0.12)",border:"1px solid rgba(0,229,160,0.3)",borderRadius:8,color:"#00e5a0",fontSize:11,fontWeight:700,cursor:"pointer"}}>ANALYSER</button>}
            </div>
            {aiLoading&&<div style={{fontSize:12,color:"#4a5568"}}>Analyse en cours…</div>}
            {aiText&&<div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6}}>{aiText}</div>}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input placeholder="Votre avis…" value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(comments.push({user:"Vous",text:comment,ts:Date.now(),likes:0}),setComment(""))} style={{flex:1,background:"#161b27",border:"1px solid #1e2736",borderRadius:9,padding:"8px 12px",color:"#e2e8f0",fontSize:13,outline:"none"}}/>
            <button onClick={()=>{if(comment.trim()){setComments(c=>[...c,{user:"Vous",text:comment,ts:Date.now(),likes:0}]);setComment("");}}} style={{padding:"8px 14px",background:"#1e2736",border:"none",borderRadius:9,color:"#94a3b8",cursor:"pointer",fontWeight:700}}>→</button>
          </div>
          {comments.map((c,i)=>(
            <div key={i} style={{background:"#161b27",border:"1px solid #1e2736",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:"#00e5a0",fontFamily:"monospace"}}>{c.user}</span><span style={{fontSize:10,color:"#4a5568"}}>{timeAgo(c.ts)}</span></div>
              <div style={{fontSize:13,color:"#94a3b8"}}>{c.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketCard({ market, onOpen, isNew }) {
  const pct = Math.round(market.yesProb*100);
  const cc = CAT_COLORS[market.category]||"#6b7280";
  return (
    <div onClick={()=>onOpen(market)} style={{background:"linear-gradient(135deg,#0d1117,#161b27)",border:`1px solid ${isNew?"#00e5a0":"#1e2736"}`,borderRadius:16,padding:"16px 18px",cursor:"pointer",transition:"all 0.25s",position:"relative"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=cc+"80";e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=isNew?"#00e5a0":"#1e2736";e.currentTarget.style.transform="none";}}>
      {isNew&&<div style={{position:"absolute",top:10,right:10,background:"#00e5a0",color:"#000",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,fontFamily:"monospace"}}>NOUVEAU</div>}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:10,fontWeight:700,color:cc,background:`${cc}18`,padding:"2px 8px",borderRadius:20,fontFamily:"monospace"}}>{market.category}</span>
        <span style={{fontSize:10,color:"#4a5568",marginLeft:"auto",fontFamily:"monospace"}}>{new Date(market.closes).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
      </div>
      <p style={{fontSize:14,fontWeight:600,color:"#e2e8f0",lineHeight:1.5,marginBottom:12}}>{market.question}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
        <div><span style={{fontSize:28,fontWeight:800,color:pct>60?"#00e5a0":pct>40?"#f5c842":"#ff4d6d",fontFamily:"monospace"}}>{pct}%</span><span style={{fontSize:11,color:"#4a5568",marginLeft:5}}>OUI</span></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#4a5568"}}>Vol.</div><div style={{fontSize:12,fontWeight:700,color:"#94a3b8",fontFamily:"monospace"}}>${fmtVol(market.volume)}</div></div>
      </div>
      <ProbBar prob={market.yesProb}/>
      <div style={{marginTop:8,fontSize:10,color:"#4a5568",textAlign:"right"}}>💬 {market.comments?.length||0} • Détails →</div>
    </div>
  );
}

export default function App() {
  const [markets, setMarkets] = useState(INIT_MARKETS);
  const [balance, setBalance] = useState(500);
  const [txs, setTxs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Tous");
  const [newIds, setNewIds] = useState([]);
  const [topic, setTopic] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("markets");
  const nextId = useRef(markets.length+1);

  const CATS = ["Tous","Sport","Technologie","Finance","Politique","Science","Culture"];
  const filtered = markets.filter(m=>(cat==="Tous"||m.category===cat)&&m.question.toLowerCase().includes(search.toLowerCase()));
  const totalBets = markets.filter(m=>m.userBet).length;
  const invested = markets.filter(m=>m.userBet).reduce((s,m)=>s+m.userBet.amount,0);

  async function generate() {
    setGenerating(true); setGenErr("");
    try {
      const res = await fetch(CLAUDE_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:`${topic?`Génère 3 marchés sur:"${topic}".`:"Génère 3 marchés prédictifs variés."}\nJSON uniquement:\n[{"question":"...","category":"Sport|Technologie|Finance|Politique|Science|Culture","yesProb":0.XX,"volume":NNNN,"closes":"YYYY-MM-DD"}]`}]})});
      const d = await res.json();
      const parsed = JSON.parse((d.content?.find(b=>b.type==="text")?.text||"[]").replace(/```json|```/g,"").trim());
      const added = parsed.map((m,i)=>({...m,id:nextId.current+i,userBet:null,comments:[],history:genHistory(m.yesProb)}));
      nextId.current += parsed.length;
      setMarkets(p=>[...added,...p]); setNewIds(added.map(m=>m.id));
      setTimeout(()=>setNewIds([]),5000); setTopic("");
    } catch { setGenErr("Erreur. Réessayez."); }
    setGenerating(false);
  }

  function handleBet(marketId, side, amount) {
    if(amount>balance){setGenErr("Solde insuffisant !");setTimeout(()=>setGenErr(""),3000);return;}
    const mkt=markets.find(m=>m.id===marketId);
    setBalance(b=>b-amount);
    setMarkets(p=>p.map(m=>m.id===marketId?{...m,userBet:{side,amount},volume:m.volume+amount,yesProb:side==="yes"?Math.min(0.95,m.yesProb+0.01):Math.max(0.05,m.yesProb-0.01)}:m));
    setTxs(p=>[...p,{type:"bet",side,amount,question:(mkt?.question||"").slice(0,38)+"…",ts:Date.now()}]);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080c14;font-family:'Sora',sans-serif;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        input::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
      `}</style
