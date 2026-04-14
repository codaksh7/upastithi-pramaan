// src/screens/admin/AdminOverviewScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, SectionLabel, LoadingScreen, PulseDot, ProgressBar } from '../../components/UI';
import { Colors, Spacing, accentColor } from '../../utils/theme';

export default function AdminOverviewScreen() {
  const { logout } = useAuth();
  const [overview,   setOverview]   = useState(null);
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [ov, an] = await Promise.all([adminApi.getOverview(), adminApi.getAnalytics()]);
      setOverview(ov); setAnalytics(an);
    } catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  if(loading) return <LoadingScreen/>;

  const stats = [
    {label:'Students',  val:overview?.total_students??0,  color:'cyan',  icon:'people'},
    {label:'Faculty',   val:overview?.total_faculty??0,   color:'green', icon:'person-circle'},
    {label:'Sessions',  val:overview?.sessions_today??0,  color:'amber', icon:'radio'},
    {label:'Pending',   val:overview?.pending_actions??0, color:'red',   icon:'alert-circle'},
  ];

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchData();}} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        <View style={s.header}>
          <View>
            <Text style={s.title}>ADMIN PANEL</Text>
            <Text style={s.subtitle}>System-wide management</Text>
          </View>
          <TouchableOpacity onPress={()=>Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])} style={s.logoutBtn}>
            <Ionicons name="power" size={18} color={Colors.red}/>
          </TouchableOpacity>
        </View>

        <GlowCard color="green" style={s.statusBanner}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3}}>
            <PulseDot color={Colors.green} size={8}/>
            <Text style={s.statusText}>ALL SYSTEMS OPERATIONAL</Text>
          </View>
          <Text style={s.statusSub}>Upastithi-Pramaan v2.4.1 — Backend Connected</Text>
        </GlowCard>

        <SectionLabel label="System Overview" style={{marginTop:18}}/>
        <View style={s.statsGrid}>
          {stats.map((st,i)=>{
            const tc=accentColor(st.color);
            return (
              <GlowCard key={i} color={st.color} style={s.statCard}>
                <Ionicons name={st.icon} size={19} color={tc} style={{marginBottom:7}}/>
                <Text style={[s.statVal,{color:tc}]}>{st.val}</Text>
                <Text style={s.statLabel}>{st.label.toUpperCase()}</Text>
              </GlowCard>
            );
          })}
        </View>

        {analytics?.subject_averages?.length>0&&(
          <>
            <SectionLabel label="Subject Attendance Averages" style={{marginTop:18}}/>
            {analytics.subject_averages.map((sub,i)=>{
              const color=sub.avg>=85?'green':sub.avg>=75?'amber':'red';
              const tc=accentColor(color);
              return (
                <GlowCard key={i} color={color} style={s.subRow}>
                  <View style={s.subRowInner}>
                    <Text style={s.subCode}>{sub.code}</Text>
                    <View style={{flex:1,marginHorizontal:12}}>
                      <ProgressBar value={sub.avg} color={color}/>
                    </View>
                    <Text style={[s.subAvg,{color:tc}]}>{sub.avg?.toFixed(0)}%</Text>
                  </View>
                </GlowCard>
              );
            })}
          </>
        )}

        <SectionLabel label="System Configuration" style={{marginTop:18}}/>
        <GlowCard>
          {[
            {label:'Face Confidence Threshold', val:'70%',         icon:'scan-circle'},
            {label:'Defaulter Threshold',       val:'< 75%',       icon:'warning'},
            {label:'ARP Scan Interval',         val:'3-5 seconds', icon:'wifi'},
            {label:'Face Model',                val:'HOG + CNN',   icon:'hardware-chip'},
            {label:'2FA Code TTL',              val:'5 minutes',   icon:'key'},
            {label:'JWT Expiry',                val:'4 hours',     icon:'time'},
            {label:'Session Timeout',           val:'90 minutes',  icon:'timer'},
            {label:'DB Backend',                val:'Supabase',    icon:'server'},
          ].map((r,i)=>(
            <View key={i} style={s.cfgRow}>
              <Ionicons name={r.icon} size={13} color={Colors.cyan}/>
              <Text style={s.cfgLabel}>{r.label.toUpperCase()}</Text>
              <Text style={s.cfgVal}>{r.val}</Text>
            </View>
          ))}
        </GlowCard>
        <View style={{height:40}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     {flex:1,backgroundColor:Colors.void},
  scroll:   {paddingHorizontal:Spacing.md,paddingTop:8},
  header:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14},
  title:    {fontFamily:'monospace',fontSize:19,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1},
  subtitle: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  logoutBtn:{padding:8,borderWidth:1,borderColor:Colors.redBorder,borderRadius:4},
  statusBanner:{padding:13},
  statusText:  {fontFamily:'monospace',fontSize:11,fontWeight:'700',color:Colors.green,letterSpacing:1.5},
  statusSub:   {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:0.5},
  statsGrid: {flexDirection:'row',flexWrap:'wrap',gap:10},
  statCard:  {width:'47%',alignItems:'center',padding:15},
  statVal:   {fontFamily:'monospace',fontSize:26,fontWeight:'900'},
  statLabel: {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  subRow:    {marginBottom:8,padding:11},
  subRowInner:{flexDirection:'row',alignItems:'center'},
  subCode:   {fontFamily:'monospace',fontSize:10,color:Colors.cyan,width:60},
  subAvg:    {fontFamily:'monospace',fontSize:13,fontWeight:'700',width:38,textAlign:'right'},
  cfgRow:    {flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8,borderBottomWidth:1,borderBottomColor:Colors.border},
  cfgLabel:  {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,flex:1},
  cfgVal:    {fontFamily:'monospace',fontSize:11,color:Colors.textPrimary},
});
