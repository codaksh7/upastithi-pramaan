// src/screens/faculty/FacultySessionScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Switch, Animated, TextInput,
  NativeModules, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { facultyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, SectionLabel, PulseDot, Divider, LoadingScreen } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const { HotspotModule } = NativeModules;

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
  const [hotspotSsid,   setHotspotSsid]   = useState('');
  const [countdown,     setCountdown]     = useState(0);
  const [refreshingCode,setRefreshingCode]= useState(false);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Hotspot BSSID detection state ──
  const [hotspotBssid,      setHotspotBssid]      = useState(null);
  const [hotspotDetecting,  setHotspotDetecting]  = useState(false);
  const [hotspotActive,     setHotspotActive]     = useState(false);
  const [manualBssid,       setManualBssid]       = useState('');
  const [showManualEntry,   setShowManualEntry]   = useState(false);
  const detectIntervalRef = useRef(null);

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

  /* ── Hotspot BSSID detection ── */
  const detectHotspotBssid = useCallback(async () => {
    if (!HotspotModule) {
      console.warn('HotspotModule not available — running in Expo Go or unsupported platform');
      return;
    }
    try {
      const isActive = await HotspotModule.isHotspotActive();
      setHotspotActive(isActive);
      if (isActive) {
        const bssid = await HotspotModule.getHotspotBssid();
        if (bssid) {
          setHotspotBssid(bssid);
          setHotspotDetecting(false);
          clearInterval(detectIntervalRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e) {
      console.warn('Hotspot detection error:', e);
    }
  }, []);

  const startHotspotDetection = useCallback(() => {
    setHotspotDetecting(true);
    setHotspotBssid(null);
    detectHotspotBssid(); // immediate first check
    detectIntervalRef.current = setInterval(detectHotspotBssid, 2000);
  }, [detectHotspotBssid]);

  const stopHotspotDetection = useCallback(() => {
    setHotspotDetecting(false);
    clearInterval(detectIntervalRef.current);
  }, []);

  // Clean up detection interval on unmount
  useEffect(() => {
    return () => clearInterval(detectIntervalRef.current);
  }, []);

  const openHotspotSettings = async () => {
    try {
      if (HotspotModule) {
        await HotspotModule.openHotspotSettings();
        // Start polling for hotspot activation after opening settings
        startHotspotDetection();
      } else {
        Alert.alert('Unavailable', 'Hotspot settings cannot be opened in Expo Go. Please enable your hotspot manually from your device settings.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open hotspot settings. Please enable manually.');
    }
  };

  const startSession = async () => {
    if(!selectedSub){Alert.alert('Error','Select a subject first.');return;}
    
    // Determine which BSSID to use
    const bssidToSend = hotspotBssid || (showManualEntry && manualBssid.trim()) || null;
    
    if (!bssidToSend && !hotspotSsid.trim()) {
      Alert.alert('Error', 'Enable your Wi-Fi hotspot or enter a hotspot SSID/BSSID for proximity verification.');
      return;
    }

    setStarting(true);
    try {
      await facultyApi.startSession(
        selectedSub.id,
        hotspotSsid.trim() || null,
        bssidToSend
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stopHotspotDetection();
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
              
              {/* Hotspot info badges */}
              {activeSession.hotspot_ssid&&(
                <View style={s.ssidBadge}>
                  <Ionicons name="wifi" size={12} color={Colors.cyan}/>
                  <Text style={s.ssidBadgeText}>SSID: {activeSession.hotspot_ssid}</Text>
                </View>
              )}
              {activeSession.hotspot_bssid&&(
                <View style={[s.ssidBadge,{borderColor:Colors.greenBorder,backgroundColor:Colors.greenGlow}]}>
                  <Ionicons name="hardware-chip" size={12} color={Colors.green}/>
                  <Text style={[s.ssidBadgeText,{color:Colors.green}]}>BSSID: {activeSession.hotspot_bssid}</Text>
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
            <Text style={s.noSessSub}>Select a subject and enable your hotspot to start</Text>

            {/* Subject selection */}
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

            {/* ── Hotspot BSSID Detection ── */}
            <SectionLabel label="Wi-Fi Hotspot (Proximity Check)" style={{marginTop:18}}/>
            
            <GlowCard color={hotspotBssid ? 'green' : 'cyan'} style={s.hotspotCard}>
              <View style={s.hotspotHeader}>
                <Ionicons 
                  name={hotspotBssid ? 'checkmark-circle' : hotspotDetecting ? 'radio' : 'wifi'} 
                  size={28} 
                  color={hotspotBssid ? Colors.green : Colors.cyan}
                />
                <View style={{flex:1,marginLeft:12}}>
                  <Text style={[s.hotspotTitle, hotspotBssid && {color: Colors.green}]}>
                    {hotspotBssid ? 'HOTSPOT DETECTED ✓' : hotspotDetecting ? 'DETECTING HOTSPOT...' : 'ENABLE YOUR HOTSPOT'}
                  </Text>
                  <Text style={s.hotspotSubtext}>
                    {hotspotBssid 
                      ? 'MAC address will be used for student proximity verification'
                      : 'Turn on your mobile hotspot so students can verify proximity'}
                  </Text>
                </View>
              </View>

              {/* Detected BSSID display */}
              {hotspotBssid && (
                <View style={s.bssidDisplay}>
                  <Ionicons name="hardware-chip" size={14} color={Colors.green}/>
                  <Text style={s.bssidText}>{hotspotBssid}</Text>
                  <TouchableOpacity onPress={() => { setHotspotBssid(null); startHotspotDetection(); }}>
                    <Ionicons name="refresh" size={14} color={Colors.textMuted}/>
                  </TouchableOpacity>
                </View>
              )}

              {/* Detection spinner */}
              {hotspotDetecting && !hotspotBssid && (
                <View style={s.detectingWrap}>
                  <ActivityIndicator size="small" color={Colors.cyan}/>
                  <Text style={s.detectingText}>Scanning network interfaces...</Text>
                </View>
              )}

              {/* Action buttons */}
              {!hotspotBssid && !hotspotDetecting && (
                <View style={s.hotspotActions}>
                  <TouchableOpacity style={s.hotspotActionBtn} onPress={openHotspotSettings}>
                    <Ionicons name="settings" size={14} color={Colors.cyan}/>
                    <Text style={s.hotspotActionText}>OPEN HOTSPOT SETTINGS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.hotspotActionBtn} onPress={startHotspotDetection}>
                    <Ionicons name="scan" size={14} color={Colors.cyan}/>
                    <Text style={s.hotspotActionText}>DETECT BSSID</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hotspotDetecting && !hotspotBssid && (
                <TouchableOpacity 
                  style={[s.hotspotActionBtn,{alignSelf:'center',marginTop:8}]} 
                  onPress={stopHotspotDetection}
                >
                  <Ionicons name="stop-circle" size={14} color={Colors.red}/>
                  <Text style={[s.hotspotActionText,{color:Colors.red}]}>STOP SCANNING</Text>
                </TouchableOpacity>
              )}
            </GlowCard>

            {/* Manual BSSID entry toggle */}
            <TouchableOpacity 
              style={s.manualToggle} 
              onPress={() => setShowManualEntry(!showManualEntry)}
            >
              <Ionicons name={showManualEntry ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textDim}/>
              <Text style={s.manualToggleText}>
                {showManualEntry ? 'Hide manual entry' : 'Enter BSSID manually instead'}
              </Text>
            </TouchableOpacity>

            {showManualEntry && (
              <View style={{marginBottom:8}}>
                <View style={s.ssidInputWrap}>
                  <Ionicons name="hardware-chip" size={16} color={Colors.cyan}/>
                  <TextInput
                    style={s.ssidInput}
                    placeholder="e.g. AA:BB:CC:DD:EE:FF"
                    placeholderTextColor={Colors.textDim}
                    value={manualBssid}
                    onChangeText={setManualBssid}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
                <Text style={s.ssidHint}>Enter the MAC address (BSSID) of your Wi-Fi hotspot in XX:XX:XX:XX:XX:XX format.</Text>
              </View>
            )}

            {/* Hotspot SSID (optional label) */}
            <SectionLabel label="Hotspot Name (Optional)" style={{marginTop:10}}/>
            <View style={s.ssidInputWrap}>
              <Ionicons name="wifi" size={16} color={Colors.cyan}/>
              <TextInput
                style={s.ssidInput}
                placeholder="e.g. Prof_Kanthe_Hotspot"
                placeholderTextColor={Colors.textDim}
                value={hotspotSsid}
                onChangeText={setHotspotSsid}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={s.ssidHint}>Display name for the hotspot (shown to students). BSSID is used for actual verification.</Text>
            
            <CyberButton 
              label="Start Session" 
              color="green" 
              onPress={startSession} 
              loading={starting} 
              disabled={!selectedSub || (!hotspotBssid && !manualBssid.trim() && !hotspotSsid.trim())} 
              style={{marginTop:14}}
            />
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

  // Hotspot detection styles
  hotspotCard: {padding:16,marginBottom:8},
  hotspotHeader:{flexDirection:'row',alignItems:'flex-start'},
  hotspotTitle:{fontFamily:'monospace',fontSize:11,fontWeight:'700',color:Colors.cyan,letterSpacing:1},
  hotspotSubtext:{fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:3,lineHeight:14},
  bssidDisplay:{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,backgroundColor:Colors.greenGlow,borderWidth:1,borderColor:Colors.greenBorder,borderRadius:3,paddingHorizontal:12,paddingVertical:8},
  bssidText:{fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.green,letterSpacing:2,flex:1},
  detectingWrap:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12,paddingVertical:6},
  detectingText:{fontFamily:'monospace',fontSize:10,color:Colors.textMuted,letterSpacing:0.5},
  hotspotActions:{flexDirection:'row',gap:8,marginTop:12},
  hotspotActionBtn:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:12,paddingVertical:8,backgroundColor:Colors.cyanGlow},
  hotspotActionText:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1},
  manualToggle:{flexDirection:'row',alignItems:'center',gap:5,justifyContent:'center',paddingVertical:8},
  manualToggleText:{fontFamily:'monospace',fontSize:9,color:Colors.textDim,letterSpacing:0.5},

  ssidInputWrap:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,backgroundColor:Colors.cardBg,paddingHorizontal:12,paddingVertical:4,marginBottom:4},
  ssidInput: {flex:1,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary,paddingVertical:10},
  ssidHint:  {fontFamily:'monospace',fontSize:8,color:Colors.textDim,marginTop:4,lineHeight:13,letterSpacing:0.3},
  ssidBadge: {flexDirection:'row',alignItems:'center',gap:5,marginTop:6,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:9,paddingVertical:4,alignSelf:'flex-start'},
  ssidBadgeText:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1},
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
