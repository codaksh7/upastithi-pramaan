import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  Scan, Play, Square, Users, CheckCircle2, AlertTriangle,
  Download, BarChart2, Settings, LogOut, Wifi, Camera,
  Clock, Eye, ChevronRight, Bell, Search, Activity,
  Filter, FileText, Shield, TrendingUp, Menu, X
} from 'lucide-react';
import './FacultyDashboard.css';

const STUDENTS = [
  { roll:'10268', name:'Devansh Nayak',    face:true,  mac:true,  time:'10:32 AM', conf:94.1 },
  { roll:'10275', name:'Blaise Rodrigues', face:true,  mac:true,  time:'10:33 AM', conf:97.3 },
  { roll:'10283', name:'Daksh Thakkar',    face:true,  mac:true,  time:'10:33 AM', conf:91.8 },
  { roll:'10287', name:'Aryan Verma',      face:true,  mac:false, time:'—',        conf:88.4 },
  { roll:'10290', name:'Priya Mehta',      face:false, mac:false, time:'—',        conf:null  },
  { roll:'10292', name:'Rahul Sharma',     face:true,  mac:true,  time:'10:35 AM', conf:95.2 },
  { roll:'10294', name:'Sneha Patil',      face:true,  mac:true,  time:'10:36 AM', conf:89.7 },
  { roll:'10296', name:'Aditya Kulkarni',  face:false, mac:true,  time:'—',        conf:null  },
];

const NAV = [
  { id:'live',       icon:<Activity  size={17}/>, label:'Live Session' },
  { id:'attendance', icon:<Users     size={17}/>, label:'Attendance'   },
  { id:'analytics',  icon:<BarChart2 size={17}/>, label:'Analytics'    },
  { id:'reports',    icon:<FileText  size={17}/>, label:'Reports'      },
  { id:'settings',   icon:<Settings  size={17}/>, label:'Settings'     },
];

function StatusBadge({ face, mac }) {
  if (face && mac)   return <span className="fd__badge fd__badge-green"><CheckCircle2 size={9}/>Present</span>;
  if (face && !mac)  return <span className="fd__badge fd__badge-amber"><AlertTriangle size={9}/>No Device</span>;
  if (!face && mac)  return <span className="fd__badge fd__badge-amber"><Eye size={9}/>No Face</span>;
  return               <span className="fd__badge fd__badge-red"><AlertTriangle size={9}/>Absent</span>;
}

function Sparkline({ data, color }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v,i) => `${(i/(data.length-1))*100},${100-((v-min)/(max-min+1))*80}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" style={{width:72,height:28}} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const [tab,        setTab]        = useState('live');
  const [session,    setSession]    = useState(false);
  const [timer,      setTimer]      = useState(0);
  const [students,   setStudents]   = useState(STUDENTS);
  const [query,      setQuery]      = useState('');
  const [sidebarOpen,setSidebarOpen]= useState(false);
  const sidebarRef = useRef(null);
  const mainRef    = useRef(null);
  const timerRef   = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(sidebarRef.current, {x:-60,opacity:0},{x:0,opacity:1,duration:0.55,ease:'power3.out'})
      .fromTo(mainRef.current,    {opacity:0,y:18}, {opacity:1,y:0,duration:0.55,ease:'power2.out'},'-=0.3')
      .fromTo('.fd__stat-tile',   {opacity:0,y:20}, {opacity:1,y:0,duration:0.4,stagger:0.07,ease:'power2.out'},'-=0.25');
  }, []);

  useEffect(() => {
    gsap.fromTo('.fd__tab-content', {opacity:0,y:14},{opacity:1,y:0,duration:0.38,ease:'power2.out'});
  }, [tab]);

  useEffect(() => {
    if (session) { timerRef.current = setInterval(() => setTimer(t => t+1), 1000); }
    else         { clearInterval(timerRef.current); }
    return ()    => clearInterval(timerRef.current);
  }, [session]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const present = students.filter(s=>s.face&&s.mac).length;
  const pending = students.filter(s=>(s.face&&!s.mac)||(!s.face&&s.mac)).length;
  const absent  = students.filter(s=>!s.face&&!s.mac).length;
  const filtered = students.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())||s.roll.includes(query));

  const override = (roll) => setStudents(prev=>prev.map(s=>
    s.roll===roll ? {...s,face:true,mac:true,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} : s
  ));

  const STATS = [
    {label:'Present',  val:present, sub:`/${students.length}`, color:'var(--green)', icon:<CheckCircle2 size={17}/>, data:[32,38,35,40,42,38,present]},
    {label:'Pending',  val:pending, sub:'',                    color:'var(--amber)', icon:<AlertTriangle size={17}/>,data:[4,3,5,2,3,4,pending]},
    {label:'Absent',   val:absent,  sub:`/${students.length}`, color:'var(--red)',   icon:<Eye size={17}/>,           data:[12,10,14,8,10,11,absent]},
    {label:'Enrolled', val:students.length, sub:'total',       color:'var(--cyan)',  icon:<Users size={17}/>,          data:[60,60,62,62,62,62,students.length]},
  ];

  return (
    <div className="fd__shell">

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fd__sidebar-overlay" onClick={()=>setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside ref={sidebarRef} className={`fd__sidebar${sidebarOpen?' fd__sidebar-open':''}`}>
        <div className="fd__sidebar-logo">
          <div className="fd__sidebar-logo-icon"><Scan size={14} color="var(--cyan)"/></div>
          <div className="fd__sidebar-logo-text">
            <div className="fd__sidebar-logo-name">UPASTITHI</div>
            <div className="fd__sidebar-logo-sub">FACULTY PANEL</div>
          </div>
        </div>

        <div className="fd__sidebar-profile">
          <div className="fd__sidebar-avatar">PS</div>
          <div className="fd__sidebar-profile-info">
            <div className="fd__sidebar-profile-name">Prof. Sharma</div>
            <div className="fd__sidebar-profile-id">EMP-2024-042 · Comp Dept</div>
          </div>
        </div>

        <nav className="fd__sidebar-nav">
          {NAV.map(item=>(
            <button key={item.id}
              className={`fd__sidebar-nav-btn${tab===item.id?' fd__active':''}`}
              onClick={()=>{setTab(item.id);setSidebarOpen(false);}}>
              <span className="fd__sidebar-nav-icon">{item.icon}</span>
              <span className="fd__sidebar-nav-label">{item.label}</span>
              {tab===item.id && <ChevronRight size={12} className="fd__sidebar-nav-chevron"/>}
            </button>
          ))}
        </nav>

        <div className="fd__sidebar-footer">
          <button className="fd__sidebar-logout" onClick={()=>navigate('/')}>
            <LogOut size={14}/><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main ref={mainRef} className="fd__main">

        {/* Topbar */}
        <div className="fd__topbar">
          <div className="fd__topbar-left">
            <div className="fd__topbar-title">{NAV.find(n=>n.id===tab)?.label}</div>
            <div className="fd__topbar-date">{new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          </div>
          <div className="fd__topbar-right">
            {session && <span className="fd__badge fd__badge-red"><span className="g-pulse-dot"/>LIVE — CS-101 · {fmt(timer)}</span>}
            <button className="fd__notif-btn">
              <Bell size={15}/>
              <div className="fd__notif-badge">3</div>
            </button>
            <button className="fd__topbar-hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
              {sidebarOpen ? <X size={19}/> : <Menu size={19}/>}
            </button>
          </div>
        </div>

        <div className="fd__content">

          {/* Stat tiles */}
          <div className="fd__stats-grid">
            {STATS.map((s,i)=>(
              <div key={i} className="fd__stat-tile fd__card">
                <div className="fd__stat-tile-top">
                  <span style={{color:s.color}}>{s.icon}</span>
                  <Sparkline data={s.data} color={s.color}/>
                </div>
                <div className="fd__stat-value" style={{color:s.color}}>
                  {s.val}<span style={{fontSize:'0.85rem',color:'var(--text-dim)',fontWeight:400}}>{s.sub}</span>
                </div>
                <div className="fd__stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── LIVE SESSION ── */}
          {tab==='live' && (
            <div className="fd__tab-content">
              <div className="fd__live-grid">

                {/* Controller */}
                <div className="fd__card">
                  <div className="fd__card-body">
                    <div className="fd__section-label">Session Controller</div>

                    {!session && (
                      <div style={{marginBottom:18}}>
                        <label className="fd__field-label">Subject</label>
                        <select className="fd__select">
                          {['CS-101 — Data Structures','CS-203 — DBMS','CS-305 — OS','CS-401 — CN'].map(s=>(
                            <option key={s} style={{background:'var(--deep)'}}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      className={`fd__btn fd__btn-full${session?' fd__btn-red':' fd__btn-primary'}`}
                      onClick={()=>{setSession(s=>!s); if(session)setTimer(0);}}>
                      {session ? <><Square size={13}/>End Session</> : <><Play size={13}/>Start Session</>}
                    </button>

                    {session && (
                      <div className="fd__status-grid" style={{marginTop:18}}>
                        {[
                          {icon:<Camera size={13}/>, label:'Webcam',  val:'Active',        color:'var(--green)'},
                          {icon:<Wifi   size={13}/>, label:'Hotspot', val:'47 Devices',    color:'var(--green)'},
                          {icon:<Shield size={13}/>, label:'2FA Gate',val:'Online',        color:'var(--cyan)'},
                          {icon:<Clock  size={13}/>, label:'Duration',val:fmt(timer),      color:'var(--cyan)'},
                        ].map((item,i)=>(
                          <div key={i} className="fd__status-item">
                            <span style={{color:item.color}}>{item.icon}</span>
                            <div>
                              <div className="fd__status-label">{item.label}</div>
                              <div className="fd__status-val" style={{color:item.color}}>{item.val}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera preview */}
                <div className="fd__card">
                  <div className="fd__card-body">
                    <div className="fd__section-label">Camera Feed</div>
                    <div className="fd__camera-preview">
                      {session ? (
                        <>
                          <div className="g-scan-line"/>
                          <div className="fd__camera-corner fd__camera-corner-tl"/>
                          <div className="fd__camera-corner fd__camera-corner-tr"/>
                          <div>
                            <Camera size={34} color="var(--cyan)" style={{display:'block',margin:'0 auto 10px'}}/>
                            <div className="fd__camera-live-text">DETECTING... 3 FACES</div>
                            <div className="fd__camera-res">1920×1080 · 30fps</div>
                          </div>
                        </>
                      ) : (
                        <div className="fd__camera-offline">
                          <Camera size={30} color="var(--text-dim)"/>
                          <div className="fd__camera-offline-text">Camera Offline<br/><span style={{opacity:.6}}>Start session to activate</span></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {tab==='attendance' && (
            <div className="fd__tab-content">
              <div className="fd__filter-row">
                <div className="fd__search-wrap" style={{flex:1,maxWidth:320}}>
                  <Search size={13} className="fd__search-icon"/>
                  <input className="fd__input fd__search-input" placeholder="Search student or roll..." value={query} onChange={e=>setQuery(e.target.value)}/>
                </div>
                <div className="fd__filter-row-right">
                  <button className="fd__btn fd__btn-outline" style={{padding:'8px 14px',fontSize:'0.6rem'}}><Filter size={12}/>Filter</button>
                  <button className="fd__btn fd__btn-primary" style={{padding:'8px 14px',fontSize:'0.6rem'}}><Download size={12}/>Export CSV</button>
                </div>
              </div>

              <div className="fd__card">
                <div className="fd__table-wrap">
                  <table className="fd__table">
                    <thead>
                      <tr>{['Roll No','Name','Face','MAC','Conf.','Status','Time','Override'].map(h=>(
                        <th key={h}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {filtered.map((s,i)=>(
                        <tr key={s.roll}>
                          <td className="fd__table-roll">{s.roll}</td>
                          <td className="fd__table-name">{s.name}</td>
                          <td>{s.face ? <CheckCircle2 size={15} color="var(--green)"/> : <AlertTriangle size={15} color="var(--red)"/>}</td>
                          <td>{s.mac  ? <CheckCircle2 size={15} color="var(--green)"/> : <AlertTriangle size={15} color="var(--red)"/>}</td>
                          <td className="fd__table-mono">{s.conf ? `${s.conf}%` : '—'}</td>
                          <td><StatusBadge face={s.face} mac={s.mac}/></td>
                          <td className="fd__table-mono">{s.time}</td>
                          <td>{!(s.face&&s.mac) && <button className="fd__override-btn" onClick={()=>override(s.roll)}>Override</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {tab==='analytics' && (
            <div className="fd__tab-content">
              {/* 30-day trend */}
              <div className="fd__card" style={{marginBottom:18}}>
                <div className="fd__card-body">
                  <div className="fd__section-label">30-Day Attendance Trend</div>
                  <div className="fd__bar-chart-wrap">
                    {[72,78,68,82,75,80,85,74,79,83,77,81,76,88,84,79,82,86,78,75,80,83,87,76,81,84,79,83,88,85].map((v,i)=>(
                      <div key={i} className="fd__bar-chart-bar" style={{
                        height:`${v}%`,
                        background: v>=80
                          ? 'linear-gradient(180deg,var(--green),rgba(0,255,157,.3))'
                          : v>=70
                          ? 'linear-gradient(180deg,var(--cyan),rgba(0,200,255,.3))'
                          : 'linear-gradient(180deg,var(--amber),rgba(255,184,0,.3))',
                      }} title={`Day ${i+1}: ${v}%`}/>
                    ))}
                  </div>
                  <div className="fd__chart-footer">
                    <span className="fd__chart-footer-label">30 days ago</span>
                    <span className="fd__chart-footer-label">Today</span>
                  </div>
                </div>
              </div>

              <div className="fd__analytics-grid">
                {/* Defaulters */}
                <div className="fd__card">
                  <div className="fd__card-body">
                    <div className="fd__section-label">Defaulters (&lt;75%)</div>
                    {[{name:'Priya Mehta',roll:'10290',pct:62},{name:'Aditya Kulkarni',roll:'10296',pct:68},{name:'Student X',roll:'10301',pct:71}].map((d,i)=>(
                      <div key={i} className="fd__defaulter-item">
                        <div>
                          <div className="fd__defaulter-name">{d.name}</div>
                          <div className="fd__defaulter-roll">Roll {d.roll}</div>
                        </div>
                        <span className="fd__badge fd__badge-red">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Today's summary */}
                <div className="fd__card">
                  <div className="fd__card-body">
                    <div className="fd__section-label">Today's Summary</div>
                    {[
                      {label:'Present',val:present,total:students.length,color:'var(--green)'},
                      {label:'Absent', val:absent, total:students.length,color:'var(--red)'},
                      {label:'Pending',val:pending,total:students.length,color:'var(--amber)'},
                    ].map((item,i)=>(
                      <div key={i} className="fd__progress-row">
                        <div className="fd__progress-header">
                          <span className="fd__progress-label">{item.label}</span>
                          <span className="fd__progress-val" style={{color:item.color}}>{item.val}/{item.total}</span>
                        </div>
                        <div className="fd__progress-track">
                          <div className="fd__progress-fill" style={{width:`${(item.val/item.total)*100}%`,background:item.color}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {tab==='reports' && (
            <div className="fd__tab-content">
              <div className="fd__reports-grid">
                {[
                  {title:'Daily Report',       desc:"Full attendance for today's sessions",      icon:<FileText  size={19}/>, color:'var(--cyan)' },
                  {title:'Weekly Summary',     desc:'Aggregated data for the past 7 days',      icon:<BarChart2 size={19}/>, color:'var(--green)'},
                  {title:'Defaulter List',     desc:'All students below 75% threshold',         icon:<AlertTriangle size={19}/>,color:'var(--red)'},
                  {title:'Subject Report',     desc:'Per-subject attendance breakdown',         icon:<TrendingUp size={19}/>,color:'var(--amber)'},
                  {title:'Semester Report',    desc:'Complete semester attendance log',         icon:<Activity  size={19}/>, color:'var(--cyan)' },
                  {title:'Audit Log',          desc:'System events and override history',       icon:<Shield    size={19}/>, color:'var(--green)'},
                ].map((r,i)=>(
                  <div key={i} className="fd__card fd__report-card">
                    <div className="fd__report-icon" style={{color:r.color}}>{r.icon}</div>
                    <div className="fd__report-title">{r.title}</div>
                    <div className="fd__report-desc">{r.desc}</div>
                    <button className="fd__btn fd__btn-outline" style={{padding:'7px 14px',fontSize:'0.6rem',width:'100%',justifyContent:'center'}}>
                      <Download size={11}/>Export
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab==='settings' && (
            <div className="fd__tab-content">
              <div className="fd__card" style={{maxWidth:560}}>
                <div className="fd__card-body">
                  <div className="fd__section-label">System Configuration</div>
                  {[
                    {label:'Face Confidence Threshold',val:'70%',    desc:'Minimum match score to mark present'},
                    {label:'Session Timeout',          val:'90 min', desc:'Auto-end session after inactivity'},
                    {label:'Defaulter Threshold',      val:'75%',    desc:'Attendance % below which student is flagged'},
                  ].map((s,i)=>(
                    <div key={i} style={{marginBottom:22,paddingBottom:22,borderBottom:i<2?'1px solid var(--border)':'none'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                        <span style={{fontFamily:'var(--font-display)',fontSize:'0.72rem',fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.04em'}}>{s.label}</span>
                        <span className="fd__badge fd__badge-cyan">{s.val}</span>
                      </div>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:'0.58rem',color:'var(--text-dim)',letterSpacing:'0.05em'}}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}