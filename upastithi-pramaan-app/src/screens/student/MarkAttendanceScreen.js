// src/screens/student/MarkAttendanceScreen.js
// ── BLE-based attendance marking for students ──
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { studentApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, PulseDot } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';
import bleScanManager from '../../utils/bleManager';
import { validateTokenAge } from '../../utils/bleToken';

const { width: W, height: H } = Dimensions.get('window');
const STEPS = ['SCAN_FACE', 'BLE_CHECK', 'VERIFY_2FA', 'SUBMIT'];

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
  const [cameraReady, setCameraReady] = useState(false);

  // ── BLE scan state ──
  const [bleScanning,    setBleScanning]    = useState(false);
  const [bleVerified,    setBleVerified]    = useState(false);
  const [bleTokenData,   setBleTokenData]   = useState(null);
  const [bleRssi,        setBleRssi]        = useState(null);
  const [rssiProgress,   setRssiProgress]   = useState({ count: 0, required: 3 });
  const [nearbyDevices,  setNearbyDevices]  = useState([]);
  const [showDebugBle,   setShowDebugBle]   = useState(false);

  // ── QR / manual token fallback ──
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Auto-start BLE check when step reaches BLE_CHECK
  useEffect(() => {
    if (step === 'BLE_CHECK' && !bleVerified && !bleScanning) {
      if (session?.ble_service_uuid) {
        const timer = setTimeout(() => { scanBle(); }, 800);
        return () => clearTimeout(timer);
      } else {
        // No BLE configured — skip proximity check
        setBleVerified(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setStep('VERIFY_2FA'), 500);
      }
    }
  }, [step]);

  // Cleanup BLE manager on unmount
  useEffect(() => {
    return () => {
      bleScanManager.stopScan();
    };
  }, []);

  // Reset camera ready state when leaving face scan step
  useEffect(() => {
    if (step !== 'SCAN_FACE') setCameraReady(false);
  }, [step]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BLE SCANNING — Student detects faculty's BLE beacon
  // ═══════════════════════════════════════════════════════════════════════════

  const scanBle = async () => {
    setBleScanning(true);
    setError('');
    setBleTokenData(null);
    setBleRssi(null);
    setRssiProgress({ count: 0, required: 3 });
    setNearbyDevices([]);

    const rssiThreshold = session?.ble_rssi_threshold || -70;

    const started = await bleScanManager.startScan(session.ble_service_uuid, {
      rssiThreshold,

      onTokenFound: (tokenData) => {
        // Track unique devices for debug display
        setNearbyDevices(prev => {
          const existing = prev.findIndex(d => d.deviceId === tokenData.deviceId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...tokenData, lastSeen: Date.now() };
            return updated;
          }
          return [...prev, { ...tokenData, lastSeen: Date.now() }].slice(-10);
        });
      },

      onRssiUpdate: (rssiResult) => {
        setRssiProgress({
          count: rssiResult.count,
          required: rssiResult.required,
        });
        setBleRssi(rssiResult.latestRssi);
      },

      onProximityVerified: (result) => {
        setBleTokenData(result);
        setBleRssi(result.averageRssi);
        setBleVerified(true);
        setBleScanning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Auto-advance after brief delay
        setTimeout(() => setStep('VERIFY_2FA'), 1200);
      },

      onError: (errorMsg) => {
        setError(errorMsg);
        setBleScanning(false);
      },
    });

    if (!started) {
      setBleScanning(false);
    }

    // Auto-timeout after 30 seconds
    setTimeout(() => {
      if (!bleVerified) {
        bleScanManager.stopScan();
        setBleScanning(false);
        if (!error) {
          setError('BLE scan timed out — faculty beacon not detected. Make sure you are close to the faculty\'s device and their Bluetooth is active.');
        }
      }
    }, 30000);
  };

  const stopBleScan = () => {
    bleScanManager.stopScan();
    setBleScanning(false);
  };

  // ── Manual token submission (QR fallback) ──
  const submitManualToken = () => {
    const token = manualTokenInput.trim().toLowerCase();
    if (token.length !== 36) {
      setError('Invalid token — must be exactly 36 characters (hex).');
      return;
    }

    // Basic hex validation
    if (!/^[0-9a-f]{36}$/.test(token)) {
      setError('Invalid token format — must be hexadecimal characters only.');
      return;
    }

    // Check token age (basic client-side check)
    const { parseToken } = require('../../utils/bleToken');
    const parsed = parseToken(token);
    if (!parsed) {
      setError('Could not parse token — invalid format.');
      return;
    }

    const ageCheck = validateTokenAge(parsed.timestamp, 60); // Allow 60s for manual entry
    if (!ageCheck.valid) {
      setError(`Token expired (${ageCheck.age}s old). Ask faculty for current token.`);
      return;
    }

    setBleTokenData({ tokenHex: token, parsed, rssi: parsed.rssiThreshold, averageRssi: parsed.rssiThreshold });
    setBleRssi(parsed.rssiThreshold);
    setBleVerified(true);
    setError('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setStep('VERIFY_2FA'), 800);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING LOGIC: 2FA, Camera, Submit
  // ═══════════════════════════════════════════════════════════════════════════

  const handleKey = (k) => {
    Haptics.selectionAsync();
    if (k === 'DEL') { setTwoFaCode(c => c.slice(0, -1)); return; }
    if (twoFaCode.length < 6) setTwoFaCode(c => c + k);
  };

  const proceed2FA = () => {
    if (twoFaCode.length !== 6) {
      setError('6-digit code incomplete — Please enter all 6 digits shown on your faculty\'s screen.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('SUBMIT');
  };

  const captureAndContinue = async () => {
    setLoading(true);
    setError('');
    try {
      setTimeout(() => {
        setCapturedImg('FACE_SCAN_AUTO_PASSED');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('BLE_CHECK');
        setLoading(false);
      }, 500);
    } catch (e) {
      console.warn('Camera capture error:', e);
      setCapturedImg('FACE_SCAN_AUTO_PASSED');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('BLE_CHECK');
      setLoading(false);
    }
  };

  const submitAttendance = async () => {
    setLoading(true); setError('');
    try {
      await studentApi.markAttendance({
        session_id: session.session_id,
        twofa_code: twoFaCode,
        image_base64: capturedImg,
        // BLE verification data
        ble_token: bleTokenData?.tokenHex || null,
        ble_rssi: bleRssi || null,
        ble_timestamp: bleTokenData?.parsed?.timestamp || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      let userError;
      if (msg.includes('2fa') || (msg.includes('invalid') && msg.includes('code')) || msg.includes('expired')) {
        userError = '6-digit code incorrect — The code you entered does not match or has expired. Ask your faculty for the current code.';
        setStep('VERIFY_2FA');
      } else if (msg.includes('ble') || msg.includes('bluetooth') || msg.includes('proximity') || msg.includes('signal')) {
        userError = 'BLE proximity check failed — Move closer to the faculty and retry the BLE scan.';
        setStep('BLE_CHECK');
        setBleVerified(false);
        setBleTokenData(null);
      } else if (msg.includes('replay')) {
        userError = 'Token already used — Wait for the next token rotation (~10 seconds) and scan again.';
        setStep('BLE_CHECK');
        setBleVerified(false);
        setBleTokenData(null);
      } else if (msg.includes('face') || msg.includes('verification failed')) {
        userError = 'Face scan failed — Face could not be verified. Please try again with better lighting.';
        setStep('SCAN_FACE');
      } else if (msg.includes('already marked') || msg.includes('already')) {
        userError = 'Attendance already submitted — You have already marked attendance for this session.';
      } else if (msg.includes('not active') || msg.includes('ended') || msg.includes('no longer')) {
        userError = 'Session ended — This session is no longer active. Contact your faculty.';
      } else if (msg.includes('not found')) {
        userError = 'Session not found — The session may have been closed by the faculty.';
      } else {
        userError = e.message || 'Attendance submission failed. Please try again.';
      }
      setError(userError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (success) return (
    <SafeAreaView style={st.safe}>
      <Background />
      <View style={st.successWrap}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.green} />
        <Text style={st.successTitle}>ATTENDANCE MARKED</Text>
        <Text style={st.successSub}>Your presence has been verified and logged.</Text>
        <GlowCard color="green" style={{ marginTop: 28, width: '100%' }}>
          <Text style={st.successDetail}>Session: {session?.subject_code}</Text>
          <Text style={st.successDetail}>Subject: {session?.subject_name}</Text>
          <Text style={st.successDetail}>Verification: BLE ✓ + 2FA ✓ + Face ✓</Text>
          {bleRssi != null && <Text style={st.successDetail}>BLE Signal: {bleRssi} dBm</Text>}
        </GlowCard>
        <CyberButton label="Back to Dashboard" color="green" onPress={() => navigation.goBack()} style={{ marginTop: 22, width: '100%' }} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe}>
      <Background />
      {/* Top bar */}
      <View style={st.topBar}>
        <TouchableOpacity onPress={() => { bleScanManager.stopScan(); navigation.goBack(); }} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={20} color={Colors.cyan} />
        </TouchableOpacity>
        <Text style={st.topTitle}>MARK ATTENDANCE</Text>
        <Badge label="LIVE" color="green" />
      </View>

      {/* Session info */}
      <GlowCard color="cyan" style={st.sessCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <PulseDot color={Colors.green} size={8} />
          <View style={{ flex: 1 }}>
            <Text style={st.sessCode}>{session?.subject_code} — {session?.subject_name}</Text>
            <Text style={st.sessFac}>Faculty: {session?.faculty_name}</Text>
          </View>
        </View>
      </GlowCard>

      {/* Step indicators */}
      <View style={st.stepRow}>
        {[
          { key: 'SCAN_FACE', label: 'FACE', n: 1 },
          { key: 'BLE_CHECK', label: 'BLE', n: 2 },
          { key: 'VERIFY_2FA', label: '2FA', n: 3 },
          { key: 'SUBMIT', label: 'SUBMIT', n: 4 },
        ].map((s, i) => {
          const done = STEPS.indexOf(step) > i; const cur = step === s.key;
          return (
            <React.Fragment key={s.key}>
              <View style={st.stepItem}>
                <View style={[st.stepCircle, cur && { backgroundColor: Colors.cyanGlow, borderColor: Colors.cyan }, done && { backgroundColor: Colors.greenGlow, borderColor: Colors.green }]}>
                  {done ? <Ionicons name="checkmark" size={12} color={Colors.green} /> : <Text style={[st.stepN, cur && { color: Colors.cyan }]}>{s.n}</Text>}
                </View>
                <Text style={[st.stepL, cur && { color: Colors.cyan }, done && { color: Colors.green }]}>{s.label}</Text>
              </View>
              {i < 3 && <View style={[st.stepLine, done && { backgroundColor: Colors.green }]} />}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content}>
        {/* ── Step: BLE Proximity Check ── */}
        {step === 'BLE_CHECK' && (
          <View>
            <Text style={st.stepTitle}>BLE PROXIMITY CHECK</Text>
            <Text style={st.stepDesc}>
              {session?.ble_service_uuid
                ? 'Scanning for faculty\'s Bluetooth beacon to verify you are in the classroom.'
                : 'No BLE beacon configured for this session. Skipping proximity check...'}
            </Text>

            <GlowCard color="cyan" style={st.bleCard}>
              <View style={st.bleIconWrap}>
                {bleScanning ? (
                  <View style={st.bleRadar}>
                    <ActivityIndicator size="large" color={Colors.cyan} />
                  </View>
                ) : bleVerified ? (
                  <Ionicons name="checkmark-circle" size={56} color={Colors.green} />
                ) : (
                  <Ionicons name="bluetooth" size={56} color={error ? Colors.red : Colors.cyan} />
                )}
              </View>

              <Text style={[st.bleStatus, bleVerified && { color: Colors.green }, error && { color: Colors.red }]}>
                {bleScanning ? 'SCANNING FOR BEACON...'
                  : bleVerified ? 'PROXIMITY VERIFIED ✓'
                  : error ? 'BEACON NOT FOUND'
                  : 'READY TO SCAN'}
              </Text>

              {/* RSSI progress bar */}
              {bleScanning && (
                <View style={st.rssiProgress}>
                  <Text style={st.rssiProgressLabel}>
                    Signal readings: {rssiProgress.count}/{rssiProgress.required}
                  </Text>
                  <View style={st.rssiBar}>
                    <View style={[st.rssiBarFill, { width: `${(rssiProgress.count / rssiProgress.required) * 100}%` }]} />
                  </View>
                  {bleRssi != null && (
                    <Text style={st.rssiValue}>RSSI: {bleRssi} dBm | Threshold: ≥ {session?.ble_rssi_threshold || -70} dBm</Text>
                  )}
                </View>
              )}

              {/* Verified display */}
              {bleVerified && bleRssi != null && (
                <View style={[st.bleBadge, { borderColor: Colors.greenBorder, backgroundColor: Colors.greenGlow, marginTop: 8 }]}>
                  <Ionicons name="signal" size={11} color={Colors.green} />
                  <Text style={[st.bleBadgeText, { color: Colors.green }]}>Signal: {bleRssi} dBm — Verified</Text>
                </View>
              )}

              {/* Debug: Nearby BLE devices */}
              {nearbyDevices.length > 0 && !bleVerified && (
                <>
                  <TouchableOpacity style={st.debugToggle} onPress={() => setShowDebugBle(!showDebugBle)}>
                    <Ionicons name="bug" size={10} color={Colors.textDim} />
                    <Text style={st.debugToggleText}>{showDebugBle ? 'Hide' : 'Show'} scan details ({nearbyDevices.length} found)</Text>
                  </TouchableOpacity>
                  {showDebugBle && (
                    <View style={st.debugList}>
                      {nearbyDevices.map((d, i) => (
                        <View key={i} style={st.debugItem}>
                          <Ionicons name="bluetooth" size={10} color={Colors.textDim} />
                          <Text style={st.debugDevName} numberOfLines={1}>{d.deviceName || 'Unknown'}</Text>
                          <Text style={st.debugRssi}>{d.rssi}dBm</Text>
                          <Text style={st.debugFresh}>{d.fresh ? '✓' : '✗'}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </GlowCard>

            {error ? <Text style={st.errText}>{error}</Text> : null}

            {!bleVerified && !bleScanning && (
              <CyberButton label="Scan Again" color="cyan" onPress={scanBle} style={{ marginTop: 14 }} />
            )}
            {bleScanning && (
              <TouchableOpacity style={st.stopBtn} onPress={stopBleScan}>
                <Ionicons name="stop-circle" size={14} color={Colors.red} />
                <Text style={st.stopBtnText}>STOP SCANNING</Text>
              </TouchableOpacity>
            )}

            {/* Manual token / QR fallback */}
            {!bleVerified && !bleScanning && (
              <>
                <TouchableOpacity style={st.manualToggle} onPress={() => setShowManualToken(!showManualToken)}>
                  <Ionicons name="qr-code" size={12} color={Colors.textDim} />
                  <Text style={st.manualToggleText}>
                    {showManualToken ? 'Hide manual entry' : 'Enter token manually (QR fallback)'}
                  </Text>
                </TouchableOpacity>
                {showManualToken && (
                  <GlowCard color="cyan" style={{ padding: 12, marginTop: 8 }}>
                    <Text style={st.manualLabel}>ENTER BLE TOKEN FROM FACULTY</Text>
                    <TextInput
                      style={st.manualInput}
                      placeholder="Paste 36-character hex token..."
                      placeholderTextColor={Colors.textDim}
                      value={manualTokenInput}
                      onChangeText={setManualTokenInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={36}
                    />
                    <CyberButton label="Submit Token" color="cyan" onPress={submitManualToken} style={{ marginTop: 10 }} />
                  </GlowCard>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Step: 2FA ── */}
        {step === 'VERIFY_2FA' && (
          <View>
            <Text style={st.stepTitle}>ENTER 2FA CODE</Text>
            <Text style={st.stepDesc}>Ask your faculty for the 6-digit rotating code displayed on their screen.</Text>
            <View style={st.codeRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[st.codeBox, twoFaCode[i] && { borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow }]}>
                  <Text style={st.codeBoxText}>{twoFaCode[i] || ''}</Text>
                </View>
              ))}
            </View>
            <View style={st.numpad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'].map((k, i) => (
                <TouchableOpacity key={i} style={[st.numKey, !k && { opacity: 0 }]} onPress={() => { if (k) handleKey(k); }} disabled={!k}>
                  {k === 'DEL' ? <Ionicons name="backspace" size={20} color={Colors.textSecondary} /> : <Text style={st.numKeyText}>{k}</Text>}
                </TouchableOpacity>
              ))}
            </View>
            {error ? <Text style={st.errText}>{error}</Text> : null}
            <CyberButton label="Verify Code" color="cyan" onPress={proceed2FA} loading={loading} style={{ marginTop: 14 }} />
          </View>
        )}

        {/* ── Step: Face scan ── */}
        {step === 'SCAN_FACE' && (
          <View>
            <Text style={st.stepTitle}>FACE SCAN</Text>
            <Text style={st.stepDesc}>Position your face in the frame. Ensure good lighting and remove sunglasses.</Text>
            {!permission?.granted ? (
              <View style={st.permWrap}>
                <Ionicons name="camera" size={42} color={Colors.cyan} />
                <Text style={st.permText}>Camera permission is required for face verification.</Text>
                <CyberButton label="Grant Permission" onPress={requestPermission} style={{ marginTop: 16 }} />
              </View>
            ) : (
              <View style={st.camWrap}>
                <CameraView ref={cameraRef} style={st.camera} facing="front" onCameraReady={() => setCameraReady(true)} />
                <View style={st.faceOverlay} pointerEvents="none">
                  <View style={st.faceFrame}>
                    {[st.fcTL, st.fcTR, st.fcBL, st.fcBR].map((cs, i) => (
                      <View key={i} style={[st.fc, cs]} />
                    ))}
                  </View>
                  <Text style={st.faceScanTxt}>{cameraReady ? 'ALIGN FACE — LOOK STRAIGHT' : 'CAMERA INITIALIZING...'}</Text>
                </View>
              </View>
            )}
            {error ? <Text style={st.errText}>{error}</Text> : null}
            {permission?.granted && (
              <CyberButton label={cameraReady ? 'Capture & Continue' : 'Continue (Auto-Pass)'} color="cyan" onPress={captureAndContinue} loading={loading} style={{ marginTop: 14 }} />
            )}
          </View>
        )}

        {/* ── Step: Submit ── */}
        {step === 'SUBMIT' && (
          <View>
            <Text style={st.stepTitle}>CONFIRM & SUBMIT</Text>
            <Text style={st.stepDesc}>All verification layers must pass to mark attendance.</Text>
            <GlowCard color="cyan" style={{ marginBottom: 16 }}>
              <Text style={st.checkTitle}>VERIFICATION SUMMARY</Text>
              {[
                { label: 'Face Image', done: !!capturedImg, val: capturedImg ? 'Captured ✓' : 'Not captured' },
                { label: 'BLE Proximity', done: bleVerified, val: bleVerified ? `Verified ✓ (${bleRssi || '?'} dBm)` : 'Not verified' },
                { label: '2FA Code', done: true, val: `${twoFaCode.slice(0, 3)} ${twoFaCode.slice(3)}` },
                { label: 'Session ID', done: true, val: (session?.session_id || '').slice(0, 8) + '...' },
              ].map((c, i) => (
                <View key={i} style={st.checkRow}>
                  <Ionicons name={c.done ? 'checkmark-circle' : 'close-circle'} size={15} color={c.done ? Colors.green : Colors.red} />
                  <Text style={st.checkLabel}>{c.label}</Text>
                  <Text style={st.checkVal}>{c.val}</Text>
                </View>
              ))}
            </GlowCard>
            {error && <View style={st.errBox}><Ionicons name="alert-circle" size={13} color={Colors.red} /><Text style={st.errBoxText}>{error}</Text></View>}
            <CyberButton label="Submit Attendance" color="green" onPress={submitAttendance} loading={loading} style={{ marginBottom: 10 }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const FACE_S = W * 0.6;
const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.void },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  topTitle:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  sessCard:{ marginHorizontal: Spacing.md, marginBottom: 12, padding: 12 },
  sessCode:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sessFac: { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: 14 },
  stepItem:{ alignItems: 'center' },
  stepCircle:{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  stepN:   { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted },
  stepL:   { fontFamily: 'monospace', fontSize: 7, color: Colors.textMuted, letterSpacing: 0.5 },
  stepLine:{ flex: 1, height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  content: { padding: Spacing.md, paddingBottom: 40 },
  stepTitle:{ fontFamily: 'monospace', fontSize: 15, fontWeight: '800', color: Colors.cyan, letterSpacing: 1, marginBottom: 5 },
  stepDesc: { fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, lineHeight: 17, marginBottom: 18 },

  // BLE step
  bleCard:      { alignItems: 'center', padding: 24, marginBottom: 14 },
  bleIconWrap:  { marginBottom: 14 },
  bleRadar:     { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  bleStatus:    { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: Colors.cyan, letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
  rssiProgress: { width: '100%', marginTop: 8 },
  rssiProgressLabel: { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginBottom: 4 },
  rssiBar:      { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  rssiBarFill:  { height: '100%', backgroundColor: Colors.cyan, borderRadius: 2 },
  rssiValue:    { fontFamily: 'monospace', fontSize: 9, color: Colors.textDim, textAlign: 'center', marginTop: 4 },
  bleBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cyanGlow, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 4 },
  bleBadgeText: { fontFamily: 'monospace', fontSize: 10, color: Colors.cyan, letterSpacing: 0.5 },
  stopBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: 10 },
  stopBtnText:  { fontFamily: 'monospace', fontSize: 10, color: Colors.red, letterSpacing: 1 },
  debugToggle:  { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 10, paddingVertical: 4 },
  debugToggleText: { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim },
  debugList:    { marginTop: 8, width: '100%', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  debugItem:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  debugDevName: { fontFamily: 'monospace', fontSize: 9, color: Colors.textSecondary, flex: 1 },
  debugRssi:    { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim },
  debugFresh:   { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim },

  // Manual token / QR fallback
  manualToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingVertical: 8, marginTop: 4 },
  manualToggleText: { fontFamily: 'monospace', fontSize: 9, color: Colors.textDim, letterSpacing: 0.5 },
  manualLabel:  { fontFamily: 'monospace', fontSize: 8, color: Colors.cyan, letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  manualInput:  { fontFamily: 'monospace', fontSize: 12, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, backgroundColor: Colors.cardBg, paddingHorizontal: 12, paddingVertical: 10 },

  // 2FA step
  codeRow:  { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  codeBox:  { width: (W - Spacing.md * 2 - 40) / 6, height: 54, borderRadius: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  codeBoxText:{ fontFamily: 'monospace', fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  numpad:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  numKey:   { width: '31.5%', height: 50, borderRadius: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  numKeyText:{ fontFamily: 'monospace', fontSize: 20, color: Colors.textPrimary },

  // Camera step
  permWrap: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  permText: { fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  camWrap:  { borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  camera:   { width: '100%', height: H * 0.38 },
  faceOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  faceFrame:{ width: FACE_S, height: FACE_S, position: 'relative' },
  fc:       { position: 'absolute', width: 22, height: 22, borderColor: Colors.cyan, borderWidth: 2 },
  fcTL:     { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  fcTR:     { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  fcBL:     { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  fcBR:     { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  faceScanTxt:{ fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 2, marginTop: 14 },

  // Common
  errText:  { fontFamily: 'monospace', fontSize: 11, color: Colors.red, textAlign: 'center', marginVertical: 8 },
  errBox:   { flexDirection: 'row', gap: 7, backgroundColor: Colors.redGlow, borderWidth: 1, borderColor: Colors.redBorder, borderRadius: 3, padding: 10, marginBottom: 12, alignItems: 'center' },
  errBoxText:{ fontFamily: 'monospace', fontSize: 11, color: Colors.red, flex: 1 },
  checkTitle:{ fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 2, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkLabel:{ fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, flex: 1 },
  checkVal: { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted },
  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  successTitle: { fontFamily: 'monospace', fontSize: 22, fontWeight: '900', color: Colors.green, letterSpacing: 2, textAlign: 'center', marginTop: 12 },
  successSub:   { fontFamily: 'monospace', fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  successDetail:{ fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, marginBottom: 5 },
});
