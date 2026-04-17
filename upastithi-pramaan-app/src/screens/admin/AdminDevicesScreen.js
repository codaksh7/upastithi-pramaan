// src/screens/admin/AdminDevicesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, LoadingScreen } from '../../components/UI';
import { Colors, Spacing, accentColor } from '../../utils/theme';

export default function AdminDevicesScreen() {
  const [devices,    setDevices]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  const fetchDevices = useCallback(async () => {
    try { const d = await adminApi.getDevices(); setDevices(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const approveDevice = (mac, studentName) => {
    Alert.alert('Approve Device', `Approve device for ${studentName || 'student'}?`, [
      { text: 'Cancel' },
      { text: 'Approve', onPress: async () => {
        try { await adminApi.approveDevice(mac); fetchDevices(); }
        catch(e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const flagDevice = (mac) => {
    Alert.alert('Flag Device', 'Mark this device as suspicious?', [
      { text: 'Cancel' },
      { text: 'Flag', style: 'destructive', onPress: async () => {
        try { await adminApi.flagDevice(mac); fetchDevices(); }
        catch(e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const scColor = (st) => st === 'approved' ? 'green' : st === 'pending' ? 'amber' : 'red';

  const filtered = filter === 'all' ? devices : devices.filter(d => d.status === filter);

  const counts = {
    approved: devices.filter(d => d.status === 'approved').length,
    pending:  devices.filter(d => d.status === 'pending').length,
    flagged:  devices.filter(d => d.status === 'flagged').length,
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.safe}>
      <Background />
      <View style={s.header}>
        <Text style={s.title}>DEVICE REGISTRY</Text>
        <Text style={s.subtitle}>{devices.length} total devices</Text>
      </View>

      {/* Summary */}
      <View style={s.summaryRow}>
        {[
          { val: counts.approved, label: 'Approved', color: 'green' },
          { val: counts.pending,  label: 'Pending',  color: 'amber' },
          { val: counts.flagged,  label: 'Flagged',  color: 'red'   },
        ].map((st, i) => (
          <GlowCard key={i} color={st.color} style={s.sumCard}>
            <Text style={[s.sumVal, { color: accentColor(st.color) }]}>{st.val}</Text>
            <Text style={s.sumLabel}>{st.label.toUpperCase()}</Text>
          </GlowCard>
        ))}
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {['all', 'pending', 'approved', 'flagged'].map(f => (
          <TouchableOpacity key={f} style={[s.fChip, filter === f && s.fChipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.fChipTxt, filter === f && { color: Colors.cyan }]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => `${item.mac}-${item.id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDevices(); }} tintColor={Colors.cyan} />}
        renderItem={({ item }) => {
          const color = scColor(item.status);
          const tc    = accentColor(color);
          return (
            <GlowCard color={color} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.devIcon, { borderColor: tc + '66', backgroundColor: tc + '18' }]}>
                  <Ionicons name="phone-portrait" size={20} color={tc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.devMac}>{item.mac}</Text>
                  <Text style={s.devName}>{item.device_name || 'Unknown Device'}</Text>
                  {item.students && (
                    <Text style={s.devStudent}>
                      {item.students.name} ({item.students.roll})
                    </Text>
                  )}
                  <Text style={s.devDate}>
                    Registered: {new Date(item.registered_at).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label={item.status.toUpperCase()} color={color} />
              </View>

              {/* Actions */}
              {item.status === 'pending' && (
                <View style={s.actionRow}>
                  <CyberButton label="Approve" color="green" small onPress={() => approveDevice(item.mac, item.students?.name)} style={{ flex: 1 }} />
                  <CyberButton label="Flag" color="red" small onPress={() => flagDevice(item.mac)} style={{ flex: 1 }} />
                </View>
              )}
              {item.status === 'approved' && (
                <View style={s.actionRow}>
                  <CyberButton label="Flag as Suspicious" color="red" small onPress={() => flagDevice(item.mac)} style={{ flex: 1 }} />
                </View>
              )}
              {item.status === 'flagged' && (
                <View style={s.actionRow}>
                  <CyberButton label="Re-approve" color="green" small onPress={() => approveDevice(item.mac, item.students?.name)} style={{ flex: 1 }} />
                </View>
              )}
            </GlowCard>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="phone-portrait-outline" size={38} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>No devices found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.void },
  header:    { paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 6 },
  title:     { fontFamily: 'monospace', fontSize: 18, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 1 },
  subtitle:  { fontFamily: 'monospace', fontSize: 9,  color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  summaryRow:{ flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.md, marginBottom: 10 },
  sumCard:   { flex: 1, alignItems: 'center', padding: 10 },
  sumVal:    { fontFamily: 'monospace', fontSize: 22, fontWeight: '900' },
  sumLabel:  { fontFamily: 'monospace', fontSize: 7,  color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 7, paddingHorizontal: Spacing.md, marginBottom: 10, flexWrap: 'wrap' },
  fChip:     { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 3 },
  fChipActive:{ borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
  fChipTxt:  { fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted, letterSpacing: 1 },
  list:      { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  card:      { marginBottom: 10 },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  devIcon:   { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  devMac:    { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1 },
  devName:   { fontFamily: 'monospace', fontSize: 9,  color: Colors.textSecondary, marginTop: 2 },
  devStudent:{ fontFamily: 'monospace', fontSize: 9,  color: Colors.cyan, marginTop: 2 },
  devDate:   { fontFamily: 'monospace', fontSize: 8,  color: Colors.textDim, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  empty:     { alignItems: 'center', paddingTop: 56, gap: 12 },
  emptyTxt:  { fontFamily: 'monospace', fontSize: 12, color: Colors.textMuted },
});
