import { useState, useReducer, useCallback, useRef, useEffect, memo, useMemo } from "react";
import { callAPI } from "./api";

// --- Constants ---
const STAGES = ["intake","brief","tasks","review","publish"];
const STAGE_LABELS = {intake:"Intake",brief:"Brief",tasks:"Tasks",review:"Review & Export",publish:"Publish"};
const TASK_TYPES = ["Design","Copy","Scheduling","Admin"];
const MEETING_TYPES = ["Monthly review","Ad hoc","New brief","Problem resolution"];
const CHANNEL_TYPES = ["WordPress","LinkedIn","Social Scheduler","M365","Custom"];

const DEFAULT_ACCOUNTS = [
  {id:"shoothill",name:"Shoothill",contact:"",email:"",scope:"Website, social media, content marketing",budget:40,usedHours:0,roadmap:"Q1: Rebrand launch, new case studies",brand:"Professional, tech-forward tone. Primary teal #0F6E56.",colors:["#0F6E56","#1a1a2e","#e0e0e0"],logo:null,active:true},
  {id:"hbp",name:"HousebuilderPro",contact:"",email:"",scope:"Product marketing, trade show materials",budget:30,usedHours:0,roadmap:"Q1: Feature launch campaign",brand:"Bold, construction industry tone. Orange primary.",colors:["#E87A2E","#333333","#F5F5F5"],logo:null,active:true},
  {id:"hce",name:"Heat Charge Evolution",contact:"",email:"",scope:"Brand awareness, lead gen",budget:25,usedHours:0,roadmap:"Q1: New website, SEO push",brand:"Clean energy, modern, green focus.",colors:["#2ECC71","#2C3E50","#ECF0F1"],logo:null,active:true},
  {id:"arh",name:"ARH Group",contact:"",email:"",scope:"Corporate comms, LinkedIn",budget:20,usedHours:0,roadmap:"Q1: Thought leadership series",brand:"Corporate, authoritative. Navy and gold.",colors:["#1B2A4A","#C9A84C","#F8F8F8"],logo:null,active:true},
];

const DEFAULT_BMS = [
  {key:"name",label:"Task name",source:"task.name",enabled:true},
  {key:"type",label:"Task type",source:"task.type",enabled:true},
  {key:"description",label:"Description",source:"task.description",enabled:true},
  {key:"assignee",label:"Assigned to",source:"task.assignee",enabled:true},
  {key:"startDate",label:"Start date",source:"today",enabled:true},
  {key:"due",label:"Due date",source:"task.due",enabled:true},
  {key:"hours",label:"Estimated hours",source:"task.hours",enabled:true},
  {key:"signoff",label:"Sign off",source:"task.signoff",enabled:true},
  {key:"account",label:"Account",source:"account.name",enabled:true},
  {key:"priority",label:"Priority",source:"task.priority",enabled:true},
  {key:"repeat",label:"Repeat",source:"default:Do not repeat",enabled:true},
  {key:"channel",label:"Channel",source:"task.channel",enabled:true},
];

const DEFAULT_TEAM = [
  {id:"1",name:"Sarah Collins",role:"Account Manager",email:"sarah@shoothill.com"},
  {id:"2",name:"James Wright",role:"Designer",email:"james@shoothill.com"},
  {id:"3",name:"Emma Taylor",role:"Copywriter",email:"emma@shoothill.com"},
  {id:"4",name:"Mike Chen",role:"Marketing Lead",email:"mike@shoothill.com"},
];

const DEFAULT_CHANNELS = [
  {id:"wp1",name:"WordPress (Main)",type:"WordPress",url:"",connected:false,defaultBehaviour:"Draft",linkedAccounts:["shoothill"],active:true},
  {id:"li1",name:"LinkedIn",type:"LinkedIn",url:"",connected:false,defaultBehaviour:"Draft",linkedAccounts:["shoothill","arh"],active:true},
  {id:"ss1",name:"Social Scheduler",type:"Social Scheduler",url:"",connected:false,defaultBehaviour:"Schedule",linkedAccounts:["shoothill","hbp"],active:true},
  {id:"m365",name:"Microsoft 365",type:"M365",url:"https://microsoft365.mcp.claude.com/mcp",connected:true,defaultBehaviour:"Draft",linkedAccounts:["shoothill","hbp","hce","arh"],active:true},
];

const uid = () => Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";

// --- Styles ---
const S = {
  inp: {width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #d1d5db",fontSize:13,fontFamily:"inherit",background:"#fff",color:"#111",boxSizing:"border-box"},
  lbl: {fontSize:12,fontWeight:600,marginBottom:4,display:"block",color:"#555"},
  card: {padding:14,borderRadius:8,border:"1px solid #e5e7eb",marginBottom:8,background:"#fff"},
  btnPrimary: {padding:"10px 24px",borderRadius:8,border:"none",background:"#0F6E56",color:"#fff",fontWeight:600,fontSize:14,cursor:"pointer"},
  btnSecondary: {padding:"10px 20px",borderRadius:8,border:"1.5px solid #534AB7",background:"transparent",color:"#534AB7",fontWeight:600,fontSize:13,cursor:"pointer"},
  btnDanger: {padding:"10px 20px",borderRadius:8,border:"1.5px solid #993C1D",background:"transparent",color:"#993C1D",fontWeight:600,fontSize:13,cursor:"pointer"},
  btnSmall: {padding:"5px 14px",borderRadius:6,border:"none",fontSize:12,cursor:"pointer",fontWeight:500},
  sectionLabel: {fontSize:11,textTransform:"uppercase",letterSpacing:.8,fontWeight:700,color:"#534AB7"},
};

// --- Reducer ---
const initState = {
  settings:{accounts:DEFAULT_ACCOUNTS,channels:DEFAULT_CHANNELS,team:DEFAULT_TEAM,templates:{brief:[],tasks:[]},bms:{columns:DEFAULT_BMS}},
  sessions:[],
  activeSessionId:null,
  currentView:"intake",
  selectedAccountId:"shoothill",
  userName:"Account Manager",
  toasts:[],
};

function reducer(s, a) {
  switch(a.type) {
    case "SET_VIEW": return {...s, currentView:a.payload};
    case "SET_ACCOUNT": return {...s, selectedAccountId:a.payload};
    case "ADD_TOAST": return {...s, toasts:[...s.toasts,{id:Date.now(),msg:a.payload.msg,kind:a.payload.type||"info"}]};
    case "REMOVE_TOAST": return {...s, toasts:s.toasts.filter(t=>t.id!==a.payload)};
    case "CREATE_SESSION": return {...s, sessions:[...s.sessions, a.payload], activeSessionId:a.payload.id, currentView:"brief"};
    case "UPDATE_SESSION": {
      const {id,...u} = a.payload;
      return {...s, sessions:s.sessions.map(x=>x.id===id?{...x,...u}:x)};
    }
    case "UPDATE_SETTINGS": return {...s, settings:{...s.settings,...a.payload}};
    case "UPDATE_ACCOUNT": {
      const acc = a.payload;
      return {...s, settings:{...s.settings, accounts:s.settings.accounts.map(x=>x.id===acc.id?{...x,...acc}:x)}};
    }
    case "UPDATE_CHANNEL": {
      const ch = a.payload;
      return {...s, settings:{...s.settings, channels:s.settings.channels.map(x=>x.id===ch.id?{...x,...ch}:x)}};
    }
    case "ADD_CHANNEL": return {...s, settings:{...s.settings, channels:[...s.settings.channels, a.payload]}};
    case "UPDATE_TEAM": return {...s, settings:{...s.settings, team:a.payload}};
    case "UPDATE_BMS": return {...s, settings:{...s.settings, bms:a.payload}};
    case "IMPORT_SETTINGS": return {...s, settings:a.payload};
    default: return s;
  }
}

// --- Prompt builders ---
function buildBriefPrompts(acc, intake, suffix="") {
  const sys = `You are a senior marketing strategist. Return ONLY a valid JSON object, no markdown fences. Keys: objective (1 sentence), keyMessages (2-3 short strings), deliverables (array of short strings), constraints ({hours:number,scope:string,timeline:string}), brandNotes (1-2 sentences), rationale (1-2 sentences). Be concise.${suffix?"\n"+suffix:""}`;
  const usr = `Account: ${acc.name} | Scope: ${acc.scope} | Roadmap: ${acc.roadmap} | Budget left: ${acc.budget-acc.usedHours}h | Brand: ${acc.brand}\nMeeting ${intake.date} (${intake.meetingType}), attendees: ${intake.attendees.join(", ")}\nProblems: ${intake.problems}\nRequests: ${intake.requests}\nNotes: ${intake.notes}`;
  return [sys, usr];
}

function buildTaskPrompts(acc, brief, team) {
  const sys = `You are a marketing project manager. Return ONLY a valid JSON array, no markdown fences. Each object: type (Design|Copy|Scheduling|Admin), name (short title), description (1 sentence), hours (number), due (YYYY-MM-DD), assignee (string), signoff (string), channel (string or ""), priority (High|Medium|Low). Keep it tight — max 8 tasks.`;
  const usr = `Account: ${acc.name} | Team: ${team.map(t=>t.name+" ("+t.role+")").join(", ")} | Today: ${today()}\nBrief: ${JSON.stringify(brief)}\nGenerate tasks across Design, Copy, Scheduling, Admin. Due dates within 30 days.`;
  return [sys, usr];
}

// --- Pulse loader ---
function PulseBar({label}) {
  return <div style={{display:"flex",flexDirection:"column",gap:6}}>
    <div style={{fontSize:13,fontWeight:500,color:"#0F6E56"}}>{label}</div>
    <div style={{borderRadius:8,overflow:"hidden",background:"#e5e7eb",height:5}}>
      <div style={{height:"100%",background:"linear-gradient(90deg,#0F6E56,#0F6E56cc)",borderRadius:6,width:"60%",animation:"pulse 1.5s ease-in-out infinite alternate"}}/>
    </div>
    <style>{`@keyframes pulse{0%{width:15%;opacity:.7}100%{width:85%;opacity:1}}`}</style>
  </div>;
}

// --- Toasts ---
const Toasts = memo(function Toasts({toasts, dispatch}) {
  useEffect(()=>{
    const timers = toasts.map(t=>setTimeout(()=>dispatch({type:"REMOVE_TOAST",payload:t.id}),4000));
    return ()=>timers.forEach(clearTimeout);
  },[toasts, dispatch]);
  if(!toasts.length) return null;
  const colors = {success:"#0F6E56",error:"#993C1D",info:"#534AB7"};
  return <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
    {toasts.map(t=><div key={t.id} style={{padding:"10px 16px",borderRadius:8,color:"#fff",fontSize:13,fontWeight:500,background:colors[t.kind]||colors.info,boxShadow:"0 4px 12px rgba(0,0,0,.15)",maxWidth:320}}>{t.msg}</div>)}
  </div>;
});

// --- Sidebar ---
const Sidebar = memo(function Sidebar({selectedAccountId, accounts, activeSession, currentView, dispatch}) {
  const currentStage = activeSession?.stage||"intake";
  const isSettings = currentView.startsWith("settings");
  const stageIdx = STAGES.indexOf(currentStage);
  return <div style={{width:240,minWidth:240,background:"#0e1525",color:"#fff",display:"flex",flexDirection:"column",height:"100vh",fontFamily:"system-ui,sans-serif"}}>
    <div style={{padding:"20px 16px 12px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <div style={{fontSize:15,fontWeight:700,letterSpacing:-.3}}>Shoothill</div>
      <div style={{fontSize:11,opacity:.5,marginTop:2}}>Marketing Automation</div>
    </div>
    <div style={{padding:"12px 10px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,opacity:.4,marginBottom:8,paddingLeft:6}}>Account</div>
      {accounts.map(a=><div key={a.id} onClick={()=>dispatch({type:"SET_ACCOUNT",payload:a.id})} style={{padding:"7px 10px",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:selectedAccountId===a.id?600:400,background:selectedAccountId===a.id?"rgba(255,255,255,.1)":"transparent",marginBottom:2,display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:a.colors?.[0]||"#0F6E56",flexShrink:0}}/>{a.name}
      </div>)}
    </div>
    <div style={{padding:"12px 10px",flex:1}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,opacity:.4,marginBottom:8,paddingLeft:6}}>Workflow</div>
      {STAGES.map((st,i)=>{
        const done = i < stageIdx;
        const active = st===currentStage && !isSettings;
        const canNav = i <= stageIdx && activeSession;
        return <div key={st} onClick={()=>{if(canNav) dispatch({type:"SET_VIEW",payload:st})}} style={{padding:"7px 10px",borderRadius:6,cursor:canNav?"pointer":"default",fontSize:13,fontWeight:active?600:400,background:active?"rgba(255,255,255,.1)":"transparent",opacity:canNav?1:.35,marginBottom:2,display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:18,height:18,borderRadius:"50%",border:done?"none":"1.5px solid rgba(255,255,255,.3)",background:done?"#0F6E56":"transparent",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff"}}>{done?"✓":i+1}</span>
          {STAGE_LABELS[st]}
        </div>;
      })}
    </div>
    <div style={{padding:"10px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
      {isSettings
        ? <div onClick={()=>dispatch({type:"SET_VIEW",payload:activeSession?activeSession.stage:"intake"})} style={{padding:"8px 10px",borderRadius:6,cursor:"pointer",fontSize:13,opacity:.7,textAlign:"center"}}>← Back to workflow</div>
        : <div onClick={()=>dispatch({type:"SET_VIEW",payload:"settings"})} style={{padding:"8px 10px",borderRadius:6,cursor:"pointer",fontSize:13,opacity:.7,textAlign:"center"}}>⚙ Settings</div>
      }
    </div>
  </div>;
});

// --- TopBar ---
const TopBar = memo(function TopBar({accountName, currentView, userName}) {
  const label = currentView.startsWith("settings")?"Settings":STAGE_LABELS[currentView]||currentView;
  return <div style={{height:52,borderBottom:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontWeight:600,fontSize:15}}>{accountName}</span>
      <span style={{fontSize:12,opacity:.5}}>›</span>
      <span style={{fontSize:13,color:"#666"}}>{label}</span>
    </div>
    <div style={{fontSize:13,color:"#666"}}>{userName}</div>
  </div>;
});

const StageBar = memo(function StageBar({stageIndex}) {
  return <div style={{display:"flex",gap:4,padding:"16px 24px 0"}}>
    {STAGES.map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=stageIndex?"#0F6E56":"#e0e0e0"}}/>)}
  </div>;
});

// --- Stage 1: Intake ---
const IntakeView = memo(function IntakeView({account, team, dispatch}) {
  const [form, setForm] = useState({date:today(),attendees:[],meetingType:MEETING_TYPES[0],problems:"",requests:"",notes:""});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = useCallback((k,v) => setForm(f=>({...f,[k]:v})),[]);
  const toggleAttendee = useCallback(name => {
    setForm(f=>({...f, attendees:f.attendees.includes(name)?f.attendees.filter(a=>a!==name):[...f.attendees,name]}));
  },[]);

  const handleGenerate = useCallback(async () => {
    if(!form.problems && !form.requests && !form.notes){setError("Enter at least some meeting notes.");return;}
    setLoading(true); setError(null);
    try {
      const [sys,usr] = buildBriefPrompts(account, form);
      const brief = await callAPI(sys, usr);
      dispatch({type:"CREATE_SESSION",payload:{id:uid(),account:account.id,date:form.date,stage:"brief",intake:form,brief:{current:brief,history:[]},tasks:[],export:null,pushLog:[]}});
      dispatch({type:"ADD_TOAST",payload:{msg:"Brief generated successfully",type:"success"}});
    } catch(e) { setError("Failed to generate brief: "+e.message); }
    setLoading(false);
  },[form, account, dispatch]);

  return <div style={{maxWidth:640,margin:"0 auto",padding:24}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Meeting Intake</h2>
    <p style={{fontSize:13,color:"#666",marginBottom:24}}>Capture meeting notes for {account.name}</p>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={S.lbl}>Meeting date</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={S.inp}/></div>
        <div><label style={S.lbl}>Meeting type</label><select value={form.meetingType} onChange={e=>set("meetingType",e.target.value)} style={S.inp}>{MEETING_TYPES.map(m=><option key={m}>{m}</option>)}</select></div>
      </div>
      <div>
        <label style={S.lbl}>Attendees</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {team.map(t=><button key={t.id} onClick={()=>toggleAttendee(t.name)} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",borderColor:form.attendees.includes(t.name)?"#0F6E56":"#d1d5db",background:form.attendees.includes(t.name)?"#0F6E5612":"transparent",fontSize:12,cursor:"pointer",fontWeight:form.attendees.includes(t.name)?600:400,color:form.attendees.includes(t.name)?"#0F6E56":"#333"}}>{t.name}</button>)}
        </div>
      </div>
      <div><label style={S.lbl}>Problems raised <span style={{fontWeight:400,opacity:.5}}>({form.problems.length})</span></label><textarea rows={3} value={form.problems} onChange={e=>set("problems",e.target.value)} style={{...S.inp,resize:"vertical"}} placeholder="Issues or challenges discussed..."/></div>
      <div><label style={S.lbl}>Client requests <span style={{fontWeight:400,opacity:.5}}>({form.requests.length})</span></label><textarea rows={3} value={form.requests} onChange={e=>set("requests",e.target.value)} style={{...S.inp,resize:"vertical"}} placeholder="What the client asked for..."/></div>
      <div><label style={S.lbl}>General notes <span style={{fontWeight:400,opacity:.5}}>({form.notes.length})</span></label><textarea rows={4} value={form.notes} onChange={e=>set("notes",e.target.value)} style={{...S.inp,resize:"vertical"}} placeholder="Anything else relevant..."/></div>
      {error && <div style={{padding:"10px 14px",background:"#993C1D18",color:"#993C1D",borderRadius:8,fontSize:13}}>{error}</div>}
      {loading && <PulseBar label="Generating brief — this takes a few seconds..."/>}
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={handleGenerate} disabled={loading} style={{...S.btnPrimary,background:loading?"#aaa":"#0F6E56",cursor:loading?"wait":"pointer"}}>{loading?"Generating...":"Generate brief →"}</button>
      </div>
    </div>
  </div>;
});

// --- Stage 2: Brief ---
const BriefSection = memo(function BriefSection({sKey, label, value, onSave}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const start = () => { setEditing(true); setVal(typeof value==="object"?JSON.stringify(value,null,2):value||""); };
  const save = () => { let v=val; try{v=JSON.parse(val)}catch(e){} onSave(sKey,v); setEditing(false); };
  const isList = Array.isArray(value);
  const isObj = typeof value==="object" && !isList;
  return <div style={{...S.card,border:"1px solid #e5e7eb"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <span style={S.sectionLabel}>{label}</span>
      {!editing && <button onClick={start} style={{fontSize:11,border:"none",background:"none",color:"#534AB7",cursor:"pointer",fontWeight:600}}>Edit</button>}
    </div>
    {editing ? <div>
      <textarea value={val} onChange={e=>setVal(e.target.value)} rows={4} style={{...S.inp,border:"1px solid #534AB7",resize:"vertical"}}/>
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <button onClick={save} style={{...S.btnSmall,background:"#534AB7",color:"#fff"}}>Save</button>
        <button onClick={()=>setEditing(false)} style={{...S.btnSmall,border:"1px solid #d1d5db",background:"transparent",color:"#333"}}>Cancel</button>
      </div>
    </div> : <div style={{fontSize:13,lineHeight:1.6,color:"#333"}}>
      {isList ? <ul style={{margin:0,paddingLeft:18}}>{value.map((v,i)=><li key={i}>{String(v)}</li>)}</ul>
        : isObj ? <div>{Object.entries(value||{}).map(([k,v])=><div key={k}><strong>{k}:</strong> {String(v)}</div>)}</div>
        : String(value||"—")}
    </div>}
  </div>;
});

const BriefView = memo(function BriefView({session, account, team, dispatch}) {
  if(!session) return <div style={{padding:24}}>No active session. Start from Intake.</div>;
  const brief = session.brief.current;
  const [revNote, setRevNote] = useState("");
  const [showRev, setShowRev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const budgetWarn = brief.constraints?.hours > (account.budget - account.usedHours);

  const onSaveSection = useCallback((key, val) => {
    const updated = {...brief,[key]:val};
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,brief:{...session.brief,current:updated}}});
  },[brief, session, dispatch]);

  const handleRevision = useCallback(async () => {
    if(!revNote.trim()) return;
    setLoading(true);
    try {
      const sys = `You are a senior marketing strategist. Revise the brief based on revision notes. Return JSON with keys: objective, keyMessages (array), deliverables (array), constraints (object), brandNotes, rationale. ONLY valid JSON.`;
      const usr = `Account: ${account.name}\nScope: ${account.scope}\nBrand: ${account.brand}\n\nMeeting notes:\n${session.intake.problems}\n${session.intake.requests}\n${session.intake.notes}\n\nCurrent brief:\n${JSON.stringify(brief)}\n\nRevision:\n${revNote}`;
      const revised = await callAPI(sys, usr);
      const hist = [...session.brief.history,{date:new Date().toISOString(),note:revNote,brief:{...brief}}];
      dispatch({type:"UPDATE_SESSION",payload:{id:session.id,brief:{current:revised,history:hist}}});
      dispatch({type:"ADD_TOAST",payload:{msg:"Brief revised",type:"success"}});
      setRevNote(""); setShowRev(false);
    } catch(e) { dispatch({type:"ADD_TOAST",payload:{msg:"Revision failed",type:"error"}}); }
    setLoading(false);
  },[revNote, account, session, brief, dispatch]);

  const handleApprove = useCallback(async () => {
    setTaskLoading(true);
    try {
      const [sys,usr] = buildTaskPrompts(account, brief, team);
      const tasks = await callAPI(sys, usr);
      const mapped = tasks.map(t=>({...t,id:uid(),status:"pending",revisionNote:"",rejectReason:""}));
      dispatch({type:"UPDATE_SESSION",payload:{id:session.id,stage:"tasks",tasks:mapped}});
      dispatch({type:"SET_VIEW",payload:"tasks"});
      dispatch({type:"ADD_TOAST",payload:{msg:"Tasks generated",type:"success"}});
    } catch(e) { dispatch({type:"ADD_TOAST",payload:{msg:"Task generation failed: "+e.message,type:"error"}}); }
    setTaskLoading(false);
  },[account, brief, team, session, dispatch]);

  const sections = [
    {key:"objective",label:"Objective"},{key:"keyMessages",label:"Key Messages"},{key:"deliverables",label:"Deliverables"},
    {key:"constraints",label:"Constraints"},{key:"brandNotes",label:"Brand Notes"},{key:"rationale",label:"Rationale"},
  ];

  return <div style={{maxWidth:700,margin:"0 auto",padding:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{fontSize:20,fontWeight:700,margin:0}}>Marketing Brief</h2><p style={{fontSize:13,color:"#666",margin:"4px 0 0"}}>Review, edit, and approve</p></div>
      {session.brief.history.length>0 && <button onClick={()=>setShowHist(!showHist)} style={{fontSize:12,border:"1px solid #d1d5db",borderRadius:6,padding:"5px 12px",cursor:"pointer",background:"transparent",color:"#333"}}>History ({session.brief.history.length})</button>}
    </div>
    {budgetWarn && <div style={{padding:"10px 14px",background:"#993C1D18",color:"#993C1D",borderRadius:8,fontSize:13,marginBottom:12}}>⚠ Estimated hours exceed remaining budget</div>}
    {showHist && <div style={{marginBottom:16,padding:12,background:"#f5f5f5",borderRadius:8,border:"1px solid #e5e7eb"}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Revision History</div>
      {session.brief.history.map((h,i)=><div key={i} style={{fontSize:12,padding:"6px 0",borderBottom:"1px solid #e5e7eb"}}><strong>{new Date(h.date).toLocaleString()}</strong>: {h.note}</div>)}
    </div>}
    {sections.map(s=><BriefSection key={s.key} sKey={s.key} label={s.label} value={brief[s.key]} onSave={onSaveSection}/>)}
    <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end",flexWrap:"wrap"}}>
      <button onClick={()=>setShowRev(!showRev)} style={S.btnDanger}>Request revision</button>
      <button onClick={handleApprove} disabled={taskLoading} style={{...S.btnPrimary,background:taskLoading?"#aaa":"#0F6E56",cursor:taskLoading?"wait":"pointer"}}>{taskLoading?"Generating tasks...":"Approve & generate tasks →"}</button>
    </div>
    {taskLoading && <div style={{marginTop:12}}><PulseBar label="Splitting brief into tasks..."/></div>}
    {showRev && <div style={{marginTop:12,padding:16,background:"#f9f9f9",borderRadius:8,border:"1.5px solid #993C1D"}}>
      <label style={{fontSize:12,fontWeight:600,display:"block",marginBottom:6}}>Revision notes</label>
      <textarea value={revNote} onChange={e=>setRevNote(e.target.value)} rows={3} style={{...S.inp,resize:"vertical"}} placeholder="What needs changing..."/>
      <button onClick={handleRevision} disabled={loading} style={{marginTop:8,padding:"8px 20px",borderRadius:6,border:"none",background:loading?"#aaa":"#993C1D",color:"#fff",fontWeight:600,fontSize:13,cursor:loading?"wait":"pointer"}}>{loading?"Revising...":"Submit revision"}</button>
      {loading && <div style={{marginTop:8}}><PulseBar label="Revising brief..."/></div>}
    </div>}
  </div>;
});

// --- Stage 3: Tasks ---
const TaskCard = memo(function TaskCard({task, onUpdate}) {
  const [revNote, setRevNote] = useState(task.revisionNote||"");
  const sc = {approved:"#0F6E56",revision:"#C97A2E",rejected:"#993C1D",pending:"#999"};
  const bc = {approved:"#0F6E5630",revision:"#C97A2E30",rejected:"#993C1D30",pending:"#d1d5db"};
  return <div style={{padding:14,borderRadius:8,border:`1.5px solid ${bc[task.status]}`,marginBottom:8,background:"#fff",opacity:task.status==="rejected"?.5:1}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
      <div><span style={{fontWeight:600,fontSize:14}}>{task.name}</span><span style={{marginLeft:8,fontSize:11,padding:"2px 8px",borderRadius:10,background:sc[task.status]+"18",color:sc[task.status],fontWeight:600}}>{task.status}</span></div>
      <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:task.priority==="High"?"#993C1D18":task.priority==="Medium"?"#C97A2E18":"#f3f4f6",color:task.priority==="High"?"#993C1D":task.priority==="Medium"?"#C97A2E":"#666",fontWeight:600}}>{task.priority}</span>
    </div>
    <p style={{fontSize:13,color:"#555",margin:"0 0 8px",lineHeight:1.5}}>{task.description}</p>
    <div style={{display:"flex",gap:16,fontSize:12,color:"#777",flexWrap:"wrap"}}>
      <span>{task.hours}h</span><span>Due: {fmtDate(task.due)}</span><span>→ {task.assignee}</span><span>Sign-off: {task.signoff}</span>{task.channel&&<span>📢 {task.channel}</span>}
    </div>
    {task.status==="revision" && <div style={{marginTop:8,padding:8,background:"#C97A2E08",borderRadius:6}}>
      <input value={revNote} onChange={e=>setRevNote(e.target.value)} placeholder="Revision note..." style={{...S.inp,border:"1px solid #C97A2E40",fontSize:12,padding:"6px 8px"}}/>
    </div>}
    {task.status!=="rejected" && <div style={{display:"flex",gap:6,marginTop:10}}>
      {task.status!=="approved"&&<button onClick={()=>onUpdate(task.id,{status:"approved"})} style={{...S.btnSmall,background:"#0F6E56",color:"#fff"}}>Approve</button>}
      {task.status!=="revision"&&<button onClick={()=>onUpdate(task.id,{status:"revision"})} style={{...S.btnSmall,border:"1px solid #C97A2E",background:"transparent",color:"#C97A2E"}}>Revise</button>}
      <button onClick={()=>onUpdate(task.id,{status:"rejected"})} style={{...S.btnSmall,border:"1px solid #993C1D",background:"transparent",color:"#993C1D"}}>Reject</button>
    </div>}
  </div>;
});

const TasksView = memo(function TasksView({session, account, team, dispatch}) {
  if(!session) return <div style={{padding:24}}>No active session.</div>;
  const tasks = session.tasks;
  const [loading, setLoading] = useState(false);

  const counts = useMemo(()=>{
    let a=0,r=0,j=0,p=0;
    for(const t of tasks){if(t.status==="approved")a++;else if(t.status==="revision")r++;else if(t.status==="rejected")j++;else p++;}
    return {approved:a,revision:r,rejected:j,pending:p};
  },[tasks]);

  const updateTask = useCallback((id, updates) => {
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,tasks:tasks.map(t=>t.id===id?{...t,...updates}:t)}});
  },[session.id, tasks, dispatch]);

  const bulkAction = useCallback((type, status) => {
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,tasks:tasks.map(t=>t.type===type?{...t,status}:t)}});
  },[session.id, tasks, dispatch]);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    try {
      const [sys,usr] = buildTaskPrompts(account, session.brief.current, team);
      const newTasks = await callAPI(sys, usr);
      const merged = tasks.map(t=>{
        if(t.status==="revision"){
          const rep = newTasks.find(nt=>nt.type===t.type);
          if(rep) return {...rep,id:t.id,status:"pending",revisionNote:"",rejectReason:""};
        }
        return t;
      });
      dispatch({type:"UPDATE_SESSION",payload:{id:session.id,tasks:merged}});
      dispatch({type:"ADD_TOAST",payload:{msg:"Revised tasks regenerated",type:"success"}});
    } catch(e) { dispatch({type:"ADD_TOAST",payload:{msg:"Regeneration failed",type:"error"}}); }
    setLoading(false);
  },[account, session, tasks, team, dispatch]);

  const proceedToReview = useCallback(() => {
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,stage:"review"}});
    dispatch({type:"SET_VIEW",payload:"review"});
  },[session.id, dispatch]);

  const grouped = useMemo(()=>TASK_TYPES.map(type=>({type,items:tasks.filter(t=>t.type===type)})).filter(g=>g.items.length),[tasks]);

  return <div style={{maxWidth:800,margin:"0 auto",padding:24}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Task List</h2>
    <div style={{display:"flex",gap:16,marginBottom:20,fontSize:13}}>
      <span style={{color:"#0F6E56",fontWeight:600}}>{counts.approved} approved</span>
      <span style={{color:"#C97A2E",fontWeight:600}}>{counts.revision} revision</span>
      <span style={{color:"#993C1D",fontWeight:600}}>{counts.rejected} rejected</span>
      <span style={{color:"#999"}}>{counts.pending} pending</span>
    </div>
    {counts.revision>0 && <button onClick={handleRegenerate} disabled={loading} style={{marginBottom:16,padding:"8px 20px",borderRadius:8,border:"1.5px solid #C97A2E",background:"#C97A2E12",color:"#C97A2E",fontWeight:600,fontSize:13,cursor:"pointer"}}>{loading?"Regenerating...":"Regenerate revised tasks"}</button>}
    {grouped.map(g=><div key={g.type} style={{marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:14,fontWeight:700}}>{g.type} <span style={{fontWeight:400,color:"#888"}}>({g.items.length})</span></span>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>bulkAction(g.type,"approved")} style={{fontSize:11,padding:"3px 10px",borderRadius:4,border:"1px solid #0F6E56",background:"transparent",color:"#0F6E56",cursor:"pointer"}}>Approve all</button>
          <button onClick={()=>bulkAction(g.type,"rejected")} style={{fontSize:11,padding:"3px 10px",borderRadius:4,border:"1px solid #993C1D",background:"transparent",color:"#993C1D",cursor:"pointer"}}>Reject all</button>
        </div>
      </div>
      {g.items.map(t=><TaskCard key={t.id} task={t} onUpdate={updateTask}/>)}
    </div>)}
    {counts.pending===0 && <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
      <button onClick={proceedToReview} style={S.btnPrimary}>Proceed to review →</button>
    </div>}
  </div>;
});

// --- Stage 4: Review ---
const ReviewView = memo(function ReviewView({session, account, bmsColumns, dispatch}) {
  if(!session) return <div style={{padding:24}}>No active session.</div>;
  const approved = useMemo(()=>session.tasks.filter(t=>t.status==="approved"),[session.tasks]);
  const totalHours = useMemo(()=>approved.reduce((s,t)=>s+t.hours,0),[approved]);
  const byType = useMemo(()=>TASK_TYPES.map(type=>{const items=approved.filter(t=>t.type===type);return {type,hours:items.reduce((s,t)=>s+t.hours,0),count:items.length}}).filter(g=>g.count>0),[approved]);
  const overBudget = totalHours > (account.budget - account.usedHours);
  const cols = useMemo(()=>bmsColumns.filter(c=>c.enabled),[bmsColumns]);

  const exportCSV = useCallback(() => {
    const header = cols.map(c=>c.label).join(",");
    const rows = approved.map(t=>cols.map(c=>{
      const src=c.source;
      if(src==="task.name") return `"${t.name}"`;
      if(src==="task.type") return `"${t.type}"`;
      if(src==="task.description") return `"${(t.description||"").replace(/"/g,'""')}"`;
      if(src==="task.assignee") return `"${t.assignee}"`;
      if(src==="today") return today();
      if(src==="task.due") return t.due;
      if(src==="task.hours") return t.hours;
      if(src==="task.signoff") return `"${t.signoff}"`;
      if(src==="account.name") return `"${account.name}"`;
      if(src==="task.priority") return `"${t.priority}"`;
      if(src.startsWith("default:")) return `"${src.split(":")[1]}"`;
      if(src==="task.channel") return `"${t.channel||""}"`;
      return "";
    }).join(","));
    const csv = [header,...rows].join("\n");
    const fn = `${account.name.replace(/\s+/g,"")}_${today()}_tasks.csv`;
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=fn; a.click();
    URL.revokeObjectURL(url);
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,export:{timestamp:new Date().toISOString(),filename:fn,rowCount:approved.length}}});
    dispatch({type:"ADD_TOAST",payload:{msg:`Exported ${approved.length} tasks`,type:"success"}});
  },[cols, approved, account, session.id, dispatch]);

  const proceed = useCallback(() => {
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,stage:"publish"}});
    dispatch({type:"SET_VIEW",payload:"publish"});
  },[session.id, dispatch]);

  return <div style={{maxWidth:800,margin:"0 auto",padding:24}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Review & Export</h2>
    {overBudget && <div style={{padding:"10px 14px",background:"#993C1D18",color:"#993C1D",borderRadius:8,fontSize:13,marginBottom:16}}>⚠ Approved hours ({totalHours}h) exceed remaining budget ({account.budget-account.usedHours}h)</div>}
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
      {byType.map(g=><div key={g.type} style={{padding:"10px 16px",background:"#f5f5f5",borderRadius:8,flex:1,minWidth:120,border:"1px solid #e5e7eb"}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.5,opacity:.6,marginBottom:4}}>{g.type}</div>
        <div style={{fontSize:20,fontWeight:700}}>{g.hours}h</div>
        <div style={{fontSize:12,opacity:.5}}>{g.count} tasks</div>
      </div>)}
      <div style={{padding:"10px 16px",background:overBudget?"#993C1D12":"#0F6E5612",borderRadius:8,flex:1,minWidth:120,border:`1px solid ${overBudget?"#993C1D30":"#0F6E5630"}`}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.5,opacity:.6,marginBottom:4}}>Total</div>
        <div style={{fontSize:20,fontWeight:700,color:overBudget?"#993C1D":"#0F6E56"}}>{totalHours}h</div>
        <div style={{fontSize:12,opacity:.5}}>of {account.budget-account.usedHours}h remaining</div>
      </div>
    </div>
    <div style={{overflowX:"auto",marginBottom:20}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"2px solid #d1d5db"}}>
          {["Name","Type","Hours","Due","Assignee","Channel","Priority"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",fontSize:11,textTransform:"uppercase",letterSpacing:.5,fontWeight:600,color:"#888"}}>{h}</th>)}
        </tr></thead>
        <tbody>{approved.map(t=><tr key={t.id} style={{borderBottom:"1px solid #e5e7eb"}}>
          <td style={{padding:"8px 10px",fontWeight:500}}>{t.name}</td>
          <td style={{padding:"8px 10px"}}>{t.type}</td>
          <td style={{padding:"8px 10px"}}>{t.hours}</td>
          <td style={{padding:"8px 10px"}}>{fmtDate(t.due)}</td>
          <td style={{padding:"8px 10px"}}>{t.assignee}</td>
          <td style={{padding:"8px 10px"}}>{t.channel||"—"}</td>
          <td style={{padding:"8px 10px"}}>{t.priority}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <button onClick={exportCSV} style={S.btnSecondary}>Export CSV for BMS</button>
      <button onClick={proceed} style={S.btnPrimary}>Proceed to publish →</button>
    </div>
    {session.export && <div style={{marginTop:12,fontSize:12,color:"#888"}}>Last export: {new Date(session.export.timestamp).toLocaleString()} — {session.export.rowCount} tasks</div>}
  </div>;
});

// --- Stage 5: Publish ---
const PublishView = memo(function PublishView({session, channels, dispatch}) {
  if(!session) return <div style={{padding:24}}>No active session.</div>;
  const approved = useMemo(()=>session.tasks.filter(t=>t.status==="approved"),[session.tasks]);
  const activeChannels = useMemo(()=>channels.filter(c=>c.active),[channels]);
  const [selCh, setSelCh] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [pushing, setPushing] = useState(null);
  const pushLog = session.pushLog||[];
  const isPushed = id => pushLog.some(l=>l.taskId===id&&l.status==="success");

  const handlePush = useCallback(async (task) => {
    setPushing(task.id); setConfirm(null);
    await new Promise(r=>setTimeout(r,1500));
    const ok = Math.random()>0.15;
    const entry = {taskId:task.id,taskName:task.name,channel:selCh[task.id]||"Draft",timestamp:new Date().toISOString(),status:ok?"success":"failed"};
    dispatch({type:"UPDATE_SESSION",payload:{id:session.id,pushLog:[...pushLog,entry]}});
    dispatch({type:"ADD_TOAST",payload:{msg:ok?`Pushed "${task.name}"`:`Push failed for "${task.name}"`,type:ok?"success":"error"}});
    setPushing(null);
  },[selCh, session.id, pushLog, dispatch]);

  return <div style={{maxWidth:800,margin:"0 auto",padding:24}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Publish</h2>
    <p style={{fontSize:13,color:"#666",marginBottom:20}}>Push approved content to channels (all default to draft)</p>
    {approved.map(t=>{
      const pushed = isPushed(t.id);
      const log = pushLog.filter(l=>l.taskId===t.id).pop();
      return <div key={t.id} style={{...S.card,border:`1.5px solid ${pushed?"#0F6E5630":"#e5e7eb"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontWeight:600,fontSize:14}}>{t.name}</span>
          {pushed && <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#0F6E5618",color:"#0F6E56",fontWeight:600}}>Pushed to {log?.channel}</span>}
          {log?.status==="failed" && <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#993C1D18",color:"#993C1D",fontWeight:600}}>Failed</span>}
        </div>
        <p style={{fontSize:13,color:"#555",margin:"0 0 10px"}}>{t.description}</p>
        {!pushed && <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={selCh[t.id]||""} onChange={e=>setSelCh(s=>({...s,[t.id]:e.target.value}))} style={{...S.inp,width:"auto",minWidth:160}}>
            <option value="">Select channel...</option>
            {activeChannels.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button onClick={()=>setConfirm(t)} disabled={!selCh[t.id]||pushing===t.id} style={{...S.btnSmall,background:pushing===t.id?"#aaa":"#0F6E56",color:"#fff",padding:"6px 16px"}}>{pushing===t.id?"Pushing...":"Push"}</button>
        </div>}
      </div>;
    })}
    {confirm && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={()=>setConfirm(null)}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:24,maxWidth:400,width:"90%"}}>
        <h3 style={{margin:"0 0 12px",fontSize:16}}>Confirm push</h3>
        <p style={{fontSize:13,margin:"0 0 6px"}}><strong>Task:</strong> {confirm.name}</p>
        <p style={{fontSize:13,margin:"0 0 6px"}}><strong>Channel:</strong> {selCh[confirm.id]}</p>
        <p style={{fontSize:13,margin:"0 0 16px"}}><strong>Mode:</strong> Draft</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setConfirm(null)} style={{...S.btnSmall,border:"1px solid #d1d5db",background:"transparent",color:"#333",padding:"8px 16px"}}>Cancel</button>
          <button onClick={()=>handlePush(confirm)} style={{...S.btnSmall,background:"#0F6E56",color:"#fff",padding:"8px 20px"}}>Confirm</button>
        </div>
      </div>
    </div>}
  </div>;
});

// --- Settings ---
const AccountSettings = memo(function AccountSettings({accounts, dispatch}) {
  const [editId, setEditId] = useState(null);
  return <div>
    {accounts.map(a=><div key={a.id} style={{...S.card}}>
      {editId===a.id ? <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={S.lbl}>Name</label><input value={a.name} onChange={e=>dispatch({type:"UPDATE_ACCOUNT",payload:{id:a.id,name:e.target.value}})} style={S.inp}/></div>
          <div><label style={S.lbl}>Budget (hours/mo)</label><input type="number" value={a.budget} onChange={e=>dispatch({type:"UPDATE_ACCOUNT",payload:{id:a.id,budget:+e.target.value}})} style={S.inp}/></div>
        </div>
        <div><label style={S.lbl}>Scope</label><textarea value={a.scope} onChange={e=>dispatch({type:"UPDATE_ACCOUNT",payload:{id:a.id,scope:e.target.value}})} rows={2} style={{...S.inp,resize:"vertical"}}/></div>
        <div><label style={S.lbl}>Roadmap</label><textarea value={a.roadmap} onChange={e=>dispatch({type:"UPDATE_ACCOUNT",payload:{id:a.id,roadmap:e.target.value}})} rows={2} style={{...S.inp,resize:"vertical"}}/></div>
        <div><label style={S.lbl}>Brand guidelines</label><textarea value={a.brand} onChange={e=>dispatch({type:"UPDATE_ACCOUNT",payload:{id:a.id,brand:e.target.value}})} rows={2} style={{...S.inp,resize:"vertical"}}/></div>
        <button onClick={()=>setEditId(null)} style={{...S.btnSmall,background:"#534AB7",color:"#fff",alignSelf:"flex-start",padding:"6px 16px"}}>Done</button>
      </div> : <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",gap:3}}>{(a.colors||[]).map((c,i)=><span key={i} style={{width:14,height:14,borderRadius:3,background:c}}/>)}</div>
          <span style={{fontWeight:600}}>{a.name}</span>
          <span style={{fontSize:12,color:"#888"}}>{a.budget}h/mo</span>
        </div>
        <button onClick={()=>setEditId(a.id)} style={{fontSize:12,border:"1px solid #d1d5db",borderRadius:6,padding:"4px 12px",cursor:"pointer",background:"transparent",color:"#333"}}>Edit</button>
      </div>}
    </div>)}
  </div>;
});

const ChannelSettings = memo(function ChannelSettings({channels, dispatch}) {
  const [editId, setEditId] = useState(null);
  return <div>
    {channels.map(c=><div key={c.id} style={{...S.card}}>
      {editId===c.id ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={S.lbl}>Name</label><input value={c.name} onChange={e=>dispatch({type:"UPDATE_CHANNEL",payload:{id:c.id,name:e.target.value}})} style={S.inp}/></div>
          <div><label style={S.lbl}>Type</label><select value={c.type} onChange={e=>dispatch({type:"UPDATE_CHANNEL",payload:{id:c.id,type:e.target.value}})} style={S.inp}>{CHANNEL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
        <div><label style={S.lbl}>MCP Server URL</label><input value={c.url} onChange={e=>dispatch({type:"UPDATE_CHANNEL",payload:{id:c.id,url:e.target.value}})} style={S.inp} placeholder="https://..."/></div>
        <button onClick={()=>setEditId(null)} style={{...S.btnSmall,background:"#534AB7",color:"#fff",alignSelf:"flex-start",padding:"6px 16px"}}>Done</button>
      </div> : <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:c.connected?"#0F6E56":"#ccc"}}/>
          <span style={{fontWeight:600,fontSize:13}}>{c.name}</span>
          <span style={{fontSize:11,color:"#888"}}>{c.type}</span>
        </div>
        <button onClick={()=>setEditId(c.id)} style={{fontSize:12,border:"1px solid #d1d5db",borderRadius:6,padding:"4px 12px",cursor:"pointer",background:"transparent",color:"#333"}}>Edit</button>
      </div>}
    </div>)}
    <button onClick={()=>{const id=uid();dispatch({type:"ADD_CHANNEL",payload:{id,name:"New Channel",type:"WordPress",url:"",connected:false,defaultBehaviour:"Draft",linkedAccounts:[],active:true}});setEditId(id)}} style={{padding:"8px 16px",borderRadius:6,border:"1.5px dashed #d1d5db",background:"transparent",fontSize:13,cursor:"pointer",width:"100%",color:"#888"}}>+ Add channel</button>
  </div>;
});

const TeamSettings = memo(function TeamSettings({team, dispatch}) {
  const [local, setLocal] = useState(team);
  const save = ()=>{dispatch({type:"UPDATE_TEAM",payload:local});dispatch({type:"ADD_TOAST",payload:{msg:"Team updated",type:"success"}})};
  return <div>
    {local.map((m,i)=><div key={m.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 40px",gap:8,marginBottom:6}}>
      <input value={m.name} onChange={e=>{const t=[...local];t[i]={...t[i],name:e.target.value};setLocal(t)}} style={S.inp} placeholder="Name"/>
      <input value={m.role} onChange={e=>{const t=[...local];t[i]={...t[i],role:e.target.value};setLocal(t)}} style={S.inp} placeholder="Role"/>
      <input value={m.email} onChange={e=>{const t=[...local];t[i]={...t[i],email:e.target.value};setLocal(t)}} style={S.inp} placeholder="Email"/>
      <button onClick={()=>setLocal(local.filter((_,j)=>j!==i))} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:16,color:"#993C1D"}}>×</button>
    </div>)}
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <button onClick={()=>setLocal([...local,{id:uid(),name:"",role:"",email:""}])} style={{padding:"6px 14px",borderRadius:6,border:"1.5px dashed #d1d5db",background:"transparent",fontSize:12,cursor:"pointer",color:"#888"}}>+ Add</button>
      <button onClick={save} style={{...S.btnSmall,background:"#534AB7",color:"#fff",padding:"6px 14px"}}>Save</button>
    </div>
  </div>;
});

const BMSSettings = memo(function BMSSettings({bms, dispatch}) {
  const [cols, setCols] = useState(bms.columns);
  const save = ()=>{dispatch({type:"UPDATE_BMS",payload:{columns:cols}});dispatch({type:"ADD_TOAST",payload:{msg:"BMS mapping saved",type:"success"}})};
  return <div>
    <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"#888"}}>Column mapping</div>
    {cols.map((c,i)=><div key={c.key} style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 60px",gap:8,marginBottom:4,alignItems:"center"}}>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <button disabled={i===0} onClick={()=>{const n=[...cols];[n[i-1],n[i]]=[n[i],n[i-1]];setCols(n)}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:10,padding:0}}>▲</button>
        <button disabled={i===cols.length-1} onClick={()=>{const n=[...cols];[n[i],n[i+1]]=[n[i+1],n[i]];setCols(n)}} style={{border:"none",background:"transparent",cursor:"pointer",fontSize:10,padding:0}}>▼</button>
      </div>
      <input value={c.label} onChange={e=>{const n=[...cols];n[i]={...n[i],label:e.target.value};setCols(n)}} style={{...S.inp,padding:"5px 8px",fontSize:12}}/>
      <span style={{fontSize:12,color:"#888"}}>{c.source}</span>
      <label style={{fontSize:12,display:"flex",alignItems:"center",gap:4}}><input type="checkbox" checked={c.enabled} onChange={e=>{const n=[...cols];n[i]={...n[i],enabled:e.target.checked};setCols(n)}}/> On</label>
    </div>)}
    <div style={{display:"flex",gap:8,marginTop:12}}>
      <button onClick={save} style={{...S.btnSmall,background:"#534AB7",color:"#fff",padding:"6px 14px"}}>Save</button>
      <button onClick={()=>setCols(DEFAULT_BMS)} style={{...S.btnSmall,border:"1px solid #d1d5db",background:"transparent",color:"#333",padding:"6px 14px"}}>Reset</button>
    </div>
  </div>;
});

const SettingsView = memo(function SettingsView({state, dispatch}) {
  const view = state.currentView;
  const tabs = [{key:"settings/accounts",label:"Accounts"},{key:"settings/channels",label:"Channels"},{key:"settings/team",label:"Team"},{key:"settings/templates",label:"Templates"},{key:"settings/bms",label:"BMS Export"}];

  const exportSettings = useCallback(()=>{
    const blob = new Blob([JSON.stringify(state.settings,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="shoothill-settings.json"; a.click();
    URL.revokeObjectURL(url);
  },[state.settings]);

  const importSettings = useCallback((e)=>{
    const f=e.target.files[0];
    if(f){const r=new FileReader();r.onload=()=>{try{dispatch({type:"IMPORT_SETTINGS",payload:JSON.parse(r.result)})}catch(err){dispatch({type:"ADD_TOAST",payload:{msg:"Invalid file",type:"error"}})}};r.readAsText(f)}
  },[dispatch]);

  return <div style={{maxWidth:800,margin:"0 auto",padding:24}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Settings</h2>
    <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
      {tabs.map(t=><button key={t.key} onClick={()=>dispatch({type:"SET_VIEW",payload:t.key})} style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${view===t.key?"#534AB7":"#d1d5db"}`,background:view===t.key?"#534AB712":"transparent",color:view===t.key?"#534AB7":"#555",fontWeight:view===t.key?600:400,fontSize:13,cursor:"pointer"}}>{t.label}</button>)}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      <button onClick={exportSettings} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #d1d5db",background:"transparent",fontSize:12,cursor:"pointer",color:"#555"}}>Export settings</button>
      <label style={{padding:"6px 14px",borderRadius:6,border:"1px solid #d1d5db",background:"transparent",fontSize:12,cursor:"pointer",color:"#555"}}>Import<input type="file" accept=".json" style={{display:"none"}} onChange={importSettings}/></label>
    </div>
    {view==="settings/accounts"&&<AccountSettings accounts={state.settings.accounts} dispatch={dispatch}/>}
    {view==="settings/channels"&&<ChannelSettings channels={state.settings.channels} dispatch={dispatch}/>}
    {view==="settings/team"&&<TeamSettings team={state.settings.team} dispatch={dispatch}/>}
    {view==="settings/templates"&&<div style={{fontSize:13,color:"#888"}}>Brief and task templates — coming soon. Default prompts used for all accounts.</div>}
    {view==="settings/bms"&&<BMSSettings bms={state.settings.bms} dispatch={dispatch}/>}
    {view==="settings"&&<div style={{fontSize:14,color:"#888"}}>Select a category above.</div>}
  </div>;
});

// --- Main App ---
export default function App() {
  const [state, dispatch] = useReducer(reducer, initState);

  const session = useMemo(()=>state.sessions.find(s=>s.id===state.activeSessionId),[state.sessions, state.activeSessionId]);
  const account = useMemo(()=>state.settings.accounts.find(a=>a.id===state.selectedAccountId),[state.settings.accounts, state.selectedAccountId]);
  const activeAccounts = useMemo(()=>state.settings.accounts.filter(a=>a.active),[state.settings.accounts]);
  const stageIndex = session ? STAGES.indexOf(session.stage) : -1;

  const renderView = () => {
    const v = state.currentView;
    if(v.startsWith("settings")) return <SettingsView state={state} dispatch={dispatch}/>;
    switch(v) {
      case "brief": return <BriefView session={session} account={account} team={state.settings.team} dispatch={dispatch}/>;
      case "tasks": return <TasksView session={session} account={account} team={state.settings.team} dispatch={dispatch}/>;
      case "review": return <ReviewView session={session} account={account} bmsColumns={state.settings.bms.columns} dispatch={dispatch}/>;
      case "publish": return <PublishView session={session} channels={state.settings.channels} dispatch={dispatch}/>;
      default: return <IntakeView account={account} team={state.settings.team} dispatch={dispatch}/>;
    }
  };

  return <div style={{display:"flex",height:"100vh",fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,sans-serif",color:"#111",background:"#f8f9fa"}}>
    <Sidebar selectedAccountId={state.selectedAccountId} accounts={activeAccounts} activeSession={session} currentView={state.currentView} dispatch={dispatch}/>
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <TopBar accountName={account?.name||"Select account"} currentView={state.currentView} userName={state.userName}/>
      {session && <StageBar stageIndex={stageIndex}/>}
      <div style={{flex:1,overflow:"auto"}}>{renderView()}</div>
    </div>
    <Toasts toasts={state.toasts} dispatch={dispatch}/>
  </div>;
}
