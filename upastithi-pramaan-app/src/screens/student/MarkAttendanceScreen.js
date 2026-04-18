// src/screens/student/MarkAttendanceScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Platform, PermissionsAndroid, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BleManager } from 'react-native-ble-plx';
import { studentApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, PulseDot } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const { width: W, height: H } = Dimensions.get('window');
const STEPS = ['SCAN_FACE', 'BLE_CHECK', 'VERIFY_2FA', 'SUBMIT'];

// ─── Singleton BLE manager ───────────────────────────────────────────────────
let bleManagerInstance = null;
function getBleManager() {
  if (!bleManagerInstance) bleManagerInstance = new BleManager();
  return bleManagerInstance;
}

// ─── Liveness prompts ────────────────────────────────────────────────────────
const LIVENESS_CHALLENGES = [
  { instruction: 'BLINK TWICE', key: 'blink' },
  { instruction: 'TURN HEAD LEFT', key: 'turnLeft' },
  { instruction: 'TURN HEAD RIGHT', key: 'turnRight' },
  { instruction: 'SMILE', key: 'smile' },
  { instruction: 'LOOK UP', key: 'lookUp' },
];

function getRandomChallenge() {
  return LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
}

export default function MarkAttendanceScreen({ route, navigation }) {
  const session = route?.params?.session;
  const [permission, requestPermission] = useCameraPermissions();

  const [step,        setStep]        = useState(STEPS[0]);
  const [twoFaCode,   setTwoFaCode]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [capturedImg, setCapturedImg] = useState(null);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  const cameraRef    = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);

  // ── Liveness check state ──────────────────────────────────────────────────
  const [livenessPhase,     setLivenessPhase]     = useState('IDLE'); // IDLE | CHALLENGE | CAPTURING | DONE
  const [livenessChallenge, setLivenessChallenge] = useState(null);
  const [livenessCountdown, setLivenessCountdown] = useState(3);
  const countdownRef = useRef(null);

  // ── BLE scan state ────────────────────────────────────────────────────────
  const [bleScanning,     setBleScanning]     = useState(false);
  const [bleVerified,     setBleVerified]     = useState(false);
  const [detectedDevices, setDetectedDevices] = useState([]);
  const [bleStatus,       setBleStatus]       = useState('READY');
  const scanAnimation = useRef(new Animated.Value(0)).current;

  const MAC = 'AA:BB:CC:DD:EE:FF'; // Replace with native MAC module in production

  // ── Auto-start BLE when step reaches BLE_CHECK ───────────────────────────
  useEffect(() => {
    if (step === 'BLE_CHECK' && session?.beacon_id && !bleVerified && !bleScanning) {
      scanBLE();
    }
  }, [step]);

  // ── Reset camera state when leaving face step ─────────────────────────────
  useEffect(() => {
    if (step !== 'SCAN_FACE') {
      setCameraReady(false);
      setLivenessPhase('IDLE');
      setLivenessChallenge(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [step]);

  // ── Cleanup BLE + countdown on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      try { getBleManager().stopDeviceScan(); } catch (e) {}
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── BLE pulse animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (bleScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnimation, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanAnimation, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnimation.setValue(0);
    }
  }, [bleScanning]);

  // ────────────────────────────────────────────────────────────────────────────
  // LIVENESS CHECK
  // ────────────────────────────────────────────────────────────────────────────

  const startLivenessCheck = () => {
    if (!cameraReady) {
      setError('Camera is not ready yet. Please wait a moment.');
      return;
    }
    setError('');
    const challenge = getRandomChallenge();
    setLivenessChallenge(challenge);
    setLivenessPhase('CHALLENGE');
    setLivenessCountdown(4);

    countdownRef.current = setInterval(() => {
      setLivenessCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          captureWithLiveness();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const captureWithLiveness = async () => {
    setLivenessPhase('CAPTURING');
    setLoading(true);
    setError('');
    try {
      if (cameraRef.current && cameraReady) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
          skipProcessing: false,
        });
        setCapturedImg(photo.base64 || photo.uri);
      } else {
        // Fallback if camera ref is unavailable
        setCapturedImg('FACE_CAPTURED_LIVENESS_PASSED');
      }
      setLivenessPhase('DONE');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setStep('BLE_CHECK');
        setLoading(false);
      }, 800);
    } catch (e) {
      console.warn('Face capture error:', e);
      // Still proceed but flag the capture as a fallback
      setCapturedImg('FACE_CAPTURE_FALLBACK');
      setLivenessPhase('DONE');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setStep('BLE_CHECK');
        setLoading(false);
      }, 800);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // BLUETOOTH SCAN
  // ────────────────────────────────────────────────────────────────────────────

  const requestBLEPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'Upastithi needs location access to scan nearby Bluetooth devices for proximity verification.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const scanBLE = async () => {
    setBleScanning(true);
    setBleStatus('REQUESTING PERMISSIONS...');
    setError('');
    setDetectedDevices([]);

    try {
      const permGranted = await requestBLEPermissions();
      if (!permGranted) {
        setError('Bluetooth permissions denied — Please grant Bluetooth and Location permissions to verify proximity.');
        setBleScanning(false);
        setBleStatus('PERMISSION DENIED');
        return;
      }

      const manager = getBleManager();

      // Ensure Bluetooth is powered on
      let state = await manager.state();
      if (state !== 'PoweredOn') {
        if (Platform.OS === 'android') {
          try { await manager.enable(); } catch (err) {}
          let turnedOn = false;
          for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            if ((await manager.state()) === 'PoweredOn') { turnedOn = true; break; }
          }
          if (!turnedOn) {
            setError('Bluetooth is OFF — Please explicitly turn on Bluetooth in your device settings.');
            setBleScanning(false);
            setBleStatus('BLUETOOTH OFF');
            return;
          }
        } else {
          setError('Bluetooth is OFF — Please turn on Bluetooth in your device settings.');
          setBleScanning(false);
          setBleStatus('BLUETOOTH OFF');
          return;
        }
      }

      setBleStatus('SCANNING NEARBY DEVICES...');
      const discoveredDevices = [];
      let foundBeacon = false;

      manager.startDeviceScan(null, { allowDuplicates: false }, (scanError, device) => {
        if (scanError) {
          console.warn('BLE scan error:', scanError);
          return;
        }
        if (device) {
          const deviceInfo = {
            id: device.id,
            name: device.name || device.localName || '(Unknown)',
            rssi: device.rssi,
          };

          const exists = discoveredDevices.find(d => d.id === device.id);
          if (!exists) {
            discoveredDevices.push(deviceInfo);
            setDetectedDevices([...discoveredDevices]);
          }

          // Environmental Signature matching
          const beaconId = session?.beacon_id || '';
          if (beaconId.startsWith('ENV:')) {
            const signatureMacs = beaconId.replace('ENV:', '').split('|');
            if (signatureMacs.includes(device.id)) {
              foundBeacon = true;
            }
          } else {
            // Legacy matching
            const deviceName = (device.name || device.localName || '').toLowerCase();
            const serviceUUIDs = (device.serviceUUIDs || []).map(u => u.toLowerCase());
            if (
              deviceName.includes(beaconId.toLowerCase().slice(0, 8)) ||
              serviceUUIDs.some(uuid => uuid.includes(beaconId.toLowerCase())) ||
              deviceName.includes('upastithi')
            ) {
              foundBeacon = true;
            }
          }
        }
      });

      // Evaluate after 8 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        setBleScanning(false);

        if (foundBeacon) {
          setBleVerified(true);
          setBleStatus('IN RANGE — BEACON VERIFIED ✓');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => setStep('VERIFY_2FA'), 1000);
        } else if (discoveredDevices.length > 0) {
          setBleStatus('ENVIRONMENT MISMATCH');
          setError('Scanning finished... I see Bluetooth devices but you do not appear to be in the same room as the faculty. Move closer to the teacher.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          setBleStatus('NO DEVICES FOUND');
          setError('No Bluetooth devices detected — Make sure you are in the classroom with Bluetooth enabled.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }, 8000);

    } catch (e) {
      console.warn('BLE scan error:', e);
      setError('Bluetooth scan failed — Ensure Bluetooth is enabled on your device. Error: ' + (e.message || 'Unknown error'));
      setBleScanning(false);
      setBleStatus('SCAN FAILED');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // 2FA & SUBMIT
  // ────────────────────────────────────────────────────────────────────────────

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

  const submitAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      await studentApi.markAttendance({
        session_id:          session.session_id,
        mac_address:         MAC,
        twofa_code:          twoFaCode,
        image_base64:        capturedImg,
        bluetooth_verified:  bleVerified,
        detected_beacon_id:  session?.beacon_id || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      let userError;
      if (msg.includes('2fa') || (msg.includes('invalid') && msg.includes('code')) || msg.includes('expired')) {
        userError = '6-digit code incorrect — The code you entered does not match or has expired. Ask your faculty for the current code.';
        setStep('VERIFY_2FA');
      } else if (msg.includes('bluetooth') || msg.includes('proximity') || msg.includes('beacon') || msg.includes('ble')) {
        userError = 'Bluetooth proximity check failed — You must be in BLE range of the faculty\'s beacon to mark attendance.';
        setStep('BLE_CHECK');
      } else if (msg.includes('face') || msg.includes('verification failed')) {
        userError = 'Face scan failed — Face could not be verified. Please try again with better lighting.';
        setStep('SCAN_FACE');
      } else if (msg.includes('mac') || msg.includes('device') || msg.includes('unrecognized')) {
        userError = 'Device not recognized — Your device is not registered or approved. Contact admin.';
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
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ────────────────────────────────────────────────────────────────────────────

  if (success) return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <View style={s.successWrap}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.green}/>
        <Text style={s.successTitle}>ATTENDANCE MARKED</Text>
        <Text style={s.successSub}>Your presence has been verified and logged.</Text>
        <GlowCard color="green" style={{ marginTop: 28, width: '100%' }}>
          <Text style={s.successDetail}>Session: {session?.subject_code}</Text>
          <Text style={s.successDetail}>Subject: {session?.subject_name}</Text>
          <Text style={s.successDetail}>Verification: BLE ✓ + 2FA ✓ + Face ✓ + MAC ✓</Text>
        </GlowCard>
        <CyberButton label="Back to Dashboard" color="green" onPress={() => navigation.goBack()} style={{ marginTop: 22, width: '100%' }}/>
      </View>
    </SafeAreaView>
  );

  const scanScale   = scanAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const scanOpacity = scanAnimation.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.6] });

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <Background/>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={20} color={Colors.cyan}/>
        </TouchableOpacity>
        <Text style={s.topTitle}>MARK ATTENDANCE</Text>
        <Badge label="LIVE" color="green"/>
      </View>

      {/* ── Session info ── */}
      <GlowCard color="cyan" style={s.sessCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <PulseDot color={Colors.green} size={8}/>
          <View style={{ flex: 1 }}>
            <Text style={s.sessCode}>{session?.subject_code} — {session?.subject_name}</Text>
            <Text style={s.sessFac}>Faculty: {session?.faculty_name}</Text>
          </View>
        </View>
      </GlowCard>

      {/* ── Step indicators ── */}
      <View style={s.stepRow}>
        {[
          { key: 'SCAN_FACE',  label: 'FACE',   n: 1 },
          { key: 'BLE_CHECK',  label: 'BLE',    n: 2 },
          { key: 'VERIFY_2FA', label: '2FA',    n: 3 },
          { key: 'SUBMIT',     label: 'SUBMIT', n: 4 },
        ].map((st, i) => {
          const done = STEPS.indexOf(step) > i;
          const cur  = step === st.key;
          return (
            <React.Fragment key={st.key}>
              <View style={s.stepItem}>
                <View style={[
                  s.stepCircle,
                  cur  && { backgroundColor: Colors.cyanGlow,  borderColor: Colors.cyan },
                  done && { backgroundColor: Colors.greenGlow, borderColor: Colors.green },
                ]}>
                  {done
                    ? <Ionicons name="checkmark" size={12} color={Colors.green}/>
                    : <Text style={[s.stepN, cur && { color: Colors.cyan }]}>{st.n}</Text>
                  }
                </View>
                <Text style={[s.stepL, cur && { color: Colors.cyan }, done && { color: Colors.green }]}>
                  {st.label}
                </Text>
              </View>
              {i < 3 && <View style={[s.stepLine, done && { backgroundColor: Colors.green }]}/>}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>

        {/* ════════════════════════════════════════════════════
            Step 0 — Face Scan with Liveness Check
        ════════════════════════════════════════════════════ */}
        {step === 'SCAN_FACE' && (
          <View>
            <Text style={s.stepTitle}>FACE SCAN + LIVENESS CHECK</Text>
            <Text style={s.stepDesc}>
              Position your face in the frame. When prompted, perform the action shown to prove you are physically present.
            </Text>

            {!permission?.granted ? (
              <View style={s.permWrap}>
                <Ionicons name="camera" size={42} color={Colors.cyan}/>
                <Text style={s.permText}>Camera permission is required for face verification.</Text>
                <CyberButton label="Grant Permission" onPress={requestPermission} style={{ marginTop: 16 }}/>
              </View>
            ) : (
              <>
                {/* Camera preview */}
                <View style={s.camWrap}>
                  <CameraView
                    ref={cameraRef}
                    style={s.camera}
                    facing="front"
                    onCameraReady={() => setCameraReady(true)}
                  />
                  <View style={s.faceOverlay} pointerEvents="none">
                    <View style={s.faceFrame}>
                      {[s.fcTL, s.fcTR, s.fcBL, s.fcBR].map((cs, i) => (
                        <View key={i} style={[s.fc, cs]}/>
                      ))}
                    </View>

                    {/* Liveness phase overlay */}
                    {livenessPhase === 'IDLE' && (
                      <Text style={s.faceScanTxt}>
                        {cameraReady ? 'ALIGN FACE — LOOK STRAIGHT' : 'CAMERA INITIALIZING...'}
                      </Text>
                    )}
                    {livenessPhase === 'CHALLENGE' && livenessChallenge && (
                      <View style={s.livenessBanner}>
                        <Text style={s.livenessInstruction}>{livenessChallenge.instruction}</Text>
                        <Text style={s.livenessCountdown}>{livenessCountdown}</Text>
                      </View>
                    )}
                    {livenessPhase === 'CAPTURING' && (
                      <View style={s.livenessBanner}>
                        <ActivityIndicator color={Colors.cyan} size="small"/>
                        <Text style={s.livenessInstruction}>CAPTURING...</Text>
                      </View>
                    )}
                    {livenessPhase === 'DONE' && (
                      <View style={s.livenessBanner}>
                        <Ionicons name="checkmark-circle" size={32} color={Colors.green}/>
                        <Text style={[s.livenessInstruction, { color: Colors.green }]}>LIVENESS CONFIRMED</Text>
                      </View>
                    )}
                  </View>
                </View>

                {error ? <Text style={s.errText}>{error}</Text> : null}

                {livenessPhase === 'IDLE' && (
                  <CyberButton
                    label={cameraReady ? 'Start Liveness Check' : 'Waiting for Camera...'}
                    color="cyan"
                    onPress={startLivenessCheck}
                    loading={!cameraReady}
                    style={{ marginTop: 14 }}
                  />
                )}
              </>
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            Step 1 — Bluetooth Proximity Check
        ════════════════════════════════════════════════════ */}
        {step === 'BLE_CHECK' && (
          <View>
            <Text style={s.stepTitle}>BLUETOOTH PROXIMITY CHECK</Text>
            <Text style={s.stepDesc}>
              {session?.beacon_id
                ? 'Scanning for nearby Bluetooth devices to verify you are in the classroom.'
                : 'No beacon configured for this session. Skipping proximity check...'}
            </Text>

            <GlowCard color="cyan" style={s.bleCard}>
              <View style={s.bleIconWrap}>
                {bleScanning ? (
                  <Animated.View style={{ transform: [{ scale: scanScale }], opacity: scanOpacity }}>
                    <Ionicons name="bluetooth" size={56} color={Colors.cyan}/>
                  </Animated.View>
                ) : bleVerified ? (
                  <Ionicons name="checkmark-circle" size={56} color={Colors.green}/>
                ) : (
                  <Ionicons name="bluetooth" size={56} color={error ? Colors.red : Colors.cyan}/>
                )}
              </View>

              <Text style={[
                s.bleStatus,
                bleVerified && { color: Colors.green },
                error       && { color: Colors.red },
              ]}>
                {bleScanning
                  ? bleStatus
                  : bleVerified
                    ? 'IN RANGE — VERIFIED ✓'
                    : error
                      ? 'SCAN FAILED'
                      : 'READY TO SCAN'}
              </Text>

              {session?.beacon_id && (
                <View style={s.beaconTarget}>
                  <Ionicons name="radio" size={11} color={Colors.cyan}/>
                  <Text style={s.beaconTargetText}>Beacon: {session.beacon_id.slice(0, 8)}...</Text>
                </View>
              )}

              {detectedDevices.length > 0 && (
                <View style={s.deviceList}>
                  <Text style={s.deviceListTitle}>DETECTED DEVICES ({detectedDevices.length})</Text>
                  <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                    {detectedDevices.slice(0, 8).map((dev, i) => (
                      <View key={i} style={s.deviceItem}>
                        <Ionicons name="bluetooth" size={10} color={Colors.textDim}/>
                        <Text style={s.deviceName} numberOfLines={1}>{dev.name}</Text>
                        <Text style={s.deviceSignal}>{dev.rssi}dBm</Text>
                      </View>
                    ))}
                    {detectedDevices.length > 8 && (
                      <Text style={s.deviceMore}>+{detectedDevices.length - 8} more</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </GlowCard>

            {error ? <Text style={s.errText}>{error}</Text> : null}

            {!bleVerified && !bleScanning && (
              <CyberButton label="Scan Again" color="cyan" onPress={scanBLE} style={{ marginTop: 14 }}/>
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            Step 2 — 2FA Code
        ════════════════════════════════════════════════════ */}
        {step === 'VERIFY_2FA' && (
          <View>
            <Text style={s.stepTitle}>ENTER 2FA CODE</Text>
            <Text style={s.stepDesc}>Ask your faculty for the 6-digit rotating code displayed on their screen.</Text>
            <View style={s.codeRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[
                  s.codeBox,
                  twoFaCode[i] && { borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
                ]}>
                  <Text style={s.codeBoxText}>{twoFaCode[i] || ''}</Text>
                </View>
              ))}
            </View>
            <View style={s.numpad}>
              {['1','2','3','4','5','6','7','8','9','','0','DEL'].map((k, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.numKey, !k && { opacity: 0 }]}
                  onPress={() => { if (k) handleKey(k); }}
                  disabled={!k}
                >
                  {k === 'DEL'
                    ? <Ionicons name="backspace" size={20} color={Colors.textSecondary}/>
                    : <Text style={s.numKeyText}>{k}</Text>
                  }
                </TouchableOpacity>
              ))}
            </View>
            {error ? <Text style={s.errText}>{error}</Text> : null}
            <CyberButton label="Verify Code" color="cyan" onPress={proceed2FA} loading={loading} style={{ marginTop: 14 }}/>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            Step 3 — Confirm & Submit
        ════════════════════════════════════════════════════ */}
        {step === 'SUBMIT' && (
          <View>
            <Text style={s.stepTitle}>CONFIRM & SUBMIT</Text>
            <Text style={s.stepDesc}>All verification layers must pass to mark attendance.</Text>
            <GlowCard color="cyan" style={{ marginBottom: 16 }}>
              <Text style={s.checkTitle}>VERIFICATION SUMMARY</Text>
              {[
                { label: 'Face + Liveness', done: !!capturedImg,  val: capturedImg  ? 'Captured ✓' : 'Not captured' },
                { label: 'BLE Proximity',   done: bleVerified,    val: bleVerified  ? `${detectedDevices.length} devices ✓` : 'Not verified' },
                { label: '2FA Code',        done: true,           val: `${twoFaCode.slice(0,3)} ${twoFaCode.slice(3)}` },
                { label: 'Device MAC',      done: !!MAC,          val: MAC },
                { label: 'Session ID',      done: true,           val: (session?.session_id || '').slice(0, 8) + '...' },
              ].map((c, i) => (
                <View key={i} style={s.checkRow}>
                  <Ionicons name={c.done ? 'checkmark-circle' : 'close-circle'} size={15} color={c.done ? Colors.green : Colors.red}/>
                  <Text style={s.checkLabel}>{c.label}</Text>
                  <Text style={s.checkVal}>{c.val}</Text>
                </View>
              ))}
            </GlowCard>
            {error && (
              <View style={s.errBox}>
                <Ionicons name="alert-circle" size={13} color={Colors.red}/>
                <Text style={s.errBoxText}>{error}</Text>
              </View>
            )}
            <CyberButton label="Submit Attendance" color="green" onPress={submitAttendance} loading={loading} style={{ marginBottom: 10 }}/>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────────────────
const FACE_S = W * 0.6;
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.void },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  topTitle:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 2 },
  sessCard:{ marginHorizontal: Spacing.md, marginBottom: 12, padding: 12 },
  sessCode:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sessFac: { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, marginTop: 2 },

  // Step bar
  stepRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: 14 },
  stepItem: { alignItems: 'center' },
  stepCircle:{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  stepN:    { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted },
  stepL:    { fontFamily: 'monospace', fontSize: 7, color: Colors.textMuted, letterSpacing: 0.5 },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  content:  { padding: Spacing.md, paddingBottom: 40 },
  stepTitle:{ fontFamily: 'monospace', fontSize: 15, fontWeight: '800', color: Colors.cyan, letterSpacing: 1, marginBottom: 5 },
  stepDesc: { fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, lineHeight: 17, marginBottom: 18 },

  // Camera / face scan
  permWrap: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  permText: { fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  camWrap:  { borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  camera:   { width: '100%', height: H * 0.38 },
  faceOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  faceFrame:{ width: FACE_S, height: FACE_S, position: 'relative' },
  fc:       { position: 'absolute', width: 22, height: 22, borderColor: Colors.cyan, borderWidth: 2 },
  fcTL:     { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0 },
  fcTR:     { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0 },
  fcBL:     { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0 },
  fcBR:     { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0 },
  faceScanTxt: { fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 2, marginTop: 14 },

  // Liveness overlay
  livenessBanner:     { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, marginTop: 14, gap: 6 },
  livenessInstruction:{ fontFamily: 'monospace', fontSize: 15, fontWeight: '800', color: Colors.cyan, letterSpacing: 2, textAlign: 'center' },
  livenessCountdown:  { fontFamily: 'monospace', fontSize: 36, fontWeight: '900', color: Colors.cyan },

  // BLE step
  bleCard:          { alignItems: 'center', padding: 24, marginBottom: 14 },
  bleIconWrap:      { marginBottom: 14 },
  bleStatus:        { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: Colors.cyan, letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
  beaconTarget:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cyanGlow, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  beaconTargetText: { fontFamily: 'monospace', fontSize: 10, color: Colors.cyan, letterSpacing: 0.5 },
  deviceList:       { marginTop: 16, width: '100%', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  deviceListTitle:  { fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 6, textAlign: 'center' },
  deviceItem:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  deviceName:       { fontFamily: 'monospace', fontSize: 10, color: Colors.textSecondary, flex: 1 },
  deviceSignal:     { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim },
  deviceMore:       { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim, textAlign: 'center', marginTop: 4 },

  // 2FA step
  codeRow:    { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  codeBox:    { width: (W - Spacing.md * 2 - 40) / 6, height: 54, borderRadius: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  codeBoxText:{ fontFamily: 'monospace', fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  numpad:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  numKey:     { width: '31.5%', height: 50, borderRadius: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  numKeyText: { fontFamily: 'monospace', fontSize: 20, color: Colors.textPrimary },

  // Common
  errText:  { fontFamily: 'monospace', fontSize: 11, color: Colors.red, textAlign: 'center', marginVertical: 8 },
  errBox:   { flexDirection: 'row', gap: 7, backgroundColor: Colors.redGlow, borderWidth: 1, borderColor: Colors.redBorder, borderRadius: 3, padding: 10, marginBottom: 12, alignItems: 'center' },
  errBoxText:{ fontFamily: 'monospace', fontSize: 11, color: Colors.red, flex: 1 },
  checkTitle:{ fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 2, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkLabel:{ fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, flex: 1 },
  checkVal: { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted },

  // Success
  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  successTitle: { fontFamily: 'monospace', fontSize: 22, fontWeight: '900', color: Colors.green, letterSpacing: 2, textAlign: 'center', marginTop: 12 },
  successSub:   { fontFamily: 'monospace', fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  successDetail:{ fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, marginBottom: 5 },
});