import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  Scan, CheckCircle2, AlertTriangle, Calendar, Download,
  User, LogOut, ChevronRight, BarChart2, Activity,
  HelpCircle, Smartphone, MessageSquare, Info, Bell, Menu, X
} from 'lucide-react';
import './StudentDashboard.css';

const genCalendar = () => Array.from({length:28},(_,i)=>({
  day: i+1,
  status: Math.random()>.85 ? 'no-class' : Math.random()>.2 ? 'present' : 'absent',
}));
const CAL = genCalendar();

const SUBJECTS = [
  {code:'CS-101',name:'Data Structures',    faculty:'Prof. Sharma',   total:50,attended:42,color:'var(--cyan)'},
  {code:'CS-203',name:'Database Management',faculty:'Prof. Verma',    total:48,attended:38,color:'var(--green)'},
  {code:'CS-305',name:'Operating Systems',  faculty:'Prof. Kulkarni', total:46,attended:32,color:'var(--amber)'},
  {code:'CS-401',name:'Computer Networks',  faculty:'Prof. Patil',    total:44,attended:37,color:'var(--cyan)'},
];

const NOTIFS = [
  {type:'warning',msg:'Your OS attendance dropped to 69.5%. Attend next 4 lectures to recover.',time:'2h ago'},
  {type:'success',msg:'Attendance marked — CS-101 at 10:33 AM today. Confidence: 97.3%',time:'3h ago'},
  {type:'info',   msg:'Manual attendance recorded for CS-203 on 12 Feb by Prof. Verma.',time:'2d ago'},
  {type:'success',msg:'Device re-registration request approved by admin.',time:'3d ago'},
];

const NAV = [
  {id:'overview',  icon:<Activity    size={17}/>, label:'Overview' },
  {id:'calendar',  icon:<Calendar    size={17}/>, label:'Calendar' },
  {id:'subjects',  icon:<BarChart2   size={17}/>, label:'Subjects' },
  {id:'alerts',    icon:<Bell        size={17}/>, label:'Alerts',  badge:2 },
  {id:'profile',   icon:<User        size={17}/>, label:'Profile'  },
  {id:'support',   icon:<HelpCircle  size={17}/>, label:'Support'  },
];

/* circular progress */
function CircularPct({ pct, size=56, stroke=4, color }) {
  const r = (size-stroke)/2;
  const c = 2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)',flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c-(pct/100)*c}
        strokeLinecap="round" style={{transition:'stroke-dashoffset 1.4s var(--ease-out)'}}/>
    </svg>
  );
}

function NotifIcon({type}) {
  if (type==='warning') return <AlertTriangle size={13} color="var(--amber)"/>;
  if (type==='success') return <CheckCircle2  size={13} color="var(--green)"/>;
  return                       <Info          size={13} color="var(--cyan)"/>;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [tab,        setTab]        = useState('overview');
  const [sidebarOpen,setSidebarOpen]= useState(false);
  const sidebarRef = useRef(null);
  const mainRef    = useRef(null);

  const overallPct = Math.round(SUBJECTS.reduce((a,s)=>a+(s.attended/s.total)*100,0)/SUBJECTS.length);

  useEffect(()=>{
    const tl = gsap.timeline();
    tl.fromTo(sidebarRef.current,{x:-60,opacity:0},{x:0,opacity:1,duration:0.55,ease:'power3.out'})
      .fromTo(mainRef.current,   {opacity:0,y:18}, {opacity:1,y:0,duration:0.55,ease:'power2.out'},'-=0.3')
      .fromTo('.sd__stat-tile',  {opacity:0,y:20}, {opacity:1,y:0,duration:0.4,stagger:0.07},'-=0.25');
  },[]);

  useEffect(()=>{
    gsap.fromTo('.sd__tab-content',{opacity:0,y:14},{opacity:1,y:0,duration:0.38,ease:'power2.out'});
  },[tab]);

  return (
    <div className="sd__shell">

      {sidebarOpen && <div className="sd__sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}

      {/* ── Sidebar ── */}
      <aside ref={sidebarRef} className={`sd__sidebar${sidebarOpen?' sd__sidebar-open':''}`}>
        <div className="sd__sidebar-logo">
          <div className="sd__sidebar-logo-icon"><Scan size={14} color="var(--green)"/></div>
          <div className="sd__sidebar-logo-text">
            <div className="sd__sidebar-logo-name">UPASTITHI</div>
            <div className="sd__sidebar-logo-sub">STUDENT PORTAL</div>
          </div>
        </div>

        <div className="sd__sidebar-profile">
          <div className="sd__sidebar-avatar">DN</div>
          <div className="sd__sidebar-profile-info">
            <div className="sd__sidebar-profile-name">Devansh Nayak</div>
            <div className="sd__sidebar-profile-id">Roll 10268 · Div B</div>
          </div>
          <div className="sd__sidebar-device-pill">
            <Smartphone size={10}/> Device Verified
          </div>
        </div>

        <nav className="sd__sidebar-nav">
          {NAV.map(item=>(
            <button key={item.id}
              className={`sd__sidebar-nav-btn${tab===item.id?' sd__active':''}`}
              onClick={()=>{setTab(item.id);setSidebarOpen(false);}}>
              <span className="sd__sidebar-nav-icon">{item.icon}</span>
              <span className="sd__sidebar-nav-label">{item.label}</span>
              {item.badge && <span className="sd__sidebar-nav-badge">{item.badge}</span>}
              {tab===item.id && !item.badge && <ChevronRight size={12} className="sd__sidebar-nav-chevron"/>}
            </button>
          ))}
        </nav>

        <div className="sd__sidebar-footer">
          <button className="sd__sidebar-logout" onClick={()=>navigate('/')}>
            <LogOut size={14}/><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main ref={mainRef} className="sd__main">

        {/* Topbar */}
        <div className="sd__topbar">
          <div>
            <div className="sd__topbar-title">{NAV.find(n=>n.id===tab)?.label}</div>
            <div className="sd__topbar-date">{new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          </div>
          <div className="sd__topbar-right">
            <div className="sd__live-pill"><div className="sd__live-dot"/><span>CS-101 LIVE</span></div>
            <button className="sd__topbar-hamburger" onClick={()=>setSidebarOpen(o=>!o)}>
              {sidebarOpen ? <X size={19}/> : <Menu size={19}/>}
            </button>
          </div>
        </div>

        <div className="sd__content">

          {/* Stat tiles (always visible) */}
          <div className="sd__stats-grid">
            {[
              {label:'Overall Attendance',  val:`${overallPct}%`, color:overallPct>=75?'var(--green)':'var(--red)',   icon:<Activity size={17}/>},
              {label:'Lectures Attended',   val:`${SUBJECTS.reduce((a,s)=>a+s.attended,0)}`, color:'var(--cyan)',     icon:<CheckCircle2 size={17}/>},
              {label:'Subjects At Risk',    val:`${SUBJECTS.filter(s=>(s.attended/s.total)<.75).length}`, color:'var(--red)',   icon:<AlertTriangle size={17}/>},
              {label:'Last Marked',         val:'10:33 AM',       color:'var(--amber)',                               icon:<Smartphone size={17}/>},
            ].map((s,i)=>(
              <div key={i} className="sd__stat-tile sd__card">
                <div className="sd__stat-icon" style={{color:s.color}}>{s.icon}</div>
                <div className="sd__stat-value" style={{color:s.color}}>{s.val}</div>
                <div className="sd__stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {tab==='overview' && (
            <div className="sd__tab-content">
              <div className="sd__device-banner">
                <div className="sd__device-banner-text">
                  <CheckCircle2 size={15} color="var(--green)"/>
                  Device Recognized — MAC: A4:CF:12:33:BB:EF · Attendance eligible
                </div>
                <span className="sd__badge sd__badge-green"><span className="g-pulse-dot"/>Active</span>
              </div>

              <div className="sd__overview-grid">
                {/* Subjects */}
                <div>
                  <div className="sd__section-label" style={{marginBottom:14}}>Subject Attendance</div>
                  <div className="sd__subjects-list">
                    {SUBJECTS.map((sub,i)=>{
                      const pct  = Math.round((sub.attended/sub.total)*100);
                      const safe = pct>=75;
                      return (
                        <div key={i} className="sd__card sd__subject-card">
                          <div className="sd__subject-top">
                            <div>
                              <div className="sd__subject-code" style={{color:sub.color}}>{sub.code}</div>
                              <div className="sd__subject-name">{sub.name}</div>
                              <div className="sd__subject-faculty">{sub.faculty}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <CircularPct pct={pct} size={52} stroke={4} color={safe?'var(--green)':'var(--red)'}/>
                              <div>
                                <div className="sd__subject-pct" style={{color:safe?'var(--green)':'var(--red)'}}>{pct}%</div>
                                <div className="sd__subject-count">{sub.attended}/{sub.total}</div>
                              </div>
                            </div>
                          </div>
                          <div className="sd__progress-track">
                            <div className="sd__progress-fill" style={{width:`${pct}%`,background:safe?'var(--green)':'var(--red)'}}/>
                            <div className="sd__progress-mark"/>
                          </div>
                          {!safe && <div className="sd__subject-warn">⚠ Need {Math.ceil((0.75*sub.total-sub.attended)/(1-0.75))} more lectures to reach 75%</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right panel */}
                <div className="sd__right-panel">
                  {/* Live check */}
                  <div className="sd__card sd__live-check">
                    <div className="sd__section-label">Live Session Status</div>
                    <div className="sd__live-alert">
                      <div className="sd__live-dot" style={{marginTop:3}}/>
                      CS-101 LIVE — Prof. Sharma's class is in progress
                    </div>
                    {[
                      {label:'Device Connected to Hotspot',ok:true},
                      {label:'Face Detected by Camera',   ok:true},
                      {label:'Attendance Marked 10:33 AM',ok:true},
                    ].map((item,i)=>(
                      <div key={i} className="sd__checklist-item" style={{color:item.ok?'var(--green)':'var(--red)'}}>
                        {item.ok ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}
                        {item.label}
                      </div>
                    ))}
                  </div>

                  {/* Notifications */}
                  <div className="sd__section-label" style={{marginBottom:10}}>Recent Alerts</div>
                  <div className="sd__notif-list">
                    {NOTIFS.slice(0,3).map((n,i)=>(
                      <div key={i} className="sd__card sd__notif-card">
                        <div className="sd__notif-inner">
                          <NotifIcon type={n.type}/>
                          <div>
                            <div className="sd__notif-text">{n.msg}</div>
                            <div className="sd__notif-time">{n.time}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CALENDAR ── */}
          {tab==='calendar' && (
            <div className="sd__tab-content">
              <div className="sd__card sd__calendar-card">
                <div className="sd__calendar-head">
                  <div>
                    <div className="sd__section-label" style={{marginBottom:4}}>Attendance Calendar</div>
                    <div className="sd__calendar-month">February 2025</div>
                  </div>
                  <div className="sd__calendar-legend">
                    {[{c:'var(--green)',l:'Present'},{c:'var(--red)',l:'Absent'},{c:'rgba(255,255,255,.06)',l:'No Class'}].map((l,i)=>(
                      <div key={i} className="sd__legend-item">
                        <div className="sd__legend-dot" style={{background:l.c}}/>
                        <span className="sd__legend-label">{l.l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sd__weekday-row">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
                    <div key={d} className="sd__weekday-label">{d}</div>
                  ))}
                </div>
                <div className="sd__cal-grid">
                  {CAL.map((day,i)=>(
                    <div key={i} className={`sd__cal-day sd__cal-day-${day.status}`}>{day.day}</div>
                  ))}
                </div>

                <div className="sd__cal-footer">
                  {[
                    {val:CAL.filter(d=>d.status==='present').length, label:'Present', color:'var(--green)'},
                    {val:CAL.filter(d=>d.status==='absent').length,  label:'Absent',  color:'var(--red)'},
                    {val:CAL.filter(d=>d.status==='no-class').length,label:'No Class',color:'var(--text-dim)'},
                  ].map((s,i)=>(
                    <div key={i}>
                      <div className="sd__cal-footer-val" style={{color:s.color}}>{s.val}</div>
                      <div className="sd__cal-footer-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SUBJECTS ── */}
          {tab==='subjects' && (
            <div className="sd__tab-content">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:12}}>
                <div className="sd__section-label" style={{marginBottom:0}}>All Subjects — Semester 5</div>
                <button className="sd__submit-btn" style={{padding:'8px 18px',fontSize:'0.62rem'}}>
                  <Download size={12}/>Export Report
                </button>
              </div>
              <div className="sd__subjects-detail-grid">
                {SUBJECTS.map((sub,i)=>{
                  const pct=Math.round((sub.attended/sub.total)*100), safe=pct>=75;
                  const needed=safe?0:Math.ceil((0.75*sub.total-sub.attended)/(1-0.75));
                  return (
                    <div key={i} className="sd__card sd__subject-detail-card">
                      <div className="sd__subject-detail-top">
                        <div>
                          <div className="sd__subject-code" style={{color:sub.color,marginBottom:4}}>{sub.code}</div>
                          <div className="sd__subject-name">{sub.name}</div>
                          <div className="sd__subject-faculty" style={{marginTop:4}}>{sub.faculty}</div>
                        </div>
                        <CircularPct pct={pct} size={62} stroke={5} color={safe?'var(--green)':'var(--red)'}/>
                      </div>
                      <div className="sd__subject-mini-grid">
                        {[{l:'Total',v:sub.total},{l:'Attended',v:sub.attended},{l:'Missed',v:sub.total-sub.attended}].map((m,j)=>(
                          <div key={j} className="sd__subject-mini-cell">
                            <div className="sd__subject-mini-val">{m.v}</div>
                            <div className="sd__subject-mini-label">{m.l}</div>
                          </div>
                        ))}
                      </div>
                      <span className={`sd__badge ${safe?'sd__badge-green':'sd__badge-red'}`}>{pct}% — {safe?'Safe':'At Risk'}</span>
                      {needed>0 && <div className="sd__subject-detail-warn">⚠ Attend {needed} more consecutive lectures to reach 75%</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ALERTS ── */}
          {tab==='alerts' && (
            <div className="sd__tab-content">
              <div className="sd__section-label" style={{marginBottom:18}}>System Notifications</div>
              <div className="sd__alerts-list">
                {NOTIFS.map((n,i)=>(
                  <div key={i} className="sd__card sd__alert-card" style={{borderLeft:`3px solid ${n.type==='warning'?'var(--amber)':n.type==='success'?'var(--green)':'var(--cyan)'}`}}>
                    <div className="sd__alert-inner">
                      <div className="sd__alert-body">
                        <div style={{marginTop:2,flexShrink:0}}><NotifIcon type={n.type}/></div>
                        <div className="sd__alert-text">{n.msg}</div>
                      </div>
                      <div className="sd__alert-time">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab==='profile' && (
            <div className="sd__tab-content">
              <div className="sd__profile-wrap">
                <div className="sd__card sd__profile-card">
                  <div className="sd__section-label">Personal Information</div>
                  <div className="sd__profile-top">
                    <div className="sd__profile-avatar">DN</div>
                    <div>
                      <div className="sd__profile-name">Devansh Nayak</div>
                      <div className="sd__profile-meta">Roll 10268 · Division B · Computer Engineering</div>
                      <span className="sd__badge sd__badge-green" style={{marginTop:8,display:'inline-flex'}}>Active Student</span>
                    </div>
                  </div>
                  {[
                    {l:'Institution',v:'Fr. Conceicao Rodrigues College of Engineering'},
                    {l:'Department', v:'Computer Engineering'},
                    {l:'Division',   v:'B'},
                    {l:'Semester',   v:'5th Semester'},
                    {l:'Email',      v:'devansh.nayak@frcrce.ac.in'},
                  ].map((r,i)=>(
                    <div key={i} className="sd__info-row">
                      <span className="sd__info-label">{r.l}</span>
                      <span className="sd__info-val">{r.v}</span>
                    </div>
                  ))}
                </div>

                <div className="sd__card sd__profile-card">
                  <div className="sd__section-label">Registered Device</div>
                  {[
                    {l:'Device Name', v:"Devansh's Redmi Note 12", mono:false},
                    {l:'MAC Address', v:'A4:CF:12:33:BB:EF',       mono:true},
                    {l:'Registered',  v:'14 January 2025',         mono:false},
                    {l:'Status',      v:<span className="sd__badge sd__badge-green"><span className="g-pulse-dot"/>Active</span>, mono:false},
                  ].map((r,i)=>(
                    <div key={i} className="sd__info-row">
                      <span className="sd__info-label">{r.l}</span>
                      <span className={r.mono?'sd__info-mono':'sd__info-val'}>{r.v}</span>
                    </div>
                  ))}
                  <button className="sd__submit-btn" style={{marginTop:18}}>
                    <Smartphone size={12}/>Request Device Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SUPPORT ── */}
          {tab==='support' && (
            <div className="sd__tab-content">
              <div className="sd__support-wrap">
                <div className="sd__card sd__support-card">
                  <div className="sd__support-title">Why wasn't my attendance marked?</div>
                  {[
                    'Is your phone connected to the classroom Wi-Fi Hotspot?',
                    'Is your MAC address registered? (Check Profile → Device)',
                    'Was your face clearly visible to the webcam?',
                    'Was the session active at that time?',
                  ].map((q,i)=>(
                    <div key={i} style={{display:'flex',gap:10,marginBottom:12}}>
                      <div className="sd__checklist-num">{i+1}</div>
                      <span className="sd__checklist-text">{q}</span>
                    </div>
                  ))}
                </div>

                <div className="sd__card sd__support-card">
                  <div className="sd__support-title">Raise a Dispute</div>
                  <div className="sd__dispute-form">
                    <div>
                      <label className="sd__field-label">Subject</label>
                      <select className="sd__select">
                        {SUBJECTS.map(s=><option key={s.code} style={{background:'var(--deep)'}}>{s.code} — {s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="sd__field-label">Date</label>
                      <input type="date" className="sd__input"/>
                    </div>
                    <div>
                      <label className="sd__field-label">Describe the issue</label>
                      <textarea className="sd__textarea" rows={4} placeholder="Describe what happened..."/>
                    </div>
                    <button className="sd__submit-btn">
                      <MessageSquare size={13}/>Submit Dispute
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}