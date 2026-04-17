// src/screens/admin/AdminDisputesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, LoadingScreen } from '../../components/UI';
import { Colors, Spacing, accentColor } from '../../utils/theme';

export default function AdminDisputesScreen() {
  const [disputes,   setDisputes]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all');

  const fetchDisputes = useCallback(async () => {
    try { const d = await adminApi.getDisputes(); setDisputes(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const resolve = (id, name) => {
    Alert.alert('Resolve Dispute', `Mark attendance for ${name}?`, [
      { text: 'Cancel' },
      { text: 'Resolve', onPress: async () => {
        try { await adminApi.resolveDispute(id); fetchDisputes(); }
        catch(e){ Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const reject = (id) => {
    Alert.alert('Reject Dispute', 'This cannot be undone.', [
      { text: 'Cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        try { await adminApi.rejectDispute(id); fetchDisputes(); }
        catch(e){ Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const scColor = (st) => st === 'resolved' ? 'green' : st === 'rejected' ? 'red' : 'amber';

  const filtered = filter === 'all' ? disputes : disputes.filter(d => d.status === filter);

  const counts = {
    pending:  disputes.filter(d => d.status === 'pending').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.safe}>
      <Background />
      <View style={s.header}>
        <Text style={s.title}>DISPUTES</Text>
        <Text style={s.subtitle}>{counts.pending} pending review</Text>
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {[
          { key: 'all',      label: `All (${disputes.length})` },
          { key: 'pending',  label: `Pending (${counts.pending})` },
          { key: 'resolved', label: `Resolved (${counts.resolved})` },
          { key: 'rejected', label: `Rejected (${counts.rejected})` },
        ].map(f => (
          <TouchableOpacity key={f.key} style={[s.fChip, filter === f.key && s.fChipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[s.fChipTxt, filter === f.key && { color: Colors.cyan }]}>
              {f.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDisputes(); }} tintColor={Colors.cyan} />}
        renderItem={({ item }) => {
          const color       = scColor(item.status);
          const studentName = item.students?.name || 'Unknown';
          return (
            <GlowCard color={color} style={s.card}>
              {/* Top */}
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardStudent}>{studentName}</Text>
                  <Text style={s.cardRoll}>Roll: {item.students?.roll}</Text>
                  <Text style={s.cardSubject}>
                    {item.subjects?.code} — {item.subjects?.name}
                  </Text>
                  <Text style={s.cardDate}>Date: {item.date}</Text>
                </View>
                <Badge label={item.status.toUpperCase()} color={color} />
              </View>

              {/* Message */}
              <View style={s.msgBox}>
                <Text style={s.msgText}>{item.message}</Text>
              </View>

              {/* Actions for pending */}
              {item.status === 'pending' && (
                <View style={s.actionRow}>
                  <CyberButton
                    label="Approve Override"
                    color="green"
                    small
                    onPress={() => resolve(item.id, studentName)}
                    style={{ flex: 1 }}
                  />
                  <CyberButton
                    label="Reject"
                    color="red"
                    small
                    onPress={() => reject(item.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              )}

              <Text style={s.submittedAt}>
                Submitted: {new Date(item.created_at).toLocaleString()}
              </Text>
            </GlowCard>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={38} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>No disputes found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.void },
  header:     { paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 6 },
  title:      { fontFamily: 'monospace', fontSize: 18, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 1 },
  subtitle:   { fontFamily: 'monospace', fontSize: 9,  color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  filterRow:  { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.md, marginBottom: 10, flexWrap: 'wrap' },
  fChip:      { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border, borderRadius: 3 },
  fChipActive:{ borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
  fChipTxt:   { fontFamily: 'monospace', fontSize: 8, color: Colors.textMuted, letterSpacing: 0.5 },
  list:       { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  card:       { marginBottom: 12 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardStudent:{ fontFamily: 'monospace', fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  cardRoll:   { fontFamily: 'monospace', fontSize: 9,  color: Colors.textMuted, marginTop: 2 },
  cardSubject:{ fontFamily: 'monospace', fontSize: 10, color: Colors.cyan, marginTop: 3 },
  cardDate:   { fontFamily: 'monospace', fontSize: 9,  color: Colors.textDim, marginTop: 1 },
  msgBox:     { backgroundColor: Colors.void, borderRadius: 3, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  msgText:    { fontFamily: 'monospace', fontSize: 11, color: Colors.textSecondary, lineHeight: 17 },
  actionRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  submittedAt:{ fontFamily: 'monospace', fontSize: 8, color: Colors.textDim, letterSpacing: 0.5 },
  empty:      { alignItems: 'center', paddingTop: 56, gap: 12 },
  emptyTxt:   { fontFamily: 'monospace', fontSize: 12, color: Colors.textMuted },
});
