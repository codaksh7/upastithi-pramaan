// src/screens/faculty/FacultySessionScreen.js
// ── BLE-based attendance session management for faculty ──
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
import { generateToken, tokenToBytes } from '../../utils/bleToken';
import { requestBleAdvertisePermissions, showPermissionDeniedAlert } from '../../utils/blePermissions';

const { BleAdvertiserModule } = NativeModules;

// ── BLE advertising constants ─────────────────────────────────────────────────
const BLE_TOKEN_ROTATE_SECS = 10;
const BLE_COMPANY_ID_HEX = 'ffff'; // Must match native module COMPANY_ID

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

  // ── BLE advertising state ──
  const [bleAdvertising,  setBleAdvertising]  = useState(false);
  const [bleSupported,    setBleSupported]    = useState(null); // null = checking
  const [bleBtEnabled,    setBleBtEnabled]    = useState(true);
  const [bleCurrentToken, setBleCurrentToken] = useState('');
  const [bleError,        setBleError]        = useState('');
  const [rssiThreshold,   setRssiThreshold]   = useState(-70);
  const bleRotateRef = useRef(null);

  // ── QR Fallback state ──
  const [showQrToken, setShowQrToken] = useState(false);

  // ── Check BLE support on mount ──
  useEffect(() => {
    checkBleSupport();
    return () => {
      clearInterval(bleRotateRef.current);
    };
  }, []);

  const checkBleSupport = async () => {
    if (!BleAdvertiserModule) {
      setBleSupported(false);
      return;
    }
    try {
      const supported = await BleAdvertiserModule.isAdvertisingSupported();
      setBleSupported(supported);
      const btEnabled = await BleAdvertiserModule.isBluetoothEnabled();
      setBleBtEnabled(btEnabled);
    } catch (e) {
      console.warn('BLE support check failed:', e);
      setBleSupported(false);
    }
  };

  useEffect(() => {
    if (activeSession) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])).start();
    } else pulseAnim.setValue(1);
  }, [activeSession]);

  const fetchData = useCallback(async () => {
    try {
      const [subs, sess] = await Promise.all([facultyApi.getSubjects(), facultyApi.getActiveSession()]);
      setSubjects(subs);
      setActiveSession(sess);
      if (sess) {
        const studs = await facultyApi.getSessionStudents(sess.id);
        setStudents(studs);
        if (sess.twofa_code_expires_at) {
          const exp = new Date(sess.twofa_code_expires_at).getTime();
          setCountdown(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
        }
        // Auto-start BLE advertising if session has BLE data and we're not already advertising
        if (sess.ble_secret && sess.ble_service_uuid && !bleAdvertising) {
          startBleAdvertising(sess);
        }
      }
    } catch (e) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  /* ── Auto-poll active session every 30s ── */
  useEffect(() => {
    if (!activeSession) return;
    const poll = setInterval(() => {
      facultyApi.getActiveSession().then(sess => {
        if (sess) setActiveSession(sess);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(poll);
  }, [activeSession]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BLE ADVERTISING — Faculty broadcasts session tokens
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a BLE token and convert to manufacturer data hex.
   * Format: [companyId: 2B][tokenData: 18B] = 20 bytes total
   */
  const generateMfgData = (session) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const tokenHex = generateToken(
      session.ble_secret,
      session.id,
      timestamp,
      session.ble_rssi_threshold || rssiThreshold,
    );
    setBleCurrentToken(tokenHex);
    // Prepend company ID (little-endian for BLE, but our native module handles it)
    return BLE_COMPANY_ID_HEX + tokenHex;
  };

  const startBleAdvertising = async (session) => {
    if (!BleAdvertiserModule) {
      setBleError('BLE advertising not available — native module missing.');
      return;
    }

    setBleError('');

    // Check permissions
    const perms = await requestBleAdvertisePermissions();
    if (!perms.granted) {
      setBleError(`BLE permissions denied: ${perms.missing.join(', ')}`);
      showPermissionDeniedAlert('Bluetooth Advertise');
      return;
    }

    // Check Bluetooth enabled
    try {
      const btEnabled = await BleAdvertiserModule.isBluetoothEnabled();
      setBleBtEnabled(btEnabled);
      if (!btEnabled) {
        setBleError('Bluetooth is turned off. Please enable Bluetooth.');
        return;
      }
    } catch (e) {
      console.warn('BT check failed:', e);
    }

    // Check advertising support
    try {
      const supported = await BleAdvertiserModule.isAdvertisingSupported();
      setBleSupported(supported);
      if (!supported) {
        setBleError('This device does not support BLE advertising.');
        return;
      }
    } catch (e) {
      setBleError('Failed to check BLE advertising support.');
      return;
    }

    try {
      const mfgData = generateMfgData(session);
      await BleAdvertiserModule.startAdvertising(
        session.ble_service_uuid,
        mfgData,
        100, // interval hint in ms
      );
      setBleAdvertising(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Set up token rotation
      clearInterval(bleRotateRef.current);
      bleRotateRef.current = setInterval(async () => {
        try {
          const newMfgData = generateMfgData(session);
          await BleAdvertiserModule.updateAdvertisingData(
            session.ble_service_uuid,
            newMfgData,
          );
        } catch (e) {
          console.warn('[BLE] Token rotation error:', e.message);
        }
      }, (session.ble_token_rotate_secs || BLE_TOKEN_ROTATE_SECS) * 1000);

    } catch (e) {
      setBleError(`BLE advertising failed: ${e.message}`);
      setBleAdvertising(false);
    }
  };

  const stopBleAdvertising = async () => {
    clearInterval(bleRotateRef.current);
    if (BleAdvertiserModule) {
      try {
        await BleAdvertiserModule.stopAdvertising();
      } catch (e) {
        console.warn('Stop BLE advertising error:', e);
      }
    }
    setBleAdvertising(false);
    setBleCurrentToken('');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const startSession = async () => {
    if (!selectedSub) { Alert.alert('Error', 'Select a subject first.'); return; }

    setStarting(true);
    try {
      const session = await facultyApi.startSession(selectedSub.id, rssiThreshold);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-start BLE advertising
      if (session?.ble_secret && session?.ble_service_uuid) {
        await startBleAdvertising(session);
      }

      await fetchData();
    }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setStarting(false); }
  };

  const endSession = () => {
    Alert.alert('End Session', 'End current session?', [
      { text: 'Cancel' },
      { text: 'End', style: 'destructive', onPress: async () => {
        setEnding(true);
        try {
          await stopBleAdvertising();
          await facultyApi.endSession(activeSession.id);
          setActiveSession(null);
          setStudents([]);
          await fetchData();
        }
        catch (e) { Alert.alert('Error', e.message); }
        finally { setEnding(false); }
      }},
    ]);
  };

  const refreshCode = async () => {
    setRefreshingCode(true);
    try {
      const res = await facultyApi.refreshCode(activeSession.id);
      setActiveSession(prev => ({
        ...prev,
        twofa_code: res.twofa_code,
        twofa_code_expires_at: res.twofa_code_expires_at,
      }));
      const exp = new Date(res.twofa_code_expires_at).getTime();
      setCountdown(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
      Haptics.selectionAsync();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setRefreshingCode(false); }
  };

  const overrideStudent = async (studentId, isPresent) => {
    try {
      await facultyApi.overrideAttendance(activeSession.id, studentId, !isPresent);
      Haptics.selectionAsync();
      const updated = await facultyApi.getSessionStudents(activeSession.id);
      setStudents(updated);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  if (loading) return <LoadingScreen />;

  const presentCount = students.filter(s => (s.face_verified && s.mac_verified) || s.ble_verified).length;
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={s.safe}>
      <Background />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.cyan} />}
        contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>FACULTY PORTAL</Text>
            <Text style={s.name}>{profile?.name}</Text>
            <Text style={s.empId}>EMP: {profile?.emp_id}</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])} style={s.logoutBtn}>
            <Ionicons name="power" size={18} color={Colors.red} />
          </TouchableOpacity>
        </View>

        {/* Active session */}
        {activeSession ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <GlowCard color="green" style={s.activeCard}>
              <View style={s.activeHdr}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <PulseDot color={Colors.green} size={10} />
                  <Text style={s.liveText}>SESSION LIVE</Text>
                </View>
                <Badge label={`${presentCount}/${students.length} PRESENT`} color="green" />
              </View>
              <Divider />
              <Text style={s.activeSubj}>{activeSession.subjects?.code} — {activeSession.subjects?.name}</Text>
              <Text style={s.activeMeta}>Started: {new Date(activeSession.started_at).toLocaleTimeString()}</Text>

              {/* ── BLE Broadcasting Status ── */}
              <GlowCard color={bleAdvertising ? 'green' : bleError ? 'red' : 'cyan'} style={s.bleStatusCard}>
                <View style={s.bleStatusRow}>
                  <View style={s.bleIconWrap}>
                    {bleAdvertising ? (
                      <Ionicons name="bluetooth" size={28} color={Colors.green} />
                    ) : bleError ? (
                      <Ionicons name="warning" size={28} color={Colors.red} />
                    ) : (
                      <ActivityIndicator size="small" color={Colors.cyan} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.bleStatusTitle, bleAdvertising && { color: Colors.green }, bleError && { color: Colors.red }]}>
                      {bleAdvertising ? 'BLE BROADCASTING ✓' : bleError ? 'BLE ERROR' : 'INITIALIZING BLE...'}
                    </Text>
                    <Text style={s.bleStatusSub}>
                      {bleAdvertising
                        ? `Token rotates every ${activeSession.ble_token_rotate_secs || BLE_TOKEN_ROTATE_SECS}s • RSSI ≥ ${activeSession.ble_rssi_threshold || rssiThreshold} dBm`
                        : bleError || 'Starting BLE advertisement...'}
                    </Text>
                  </View>
                </View>

                {/* BLE Service UUID badge */}
                {activeSession.ble_service_uuid && (
                  <View style={s.bleUuidBadge}>
                    <Ionicons name="bluetooth" size={10} color={Colors.cyan} />
                    <Text style={s.bleUuidText} numberOfLines={1}>UUID: {activeSession.ble_service_uuid}</Text>
                  </View>
                )}

                {/* Current token (debug, truncated) */}
                {bleCurrentToken ? (
                  <View style={[s.bleUuidBadge, { borderColor: Colors.greenBorder, backgroundColor: Colors.greenGlow, marginTop: 4 }]}>
                    <Ionicons name="key" size={10} color={Colors.green} />
                    <Text style={[s.bleUuidText, { color: Colors.green }]} numberOfLines={1}>
                      Token: {bleCurrentToken.slice(0, 16)}...
                    </Text>
                  </View>
                ) : null}

                {/* Restart BLE button */}
                {!bleAdvertising && activeSession.ble_secret && (
                  <TouchableOpacity
                    style={[s.bleActionBtn, { marginTop: 10 }]}
                    onPress={() => startBleAdvertising(activeSession)}
                  >
                    <Ionicons name="refresh" size={14} color={Colors.cyan} />
                    <Text style={s.bleActionText}>RESTART BLE</Text>
                  </TouchableOpacity>
                )}

                {bleError ? <Text style={s.bleErrorText}>{bleError}</Text> : null}
              </GlowCard>

              {/* QR Fallback */}
              <TouchableOpacity
                style={s.qrToggle}
                onPress={() => setShowQrToken(!showQrToken)}
              >
                <Ionicons name="qr-code" size={12} color={Colors.textDim} />
                <Text style={s.qrToggleText}>
                  {showQrToken ? 'Hide QR token' : 'Show QR fallback token'}
                </Text>
              </TouchableOpacity>
              {showQrToken && bleCurrentToken ? (
                <GlowCard color="cyan" style={{ padding: 12, marginBottom: 8 }}>
                  <Text style={s.qrLabel}>QR FALLBACK — SHOW TO STUDENTS</Text>
                  <Text style={s.qrToken} selectable>{bleCurrentToken}</Text>
                  <Text style={s.qrHint}>Students can manually enter this token if BLE scan fails. Token refreshes every {activeSession.ble_token_rotate_secs || BLE_TOKEN_ROTATE_SECS}s.</Text>
                </GlowCard>
              ) : null}

              {/* 2FA Code */}
              <GlowCard color="cyan" style={s.codeCard}>
                <Text style={s.codeLabel}>STUDENT 2FA CODE — SHOW THIS ON SCREEN</Text>
                <Text style={s.codeValue}>{activeSession.twofa_code || '------'}</Text>
                <View style={s.codeBottom}>
                  <Text style={s.codeExpiry}>Expires: {countdown > 0 ? fmt(countdown) : 'EXPIRED'}</Text>
                  <TouchableOpacity onPress={refreshCode} disabled={refreshingCode} style={s.refreshCodeBtn}>
                    <Ionicons name="refresh" size={13} color={Colors.cyan} />
                    <Text style={s.refreshCodeText}>REFRESH</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.codeHint}>Students enter this 6-digit code in their app</Text>
              </GlowCard>

              <CyberButton label="End Session" color="red" onPress={endSession} loading={ending} style={{ marginTop: 14 }} />
            </GlowCard>
          </Animated.View>
        ) : (
          /* Start session */
          <GlowCard color="cyan" style={s.startCard}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="bluetooth" size={38} color={Colors.textMuted} />
            </View>
            <Text style={s.noSessTitle}>NO ACTIVE SESSION</Text>
            <Text style={s.noSessSub}>Select a subject to start a BLE-based attendance session</Text>

            {/* Subject selection */}
            <SectionLabel label="Select Subject" style={{ marginTop: 18 }} />
            {subjects.length === 0
              ? <Text style={{ fontFamily: 'monospace', fontSize: 11, color: Colors.textMuted, textAlign: 'center', padding: 16 }}>No subjects assigned. Contact admin.</Text>
              : subjects.map(sub => (
                <TouchableOpacity key={sub.id} style={[s.subBtn, selectedSub?.id === sub.id && s.subBtnActive]} onPress={() => setSelectedSub(sub)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.subBtnCode, selectedSub?.id === sub.id && { color: Colors.cyan }]}>{sub.code}</Text>
                    <Text style={s.subBtnName}>{sub.name}</Text>
                  </View>
                  {selectedSub?.id === sub.id && <Ionicons name="checkmark-circle" size={19} color={Colors.cyan} />}
                </TouchableOpacity>
              ))
            }

            {/* ── BLE Configuration ── */}
            <SectionLabel label="BLE Proximity Settings" style={{ marginTop: 18 }} />

            <GlowCard color={bleSupported === false ? 'red' : 'cyan'} style={s.bleConfigCard}>
              <View style={s.bleStatusRow}>
                <Ionicons
                  name={bleSupported === false ? 'warning' : bleSupported ? 'bluetooth' : 'hourglass'}
                  size={24}
                  color={bleSupported === false ? Colors.red : Colors.cyan}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.bleConfigTitle, bleSupported === false && { color: Colors.red }]}>
                    {bleSupported === null ? 'CHECKING BLE SUPPORT...'
                      : bleSupported ? (bleBtEnabled ? 'BLE READY ✓' : 'BLUETOOTH DISABLED')
                      : 'BLE ADVERTISING NOT SUPPORTED'}
                  </Text>
                  <Text style={s.bleConfigSub}>
                    {bleSupported === null ? 'Checking device capabilities...'
                      : bleSupported
                        ? (bleBtEnabled
                          ? 'Your device will broadcast a BLE beacon for student proximity verification'
                          : 'Please enable Bluetooth to use BLE attendance')
                        : 'This device cannot advertise BLE. Students can use QR fallback.'}
                  </Text>
                </View>
              </View>

              {/* RSSI threshold config */}
              {bleSupported && (
                <View style={s.rssiConfig}>
                  <Text style={s.rssiLabel}>RSSI Threshold: {rssiThreshold} dBm</Text>
                  <View style={s.rssiButtons}>
                    {[-50, -60, -70, -80, -90].map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[s.rssiBtn, rssiThreshold === val && s.rssiBtnActive]}
                        onPress={() => setRssiThreshold(val)}
                      >
                        <Text style={[s.rssiBtnText, rssiThreshold === val && { color: Colors.cyan }]}>{val}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.rssiHint}>
                    {rssiThreshold >= -50 ? '🔵 Very close (~1m)' :
                     rssiThreshold >= -60 ? '🟢 Close (~3m)' :
                     rssiThreshold >= -70 ? '🟡 Medium (~5m — recommended)' :
                     rssiThreshold >= -80 ? '🟠 Far (~10m)' : '🔴 Very far (~15m+)'}
                  </Text>
                </View>
              )}

              {!bleBtEnabled && bleSupported && (
                <TouchableOpacity style={[s.bleActionBtn, { marginTop: 10 }]} onPress={checkBleSupport}>
                  <Ionicons name="refresh" size={14} color={Colors.cyan} />
                  <Text style={s.bleActionText}>RECHECK BLUETOOTH</Text>
                </TouchableOpacity>
              )}
            </GlowCard>

            <CyberButton
              label="Start Session"
              color="green"
              onPress={startSession}
              loading={starting}
              disabled={!selectedSub}
              style={{ marginTop: 14 }}
            />
          </GlowCard>
        )}

        {/* Live student list */}
        {activeSession && students.length > 0 && (
          <>
            <SectionLabel label={`Live Attendance — ${students.length} Students`} style={{ marginTop: 22 }} />
            {students.map(st => {
              const isPresent = (st.face_verified && st.mac_verified) || st.ble_verified;
              return (
                <GlowCard key={st.roll} color={isPresent ? 'green' : 'red'} style={s.stuRow}>
                  <View style={s.stuLeft}>
                    <View style={[s.stuAvatar, { backgroundColor: isPresent ? Colors.greenGlow : Colors.redGlow, borderColor: isPresent ? Colors.green : Colors.red }]}>
                      <Text style={[s.stuAvatarTxt, { color: isPresent ? Colors.green : Colors.red }]}>{st.name?.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stuName}>{st.name}</Text>
                      <Text style={s.stuRoll}>Roll: {st.roll}</Text>
                      <View style={s.verifyRow}>
                        {[
                          { label: 'FACE', ok: st.face_verified },
                          { label: 'BLE', ok: st.ble_verified },
                          { label: 'MAC', ok: st.mac_verified },
                        ].map((v, i) => (
                          <View key={i} style={[s.verifyChip, { borderColor: v.ok ? Colors.green : Colors.border }]}>
                            <Ionicons name={v.ok ? 'checkmark' : 'close'} size={9} color={v.ok ? Colors.green : Colors.textMuted} />
                            <Text style={[s.verifyTxt, { color: v.ok ? Colors.green : Colors.textMuted }]}>{v.label}</Text>
                          </View>
                        ))}
                        {st.ble_rssi != null && (
                          <Text style={s.rssiValue}>{st.ble_rssi}dBm</Text>
                        )}
                        {st.confidence && <Text style={s.confidence}>{Number(st.confidence).toFixed(0)}%</Text>}
                      </View>
                    </View>
                  </View>
                  <Switch value={isPresent} onValueChange={() => overrideStudent(st.student_id || st.id, isPresent)}
                    trackColor={{ false: Colors.redGlow, true: Colors.greenGlow }} thumbColor={isPresent ? Colors.green : Colors.red} />
                </GlowCard>
              );
            })}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.void },
  scroll:  { paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 16 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  greeting:{ fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 2 },
  name:    { fontFamily: 'monospace', fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 1, marginTop: 2 },
  empId:   { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  logoutBtn:{ padding: 8, borderWidth: 1, borderColor: Colors.redBorder, borderRadius: 4 },
  activeCard:{ marginBottom: 8 },
  activeHdr:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveText: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: Colors.green, letterSpacing: 2 },
  activeSubj:{ fontFamily: 'monospace', fontSize: 14, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.5, marginTop: 10 },
  activeMeta:{ fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginTop: 3 },

  // BLE Status card
  bleStatusCard: { marginTop: 14, padding: 14 },
  bleStatusRow: { flexDirection: 'row', alignItems: 'center' },
  bleIconWrap: { width: 40, alignItems: 'center' },
  bleStatusTitle: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: Colors.cyan, letterSpacing: 1 },
  bleStatusSub: { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, marginTop: 3, lineHeight: 14 },
  bleUuidBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: Colors.cyanGlow, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 4 },
  bleUuidText: { fontFamily: 'monospace', fontSize: 8, color: Colors.cyan, letterSpacing: 0.3, flex: 1 },
  bleActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.cyanGlow, alignSelf: 'center' },
  bleActionText: { fontFamily: 'monospace', fontSize: 9, color: Colors.cyan, letterSpacing: 1 },
  bleErrorText: { fontFamily: 'monospace', fontSize: 9, color: Colors.red, marginTop: 8, textAlign: 'center' },

  // QR fallback
  qrToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingVertical: 8 },
  qrToggleText: { fontFamily: 'monospace', fontSize: 9, color: Colors.textDim, letterSpacing: 0.5 },
  qrLabel: { fontFamily: 'monospace', fontSize: 8, color: Colors.cyan, letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  qrToken: { fontFamily: 'monospace', fontSize: 11, color: Colors.textPrimary, textAlign: 'center', letterSpacing: 1, marginBottom: 6, backgroundColor: Colors.cardBg, padding: 10, borderRadius: 3 },
  qrHint: { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim, textAlign: 'center', lineHeight: 13 },

  // 2FA code
  codeCard:  { marginTop: 14, alignItems: 'center', padding: 18 },
  codeLabel: { fontFamily: 'monospace', fontSize: 8, color: Colors.cyan, letterSpacing: 2.5, marginBottom: 6, textAlign: 'center' },
  codeValue: { fontFamily: 'monospace', fontSize: 44, fontWeight: '900', color: Colors.cyan, letterSpacing: 14 },
  codeBottom:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 },
  codeExpiry:{ fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted, letterSpacing: 1 },
  refreshCodeBtn:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshCodeText:{ fontFamily: 'monospace', fontSize: 10, color: Colors.cyan, letterSpacing: 1 },
  codeHint:  { fontFamily: 'monospace', fontSize: 8, color: Colors.textDim, letterSpacing: 0.5, marginTop: 7, textAlign: 'center' },

  // Start session card
  startCard: { padding: Spacing.lg },
  noSessTitle:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 2, textAlign: 'center' },
  noSessSub: { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 5, lineHeight: 15 },
  subBtn:    { padding: 13, borderWidth: 1, borderColor: Colors.border, borderRadius: 3, marginBottom: 7, flexDirection: 'row', alignItems: 'center' },
  subBtnActive:{ borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
  subBtnCode:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  subBtnName:{ fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // BLE config card
  bleConfigCard: { padding: 14, marginBottom: 8 },
  bleConfigTitle: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: Colors.cyan, letterSpacing: 1 },
  bleConfigSub: { fontFamily: 'monospace', fontSize: 9, color: Colors.textMuted, marginTop: 3, lineHeight: 14 },
  rssiConfig: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  rssiLabel: { fontFamily: 'monospace', fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 8 },
  rssiButtons: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  rssiBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.cardBg },
  rssiBtnActive: { borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
  rssiBtnText: { fontFamily: 'monospace', fontSize: 10, color: Colors.textMuted },
  rssiHint: { fontFamily: 'monospace', fontSize: 9, color: Colors.textDim, textAlign: 'center', marginTop: 6 },

  // Student list
  stuRow:    { marginBottom: 8, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stuLeft:   { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  stuAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stuAvatarTxt:{ fontFamily: 'monospace', fontSize: 15, fontWeight: '800' },
  stuName:   { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  stuRoll:   { fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted, marginTop: 1 },
  verifyRow: { flexDirection: 'row', gap: 5, marginTop: 4, alignItems: 'center' },
  verifyChip:{ flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 2 },
  verifyTxt: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.5 },
  rssiValue: { fontFamily: 'monospace', fontSize: 8, color: Colors.cyan },
  confidence:{ fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted },
});
