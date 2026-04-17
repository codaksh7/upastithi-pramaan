// src/screens/faculty/FacultySessionScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Switch, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { facultyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { BleManager } from 'react-native-ble-plx';
import * as Device from 'expo-device';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, SectionLabel, PulseDot, Divider, LoadingScreen } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

let bleManagerInstance = null;
function getBleManager() {
  if (!bleManagerInstance) bleManagerInstance = new BleManager();
  return bleManagerInstance;
}

export default function FacultySessionScreen() {
  const { profile, logout } = useAuth();
  const [subjects,      setSubjects]      = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [starting,      setStarting]      = useState(false);
  const [ending,        setEnding]        = useState(false);
  const [selectedSub,   setSelectedSub]   = useState(null);
  const [countdown,     setCountdown]     = useState(0);
  const [refreshingCode,setRefreshingCode]= useState(false);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    if(activeSession){
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim,{toValue:1.02,duration:1200,useNativeDriver:true}),
        Animated.timing(pulseAnim,{toValue:1,duration:1200,useNativeDriver:true}),
      ])).start();
    } else pulseAnim.setValue(1);
  },[activeSession]);

  const fetchData = useCallback(async () => {
    try {
      const [subs, sess] = await Promise.all([facultyApi.getSubjects(), facultyApi.getActiveSession()]);
      setSubjects(subs);
      setActiveSession(sess);
      if(sess){
        const studs = await facultyApi.getSessionStudents(sess.id);
        setStudents(studs);
        if(sess.twofa_code_expires_at){
          const exp = new Date(sess.twofa_code_expires_at).getTime();
          setCountdown(Math.max(0,Math.floor((exp-Date.now())/1000)));
        }
      }
    } catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  /* ── 2FA countdown with auto-refresh mechanism ── */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!activeSession || !activeSession.twofa_code_expires_at) return;

    const expiryTime = new Date(activeSession.twofa_code_expires_at).getTime();

    const tick = () => {
      const secsLeft = Math.max(0, Math.round((expiryTime - Date.now()) / 1000));
      setCountdown(secsLeft);
      if (secsLeft === 0) {
        facultyApi.getActiveSession().then(sess => {
          if (sess) setActiveSession(sess);
        }).catch(() => {});
      }
    };
    
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => clearInterval(timerRef.current);
  }, [activeSession]);

  /* ── Auto-poll active session every 30s to keep in sync with web/backend ── */
  useEffect(() => {
    if (!activeSession) return;
    const poll = setInterval(() => {
      facultyApi.getActiveSession().then(sess => {
        if (sess) setActiveSession(sess);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(poll);
  }, [activeSession]);

  const startSession = async () => {
    if(!selectedSub){Alert.alert('Error','Select a subject first.');return;}
    
    // Explicitly check if Faculty Bluetooth is ON
    setStarting(true);
    try {
      const mgr = getBleManager();
      const state = await mgr.state();
      if (state !== 'PoweredOn') {
        if (Platform.OS === 'android') {
          try { await mgr.enable(); } catch(e) {}
          // Wait up to 5 seconds for hardware to truly turn on
          let turnedOn = false;
          for(let i=0; i<10; i++) {
            await new Promise(r => setTimeout(r, 500));
            if ((await mgr.state()) === 'PoweredOn') { turnedOn = true; break; }
          }
          if (!turnedOn) {
            Alert.alert('Bluetooth Required', 'Bluetooth must be ON to map the classroom environment. Please turn it on in settings.');
            setStarting(false);
            return;
          }
        } else {
          Alert.alert('Bluetooth Required', 'Please turn on Bluetooth in your device settings.');
          setStarting(false);
          return;
        }
      }

      // ENVIRONMENTAL SIGNATURE MAPPING (The ultimate fix)
      // Since Android central apps can't natively broadcast, we map the classroom's Bluetooth environment!
      const envDevices = new Set();
      mgr.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
        if (device && device.id) envDevices.add(device.id);
      });
      
      // Map the room for 5 seconds
      await new Promise(r => setTimeout(r, 5000));
      mgr.stopDeviceScan();

      const uniqueIds = Array.from(envDevices).slice(0, 15);
      const beaconStr = uniqueIds.length > 0 ? `ENV:${uniqueIds.join('|')}` : `ENV:EMPTY`;

      await facultyApi.startSession(selectedSub.id, beaconStr); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
      await fetchData(); 
    }
    catch(e){Alert.alert('Error',e.message);}
    finally{setStarting(false);}
  };

  const endSession = () => {
    Alert.alert('End Session','End current session?',[
      {text:'Cancel'},
      {text:'End',style:'destructive',onPress:async()=>{
        setEnding(true);
        try { await facultyApi.endSession(activeSession.id); setActiveSession(null); setStudents([]); await fetchData(); }
        catch(e){Alert.alert('Error',e.message);}
        finally{setEnding(false);}
      }},
    ]);
  };

  const refreshCode = async () => {
    setRefreshingCode(true);
    try {
      const res = await facultyApi.refreshCode(activeSession.id);
      setActiveSession(prev=>({...prev,twofa_code:res.twofa_code,twofa_code_expires_at:res.twofa_code_expires_at}));
      const exp=new Date(res.twofa_code_expires_at).getTime();
      setCountdown(Math.max(0,Math.floor((exp-Date.now())/1000)));
      Haptics.selectionAsync();
    } catch(e){Alert.alert('Error',e.message);}
    finally{setRefreshingCode(false);}
  };

  const overrideStudent = async (studentId, isPresent) => {
    try {
      await facultyApi.overrideAttendance(activeSession.id,studentId,!isPresent);
      Haptics.selectionAsync();
      const updated = await facultyApi.getSessionStudents(activeSession.id);
      setStudents(updated);
    } catch(e){Alert.alert('Error',e.message);}
  };

  if(loading) return <LoadingScreen/>;

  const presentCount = students.filter(s=>s.face_verified&&s.mac_verified).length;
  const fmt = (sec) => `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchData();}} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View style={{flex:1}}>
            <Text style={s.greeting}>FACULTY PORTAL</Text>
            <Text style={s.name}>{profile?.name}</Text>
            <Text style={s.empId}>EMP: {profile?.emp_id}</Text>
          </View>
          <TouchableOpacity onPress={()=>Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])} style={s.logoutBtn}>
            <Ionicons name="power" size={18} color={Colors.red}/>
          </TouchableOpacity>
        </View>

        {/* Active session */}
        {activeSession ? (
          <Animated.View style={{transform:[{scale:pulseAnim}]}}>
            <GlowCard color="green" style={s.activeCard}>
              <View style={s.activeHdr}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                  <PulseDot color={Colors.green} size={10}/>
                  <Text style={s.liveText}>SESSION LIVE</Text>
                </View>
                <Badge label={`${presentCount}/${students.length} PRESENT`} color="green"/>
              </View>
              <Divider/>
              <Text style={s.activeSubj}>{activeSession.subjects?.code} — {activeSession.subjects?.name}</Text>
              <Text style={s.activeMeta}>Started: {new Date(activeSession.started_at).toLocaleTimeString()}</Text>
              {activeSession.beacon_id&&(
                <View style={s.beaconBadge}>
                  <Ionicons name="bluetooth" size={12} color={Colors.cyan}/>
                  <Text style={s.beaconBadgeText}>BEACON: {activeSession.beacon_id.slice(0,8)}...</Text>
                </View>
              )}

              {/* 2FA Code */}
              <GlowCard color="cyan" style={s.codeCard}>
                <Text style={s.codeLabel}>STUDENT 2FA CODE — SHOW THIS ON SCREEN</Text>
                <Text style={s.codeValue}>{activeSession.twofa_code||'------'}</Text>
                <View style={s.codeBottom}>
                  <Text style={s.codeExpiry}>Expires: {countdown>0?fmt(countdown):'EXPIRED'}</Text>
                  <TouchableOpacity onPress={refreshCode} disabled={refreshingCode} style={s.refreshCodeBtn}>
                    <Ionicons name="refresh" size={13} color={Colors.cyan}/>
                    <Text style={s.refreshCodeText}>REFRESH</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.codeHint}>Students enter this 6-digit code in their app</Text>
              </GlowCard>

              <CyberButton label="End Session" color="red" onPress={endSession} loading={ending} style={{marginTop:14}}/>
            </GlowCard>
          </Animated.View>
        ) : (
          /* Start session */
          <GlowCard color="cyan" style={s.startCard}>
            <View style={{alignItems:'center',marginBottom:10}}>
              <Ionicons name="radio-button-off" size={38} color={Colors.textMuted}/>
            </View>
            <Text style={s.noSessTitle}>NO ACTIVE SESSION</Text>
            <Text style={s.noSessSub}>Select a subject to start an attendance session</Text>
            <SectionLabel label="Select Subject" style={{marginTop:18}}/>
            {subjects.length===0
              ? <Text style={{fontFamily:'monospace',fontSize:11,color:Colors.textMuted,textAlign:'center',padding:16}}>No subjects assigned. Contact admin.</Text>
              : subjects.map(sub=>(
                <TouchableOpacity key={sub.id} style={[s.subBtn,selectedSub?.id===sub.id&&s.subBtnActive]} onPress={()=>setSelectedSub(sub)}>
                  <View style={{flex:1}}>
                    <Text style={[s.subBtnCode,selectedSub?.id===sub.id&&{color:Colors.cyan}]}>{sub.code}</Text>
                    <Text style={s.subBtnName}>{sub.name}</Text>
                  </View>
                  {selectedSub?.id===sub.id&&<Ionicons name="checkmark-circle" size={19} color={Colors.cyan}/>}
                </TouchableOpacity>
              ))
            }
            <SectionLabel label="Bluetooth Beacon" style={{marginTop:18}}/>
            <GlowCard color="cyan" style={{padding:16,alignItems:'center',marginBottom:8}}>
              <Ionicons name="bluetooth" size={28} color={Colors.cyan}/>
              <Text style={{fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:1,marginTop:8,textAlign:'center'}}>ENVIRONMENT MAPPING ACTIVE</Text>
              <Text style={{fontFamily:'monospace',fontSize:8,color:Colors.textDim,marginTop:4,textAlign:'center',lineHeight:13}}>Your phone will scan the classroom for 5 seconds to create a unique Bluetooth environment signature. Students in this same exact environment will be verified automatically!</Text>
            </GlowCard>
            <CyberButton label={starting ? "Mapping Classroom..." : "Start Session"} color="green" onPress={startSession} loading={starting} disabled={!selectedSub} style={{marginTop:14}}/>
          </GlowCard>
        )}

        {/* Live student list */}
        {activeSession&&students.length>0&&(
          <>
            <SectionLabel label={`Live Attendance — ${students.length} Students`} style={{marginTop:22}}/>
            {students.map(st=>{
              const isPresent=st.face_verified&&st.mac_verified;
              return (
                <GlowCard key={st.roll} color={isPresent?'green':'red'} style={s.stuRow}>
                  <View style={s.stuLeft}>
                    <View style={[s.stuAvatar,{backgroundColor:isPresent?Colors.greenGlow:Colors.redGlow,borderColor:isPresent?Colors.green:Colors.red}]}>
                      <Text style={[s.stuAvatarTxt,{color:isPresent?Colors.green:Colors.red}]}>{st.name?.charAt(0)}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={s.stuName}>{st.name}</Text>
                      <Text style={s.stuRoll}>Roll: {st.roll}</Text>
                      <View style={s.verifyRow}>
                        {[{label:'FACE',ok:st.face_verified},{label:'MAC',ok:st.mac_verified}].map((v,i)=>(
                          <View key={i} style={[s.verifyChip,{borderColor:v.ok?Colors.green:Colors.border}]}>
                            <Ionicons name={v.ok?'checkmark':'close'} size={9} color={v.ok?Colors.green:Colors.textMuted}/>
                            <Text style={[s.verifyTxt,{color:v.ok?Colors.green:Colors.textMuted}]}>{v.label}</Text>
                          </View>
                        ))}
                        {st.confidence&&<Text style={s.confidence}>{Number(st.confidence).toFixed(0)}%</Text>}
                      </View>
                    </View>
                  </View>
                  <Switch value={isPresent} onValueChange={()=>overrideStudent(st.student_id||st.id,isPresent)}
                    trackColor={{false:Colors.redGlow,true:Colors.greenGlow}} thumbColor={isPresent?Colors.green:Colors.red}/>
                </GlowCard>
              );
            })}
          </>
        )}
        <View style={{height:40}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:Colors.void},
  scroll:  {paddingHorizontal:Spacing.md,paddingTop:8,paddingBottom:16},
  header:  {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  greeting:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:2},
  name:    {fontFamily:'monospace',fontSize:20,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1,marginTop:2},
  empId:   {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  logoutBtn:{padding:8,borderWidth:1,borderColor:Colors.redBorder,borderRadius:4},
  activeCard:{marginBottom:8},
  activeHdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  liveText: {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.green,letterSpacing:2},
  activeSubj:{fontFamily:'monospace',fontSize:14,fontWeight:'800',color:Colors.textPrimary,letterSpacing:0.5,marginTop:10},
  activeMeta:{fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:3},
  codeCard:  {marginTop:14,alignItems:'center',padding:18},
  codeLabel: {fontFamily:'monospace',fontSize:8,color:Colors.cyan,letterSpacing:2.5,marginBottom:6,textAlign:'center'},
  codeValue: {fontFamily:'monospace',fontSize:44,fontWeight:'900',color:Colors.cyan,letterSpacing:14},
  codeBottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',width:'100%',marginTop:8},
  codeExpiry:{fontFamily:'monospace',fontSize:10,color:Colors.textMuted,letterSpacing:1},
  refreshCodeBtn:{flexDirection:'row',alignItems:'center',gap:4},
  refreshCodeText:{fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:1},
  codeHint:  {fontFamily:'monospace',fontSize:8,color:Colors.textDim,letterSpacing:0.5,marginTop:7,textAlign:'center'},
  startCard: {padding:Spacing.lg},
  noSessTitle:{fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textSecondary,letterSpacing:2,textAlign:'center'},
  noSessSub:  {fontFamily:'monospace',fontSize:10,color:Colors.textMuted,textAlign:'center',marginTop:5,lineHeight:15},
  subBtn:    {padding:13,borderWidth:1,borderColor:Colors.border,borderRadius:3,marginBottom:7,flexDirection:'row',alignItems:'center'},
  subBtnActive:{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow},
  subBtnCode:{fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textPrimary},
  subBtnName:{fontFamily:'monospace',fontSize:10,color:Colors.textMuted,marginTop:2},
  beaconBadge: {flexDirection:'row',alignItems:'center',gap:5,marginTop:6,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:9,paddingVertical:4,alignSelf:'flex-start'},
  beaconBadgeText:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1},
  stuRow:    {marginBottom:8,padding:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  stuLeft:   {flexDirection:'row',alignItems:'center',gap:11,flex:1},
  stuAvatar: {width:38,height:38,borderRadius:19,borderWidth:1,alignItems:'center',justifyContent:'center'},
  stuAvatarTxt:{fontFamily:'monospace',fontSize:15,fontWeight:'800'},
  stuName:   {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.textPrimary},
  stuRoll:   {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,marginTop:1},
  verifyRow: {flexDirection:'row',gap:5,marginTop:4,alignItems:'center'},
  verifyChip:{flexDirection:'row',alignItems:'center',gap:2,borderWidth:1,borderRadius:2,paddingHorizontal:4,paddingVertical:2},
  verifyTxt: {fontFamily:'monospace',fontSize:7,letterSpacing:0.5},
  confidence:{fontFamily:'monospace',fontSize:8,color:Colors.textMuted},
});
