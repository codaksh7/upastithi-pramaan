// src/screens/admin/AdminLogsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, LoadingScreen } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const EVENT_TYPES = ['all', 'LOGIN', 'SESSION_START', 'SESSION_END', 'ATTENDANCE_OVERRIDE', 'DISPUTE_SUBMIT', 'DEVICE_CHANGE_REQUEST'];

const ACTION_COLOR = (action) => {
  if (!action) return Colors.cyan;
  if (action.includes('LOGIN'))    return Colors.cyan;
  if (action.includes('SESSION'))  return Colors.green;
  if (action.includes('OVERRIDE')) return Colors.amber;
  if (action.includes('DISPUTE'))  return Colors.cyan;
  if (action.includes('DEVICE'))   return Colors.amber;
  if (action.includes('ERROR'))    return Colors.red;
  return Colors.cyan;
};

const ACTION_ICON = (action) => {
  if (!action) return 'information-circle';
  if (action.includes('LOGIN'))    return 'log-in';
  if (action.includes('SESSION'))  return 'radio';
  if (action.includes('OVERRIDE')) return 'create';
  if (action.includes('DISPUTE'))  return 'document-text';
  if (action.includes('DEVICE'))   return 'phone-portrait';
  return 'information-circle';
};

export default function AdminLogsScreen() {
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');
  const [exporting,  setExporting]  = useState(false);

  const fetchLogs = useCallback(async (type = 'all') => {
    try {
      const d = await adminApi.getLogs(type === 'all' ? '' : type);
      setLogs(d);
    } catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchLogs(filter); }, [fetchLogs, filter]);

  // ✅ Export logs CSV (was missing)
  const handleExportLogs = async () => {
    setExporting(true);
    try {
      await adminApi.exportLogs();
      Alert.alert('Export Successful', 'Audit log CSV has been shared.');
    } catch(e){ Alert.alert('Export Error', e.message); }
    finally { setExporting(false); }
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.safe}>
      <Background />

      <View style={s.header}>
        <View>
          <Text style={s.title}>AUDIT LOGS</Text>
          <Text style={s.subtitle}>{logs.length} events</Text>
        </View>
        <TouchableOpacity style={s.exportBtn} onPress={handleExportLogs} disabled={exporting}>
          <Ionicons name={exporting ? 'hourglass' : 'download-outline'} size={16} color={Colors.cyan} />
          <Text style={s.exportBtnTxt}>{exporting ? '...' : 'EXPORT'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs - horizontal scroll */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={EVENT_TYPES}
        keyExtractor={i => i}
        contentContainerStyle={s.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.fChip, filter === item && s.fChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[s.fChipTxt, filter === item && { color: Colors.cyan }]}>
              {item === 'all' ? 'ALL' : item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchLogs(filter); }}
            tintColor={Colors.cyan}
          />
        }
        renderItem={({ item }) => {
          const tc = ACTION_COLOR(item.action);
          return (
            <View style={s.logRow}>
              {/* Timeline indicator */}
              <View style={s.timeline}>
                <View style={[s.timelineDot, { backgroundColor: tc }]} />
                <View style={s.timelineLine} />
              </View>

              <GlowCard style={[s.logCard, { borderColor: tc + '35' }]}>
                <View style={s.logTop}>
                  <Ionicons name={ACTION_ICON(item.action)} size={13} color={tc} />
                  <Text style={[s.logAction, { color: tc }]}>{item.action}</Text>
                  <Text style={s.logTime}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {item.details ? (
                  <Text style={s.logDetails}>{item.details}</Text>
                ) : null}
                <Text style={s.logDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </GlowCard>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="list-outline" size={38} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>No logs found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.void },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 6 },
  title:      { fontFamily: 'monospace', fontSize: 18, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 1 },
  subtitle:   { fontFamily: 'monospace', fontSize: 9,  color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cyanBorder, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 7 },
  exportBtnTxt:{ fontFamily: 'monospace', fontSize: 10, color: Colors.cyan, letterSpacing: 1 },
  filterRow:  { paddingHorizontal: Spacing.md, gap: 7, paddingBottom: 10 },
  fChip:      { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 3 },
  fChipActive:{ borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
  fChipTxt:   { fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted, letterSpacing: 0.5 },
  list:       { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  logRow:     { flexDirection: 'row', gap: 10, marginBottom: 4 },
  timeline:   { alignItems: 'center', paddingTop: 14 },
  timelineDot:{ width: 8, height: 8, borderRadius: 4 },
  timelineLine:{ width: 1, flex: 1, backgroundColor: Colors.border, marginTop: 4 },
  logCard:    { flex: 1, padding: 10, marginBottom: 0 },
  logTop:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  logAction:  { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  logTime:    { fontFamily: 'monospace', fontSize: 9, color: Colors.textDim },
  logDetails: { fontFamily: 'monospace', fontSize: 10, color: Colors.textSecondary, lineHeight: 15, marginBottom: 4 },
  logDate:    { fontFamily: 'monospace', fontSize: 8,  color: Colors.textDim },
  empty:      { alignItems: 'center', paddingTop: 56, gap: 12 },
  emptyTxt:   { fontFamily: 'monospace', fontSize: 12, color: Colors.textMuted },
});
