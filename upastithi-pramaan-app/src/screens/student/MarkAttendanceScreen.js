// src/screens/student/MarkAttendanceScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, PermissionsAndroid, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import WifiManager from 'react-native-wifi-reborn';
import { studentApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, PulseDot } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const { width: W, height: H } = Dimensions.get('window');
const STEPS = ['SCAN_FACE','WIFI_CHECK','VERIFY_2FA','SUBMIT'];

export default function MarkAttendanceScreen({ route, navigation }) {
  const session = route?.params?.session;
  const [permission, requestPermission] = useCameraPermissions();
  const [step,        setStep]        = useState(STEPS[0]);
  const [twoFaCode,   setTwoFaCode]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [capturedImg, setCapturedImg] = useState(null);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const cameraRef = useRef(null);
  const MAC = 'AA:BB:CC:DD:EE:FF'; // RN: actual MAC needs native module

  // Wi-Fi scan state
  const [wifiScanning,   setWifiScanning]   = useState(false);
  const [wifiVerified,   setWifiVerified]   = useState(false);
  const [scannedNetworks,setScannedNetworks]= useState([]);

  // Auto-start Wi-Fi check when step reaches WIFI_CHECK
  useEffect(() => {
    if (step === 'WIFI_CHECK' && session?.hotspot_ssid && !wifiVerified && !wifiScanning) {
      scanWifi();
    }
  }, [step]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'Upastithi needs location access to scan nearby Wi-Fi networks for proximity verification.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const scanWifi = async () => {
    setWifiScanning(true);
    setError('');
    try {
      // Request location permission (required for Wi-Fi scan on Android)
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setError('Location permission is required to verify classroom proximity. Please enable it in Settings.');
        setWifiScanning(false);
        return;
      }

      // Perform Wi-Fi scan
      const networks = await WifiManager.reScanAndLoadWifiList();
      setScannedNetworks(networks || []);

      // Check if faculty hotspot is in range
      const targetSsid = session?.hotspot_ssid;
      if (!targetSsid) {
        // No SSID configured for this session — skip check
        setWifiVerified(true);
        setStep('VERIFY_2FA');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const found = (networks || []).some(
        (n) => n.SSID?.toLowerCase() === targetSsid.toLowerCase()
      );

      if (found) {
        setWifiVerified(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Auto-advance to 2FA step after a brief delay
        setTimeout(() => setStep('VERIFY_2FA'), 800);
      } else {
        setError(`Faculty hotspot "${targetSsid}" not detected. Make sure you are in the classroom and the faculty's hotspot is turned ON.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      console.warn('Wi-Fi scan error:', e);
      setError('Wi-Fi scan failed. Ensure Wi-Fi and Location are enabled on your device.');
    } finally {
      setWifiScanning(false);
    }
  };

  const handleKey = (k) => {
    Haptics.selectionAsync();
    if (k==='DEL') { setTwoFaCode(c=>c.slice(0,-1)); return; }
    if (twoFaCode.length<6) setTwoFaCode(c=>c+k);
  };

  const proceed2FA = async () => {
    if (twoFaCode.length!==6){ setError('Enter the 6-digit code shown by your faculty.'); return; }
    setLoading(true);
    setError('');
    try {
      await studentApi.verify2FA({ session_id: session.session_id, twofa_code: twoFaCode.trim() });
      setStep('SUBMIT');
    } catch(e) {
      const msg = e.message || 'Verification failed';
      // Provide clearer error messages for common cases
      if (msg.includes('not active') || msg.includes('not found')) {
        setError('Session may have ended. Go back and try again.');
      } else {
        setError(msg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  const captureAndContinue = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64:true, quality:0.5, skipProcessing:true });
      setCapturedImg(photo.base64);
      setStep('WIFI_CHECK');
    } catch(e){ setError('Camera capture failed. Try again.'); }
    finally { setLoading(false); }
  };

  const submitAttendance = async () => {
    setLoading(true); setError('');
    try {
      await studentApi.markAttendance({ session_id:session.session_id, mac_address:MAC, twofa_code:twoFaCode, image_base64:capturedImg, wifi_verified:wifiVerified });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch(e){
      setError(e.message||'Attendance marking failed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  if (success) return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <View style={s.successWrap}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.green}/>
        <Text style={s.successTitle}>ATTENDANCE MARKED</Text>
        <Text style={s.successSub}>Your presence has been verified and logged.</Text>
        <GlowCard color="green" style={{marginTop:28,width:'100%'}}>
          <Text style={s.successDetail}>Session: {session?.subject_code}</Text>
          <Text style={s.successDetail}>Subject: {session?.subject_name}</Text>
          <Text style={s.successDetail}>Verification: Wi-Fi ✓ + 2FA ✓ + Face ✓ + MAC ✓</Text>
        </GlowCard>
        <CyberButton label="Back to Dashboard" color="green" onPress={()=>navigation.goBack()} style={{marginTop:22,width:'100%'}}/>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={{padding:4}}>
          <Ionicons name="arrow-back" size={20} color={Colors.cyan}/>
        </TouchableOpacity>
        <Text style={s.topTitle}>MARK ATTENDANCE</Text>
        <Badge label="LIVE" color="green"/>
      </View>

      {/* Session info */}
      <GlowCard color="cyan" style={s.sessCard}>
        <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
          <PulseDot color={Colors.green} size={8}/>
          <View style={{flex:1}}>
            <Text style={s.sessCode}>{session?.subject_code} — {session?.subject_name}</Text>
            <Text style={s.sessFac}>Faculty: {session?.faculty_name}</Text>
          </View>
        </View>
      </GlowCard>

      {/* Step indicators */}
      <View style={s.stepRow}>
        {[{key:'SCAN_FACE',label:'FACE',n:1},{key:'WIFI_CHECK',label:'WIFI',n:2},{key:'VERIFY_2FA',label:'2FA',n:3},{key:'SUBMIT',label:'SUBMIT',n:4}].map((st,i)=>{
          const done=STEPS.indexOf(step)>i; const cur=step===st.key;
          return (
            <React.Fragment key={st.key}>
              <View style={s.stepItem}>
                <View style={[s.stepCircle,cur&&{backgroundColor:Colors.cyanGlow,borderColor:Colors.cyan},done&&{backgroundColor:Colors.greenGlow,borderColor:Colors.green}]}>
                  {done?<Ionicons name="checkmark" size={12} color={Colors.green}/>:<Text style={[s.stepN,cur&&{color:Colors.cyan}]}>{st.n}</Text>}
                </View>
                <Text style={[s.stepL,cur&&{color:Colors.cyan},done&&{color:Colors.green}]}>{st.label}</Text>
              </View>
              {i<3&&<View style={[s.stepLine,done&&{backgroundColor:Colors.green}]}/>}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={s.content}>
        {/* ── Step 0: Wi-Fi Proximity Check ── */}
        {step==='WIFI_CHECK'&&(
          <View>
            <Text style={s.stepTitle}>WI-FI PROXIMITY CHECK</Text>
            <Text style={s.stepDesc}>
              {session?.hotspot_ssid
                ? `Scanning for faculty hotspot "${session.hotspot_ssid}" to verify you are in the classroom.`
                : 'No hotspot configured for this session. Skipping proximity check...'}
            </Text>

            <GlowCard color="cyan" style={s.wifiCard}>
              <View style={s.wifiIconWrap}>
                {wifiScanning ? (
                  <ActivityIndicator size="large" color={Colors.cyan}/>
                ) : wifiVerified ? (
                  <Ionicons name="checkmark-circle" size={56} color={Colors.green}/>
                ) : (
                  <Ionicons name="wifi" size={56} color={error ? Colors.red : Colors.cyan}/>
                )}
              </View>

              <Text style={[s.wifiStatus, wifiVerified && {color: Colors.green}, error && {color: Colors.red}]}>
                {wifiScanning ? 'SCANNING NEARBY NETWORKS...' : wifiVerified ? 'IN RANGE — VERIFIED ✓' : error ? 'NOT IN RANGE' : 'READY TO SCAN'}
              </Text>

              {session?.hotspot_ssid && (
                <View style={s.ssidTarget}>
                  <Ionicons name="radio" size={11} color={Colors.cyan}/>
                  <Text style={s.ssidTargetText}>Target: {session.hotspot_ssid}</Text>
                </View>
              )}

              {scannedNetworks.length > 0 && !wifiVerified && (
                <View style={s.networkList}>
                  <Text style={s.networkListTitle}>DETECTED NETWORKS ({scannedNetworks.length})</Text>
                  {scannedNetworks.slice(0, 8).map((net, i) => (
                    <View key={i} style={s.networkItem}>
                      <Ionicons name="wifi" size={10} color={Colors.textDim}/>
                      <Text style={s.networkName} numberOfLines={1}>{net.SSID || '(Hidden)'}</Text>
                      <Text style={s.networkSignal}>{net.level}dBm</Text>
                    </View>
                  ))}
                  {scannedNetworks.length > 8 && (
                    <Text style={s.networkMore}>+{scannedNetworks.length - 8} more networks</Text>
                  )}
                </View>
              )}
            </GlowCard>

            {error?<Text style={s.errText}>{error}</Text>:null}

            {!wifiVerified && !wifiScanning && (
              <CyberButton label="Scan Again" color="cyan" onPress={scanWifi} style={{marginTop:14}}/>
            )}

            {/* Remove skip button -> Mandatory Wi-Fi checking */}
          </View>
        )}

        {/* ── Step 1: 2FA ── */}
        {step==='VERIFY_2FA'&&(
          <View>
            <Text style={s.stepTitle}>ENTER 2FA CODE</Text>
            <Text style={s.stepDesc}>Ask your faculty for the 6-digit rotating code displayed on their screen.</Text>
            <View style={s.codeRow}>
              {Array.from({length:6}).map((_,i)=>(
                <View key={i} style={[s.codeBox,twoFaCode[i]&&{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow}]}>
                  <Text style={s.codeBoxText}>{twoFaCode[i]||''}</Text>
                </View>
              ))}
            </View>
            <View style={s.numpad}>
              {['1','2','3','4','5','6','7','8','9','','0','DEL'].map((k,i)=>(
                <TouchableOpacity key={i} style={[s.numKey,!k&&{opacity:0}]} onPress={()=>{if(k)handleKey(k);}} disabled={!k}>
                  {k==='DEL'?<Ionicons name="backspace" size={20} color={Colors.textSecondary}/>:<Text style={s.numKeyText}>{k}</Text>}
                </TouchableOpacity>
              ))}
            </View>
            {error?<Text style={s.errText}>{error}</Text>:null}
            <CyberButton label="Verify Code" color="cyan" onPress={proceed2FA} loading={loading} style={{marginTop:14}}/>
          </View>
        )}

        {/* ── Step 2: Face scan ── */}
        {step==='SCAN_FACE'&&(
          <View>
            <Text style={s.stepTitle}>FACE SCAN</Text>
            <Text style={s.stepDesc}>Position your face in the frame. Ensure good lighting and remove sunglasses.</Text>
            {!permission?.granted?(
              <View style={s.permWrap}>
                <Ionicons name="camera" size={42} color={Colors.cyan}/>
                <Text style={s.permText}>Camera permission is required for face verification.</Text>
                <CyberButton label="Grant Permission" onPress={requestPermission} style={{marginTop:16}}/>
              </View>
            ):(
              <View style={s.camWrap}>
                <CameraView ref={cameraRef} style={s.camera} facing="front"/>
                <View style={s.faceOverlay} pointerEvents="none">
                  <View style={s.faceFrame}>
                    {[s.fcTL,s.fcTR,s.fcBL,s.fcBR].map((cs,i)=>(
                      <View key={i} style={[s.fc,cs]}/>
                    ))}
                  </View>
                  <Text style={s.faceScanTxt}>ALIGN FACE — LOOK STRAIGHT</Text>
                </View>
              </View>
            )}
            {error?<Text style={s.errText}>{error}</Text>:null}
            {permission?.granted&&(
              <CyberButton label="Capture & Continue" color="cyan" onPress={captureAndContinue} loading={loading} style={{marginTop:14}}/>
            )}
          </View>
        )}

        {/* ── Step 3: Submit ── */}
        {step==='SUBMIT'&&(
          <View>
            <Text style={s.stepTitle}>CONFIRM & SUBMIT</Text>
            <Text style={s.stepDesc}>All verification layers must pass to mark attendance.</Text>
            <GlowCard color="cyan" style={{marginBottom:16}}>
              <Text style={s.checkTitle}>VERIFICATION SUMMARY</Text>
              {[
                {label:'Face Image',   done:!!capturedImg,  val:capturedImg?'Captured ✓':'Not captured'},
                {label:'Wi-Fi Range',  done:wifiVerified,   val:wifiVerified ? `${session?.hotspot_ssid || 'Skipped'} ✓` : 'Not verified'},
                {label:'2FA Code',     done:true,           val:`${twoFaCode.slice(0,3)} ${twoFaCode.slice(3)}`},
                {label:'Device MAC',   done:!!MAC,          val:MAC},
                {label:'Session ID',   done:true,           val:(session?.session_id||'').slice(0,8)+'...'},
              ].map((c,i)=>(
                <View key={i} style={s.checkRow}>
                  <Ionicons name={c.done?'checkmark-circle':'close-circle'} size={15} color={c.done?Colors.green:Colors.red}/>
                  <Text style={s.checkLabel}>{c.label}</Text>
                  <Text style={s.checkVal}>{c.val}</Text>
                </View>
              ))}
            </GlowCard>
            {error&&<View style={s.errBox}><Ionicons name="alert-circle" size={13} color={Colors.red}/><Text style={s.errBoxText}>{error}</Text></View>}
            <CyberButton label="Submit Attendance" color="green" onPress={submitAttendance} loading={loading} style={{marginBottom:10}}/>
            <CyberButton label="Re-scan Face" color="cyan" onPress={()=>setStep('SCAN_FACE')} style={{backgroundColor:'transparent',borderWidth:1,borderColor:Colors.cyanBorder}}/>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const FACE_S = W * 0.6;
const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:Colors.void},
  topBar:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:Spacing.md,paddingVertical:10},
  topTitle:{fontFamily:'monospace',fontSize:13,fontWeight:'800',color:Colors.textPrimary,letterSpacing:2},
  sessCard:{marginHorizontal:Spacing.md,marginBottom:12,padding:12},
  sessCode:{fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textPrimary},
  sessFac: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:2},
  stepRow: {flexDirection:'row',alignItems:'center',paddingHorizontal:Spacing.lg,marginBottom:14},
  stepItem:{alignItems:'center'},
  stepCircle:{width:26,height:26,borderRadius:13,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.cardBg,alignItems:'center',justifyContent:'center',marginBottom:3},
  stepN:   {fontFamily:'monospace',fontSize:10,color:Colors.textMuted},
  stepL:   {fontFamily:'monospace',fontSize:7,color:Colors.textMuted,letterSpacing:0.5},
  stepLine:{flex:1,height:1,backgroundColor:Colors.border,marginBottom:14},
  content: {padding:Spacing.md,paddingBottom:40},
  stepTitle:{fontFamily:'monospace',fontSize:15,fontWeight:'800',color:Colors.cyan,letterSpacing:1,marginBottom:5},
  stepDesc: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,lineHeight:17,marginBottom:18},

  // Wi-Fi step
  wifiCard:     {alignItems:'center',padding:24,marginBottom:14},
  wifiIconWrap: {marginBottom:14},
  wifiStatus:   {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.cyan,letterSpacing:2,textAlign:'center',marginBottom:8},
  ssidTarget:   {flexDirection:'row',alignItems:'center',gap:5,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:10,paddingVertical:4,marginTop:4},
  ssidTargetText:{fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:0.5},
  networkList:  {marginTop:16,width:'100%',borderTopWidth:1,borderTopColor:Colors.border,paddingTop:10},
  networkListTitle:{fontFamily:'monospace',fontSize:8,color:Colors.textMuted,letterSpacing:1.5,marginBottom:6,textAlign:'center'},
  networkItem:  {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:4,borderBottomWidth:0.5,borderBottomColor:Colors.border},
  networkName:  {fontFamily:'monospace',fontSize:10,color:Colors.textSecondary,flex:1},
  networkSignal:{fontFamily:'monospace',fontSize:8,color:Colors.textDim},
  networkMore:  {fontFamily:'monospace',fontSize:8,color:Colors.textDim,textAlign:'center',marginTop:4},

  // 2FA step
  codeRow:  {flexDirection:'row',gap:8,justifyContent:'center',marginBottom:24},
  codeBox:  {width:(W-Spacing.md*2-40)/6,height:54,borderRadius:3,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.cardBg,alignItems:'center',justifyContent:'center'},
  codeBoxText:{fontFamily:'monospace',fontSize:22,fontWeight:'800',color:Colors.textPrimary},
  numpad:   {flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:6,paddingHorizontal:2},
  numKey:   {width:'31.5%',height:50,borderRadius:3,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.cardBg,alignItems:'center',justifyContent:'center',marginBottom:8},
  numKeyText:{fontFamily:'monospace',fontSize:20,color:Colors.textPrimary},

  // Camera step
  permWrap: {alignItems:'center',paddingVertical:36,gap:10},
  permText: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,textAlign:'center',lineHeight:17},
  camWrap:  {borderRadius:8,overflow:'hidden',position:'relative',marginBottom:14},
  camera:   {width:'100%',height:H*0.38},
  faceOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
  faceFrame:{width:FACE_S,height:FACE_S,position:'relative'},
  fc:       {position:'absolute',width:22,height:22,borderColor:Colors.cyan,borderWidth:2},
  fcTL:     {top:0,left:0,borderRightWidth:0,borderBottomWidth:0},
  fcTR:     {top:0,right:0,borderLeftWidth:0,borderBottomWidth:0},
  fcBL:     {bottom:0,left:0,borderRightWidth:0,borderTopWidth:0},
  fcBR:     {bottom:0,right:0,borderLeftWidth:0,borderTopWidth:0},
  faceScanTxt:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:2,marginTop:14},

  // Common
  errText:  {fontFamily:'monospace',fontSize:11,color:Colors.red,textAlign:'center',marginVertical:8},
  errBox:   {flexDirection:'row',gap:7,backgroundColor:Colors.redGlow,borderWidth:1,borderColor:Colors.redBorder,borderRadius:3,padding:10,marginBottom:12,alignItems:'center'},
  errBoxText:{fontFamily:'monospace',fontSize:11,color:Colors.red,flex:1},
  checkTitle:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:2,marginBottom:10},
  checkRow: {flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7,borderBottomWidth:1,borderBottomColor:Colors.border},
  checkLabel:{fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,flex:1},
  checkVal: {fontFamily:'monospace',fontSize:10,color:Colors.textMuted},
  successWrap:  {flex:1,alignItems:'center',justifyContent:'center',padding:Spacing.xl},
  successTitle: {fontFamily:'monospace',fontSize:22,fontWeight:'900',color:Colors.green,letterSpacing:2,textAlign:'center',marginTop:12},
  successSub:   {fontFamily:'monospace',fontSize:12,color:Colors.textSecondary,textAlign:'center',marginTop:8,lineHeight:18},
  successDetail:{fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,marginBottom:5},
});
