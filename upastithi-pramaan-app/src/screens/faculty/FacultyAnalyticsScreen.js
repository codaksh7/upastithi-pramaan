// src/screens/faculty/FacultyAnalyticsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Dimensions, TouchableOpacity, Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { facultyApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, SectionLabel, ProgressBar, LoadingScreen, EmptyState, ModalSheet, CyberButton } from '../../components/UI';
import { Colors, Spacing, accentColor } from '../../utils/theme';

import DateTimePicker from '@react-native-community/datetimepicker';

const { width: W } = Dimensions.get('window');
const CHART_H = 110;

const REPORT_TYPES = [
  { key: 'daily',    label: 'Daily Report',     icon: 'today' },
  { key: 'weekly',   label: 'Weekly Summary',   icon: 'calendar' },
  { key: 'defaulter',label: 'Defaulter List',   icon: 'warning' },
  { key: 'subject',  label: 'Subject Report',   icon: 'book' },
  { key: 'semester', label: 'Semester Report',  icon: 'school' },
  { key: 'audit',    label: 'Audit Log',        icon: 'list' },
];

// Update state and adding date picker logic
export default function FacultyAnalyticsScreen() {
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fromDate,   setFromDate]   = useState(null);
  const [toDate,     setToDate]     = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const [showPicker, setShowPicker] = useState({ visible: false, mode: 'from' });

  // ... (keep fetchAnalytics and handleExport)
  const fetchAnalytics = useCallback(async () => {
    try { const d = await facultyApi.getAnalytics(); setAnalytics(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchAnalytics(); },[fetchAnalytics]);

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const fromStr = fromDate ? fromDate.toISOString().split('T')[0] : undefined;
      const toStr   = toDate ? toDate.toISOString().split('T')[0] : undefined;
      await facultyApi.exportReport(type, fromStr, toStr);
      Alert.alert('Export Successful', `${type} report has been shared.`);
      setShowExport(false);
    } catch(e){ Alert.alert('Export Error', e.message); }
    finally { setExporting(false); }
  };
  
  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker({ visible: false, mode: showPicker.mode });
    if (selectedDate) {
      if (showPicker.mode === 'from') setFromDate(selectedDate);
      else setToDate(selectedDate);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };
  
  if(loading) return <LoadingScreen/>;

  const trend     = analytics?.trend_30_days||[];
  const defaulters= analytics?.defaulters||[];
  const summary   = analytics?.today_summary||{};

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchAnalytics();}} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>ANALYTICS</Text>
            <Text style={s.subtitle}>Attendance insights & statistics</Text>
          </View>
          <TouchableOpacity style={s.exportHeaderBtn} onPress={()=>setShowExport(true)}>
            <Ionicons name="download-outline" size={16} color={Colors.cyan}/>
            <Text style={s.exportHeaderTxt}>EXPORT</Text>
          </TouchableOpacity>
        </View>

        {/* Today summary */}
        <SectionLabel label="Today's Summary" style={{marginTop:8}}/>
        <View style={s.todayRow}>
          {[
            {val:summary.present??0,label:'Present',color:'green'},
            {val:summary.absent??0, label:'Absent', color:'red'},
            {val:summary.pending??0,label:'Pending',color:'amber'},
            {val:summary.total??0,  label:'Total',  color:'cyan'},
          ].map((st,i)=>(
            <GlowCard key={i} color={st.color} style={s.todayCard}>
              <Text style={[s.todayVal,{color:accentColor(st.color)}]}>{st.val}</Text>
              <Text style={s.todayLabel}>{st.label.toUpperCase()}</Text>
            </GlowCard>
          ))}
        </View>

        {/* 30-day bar chart */}
        <SectionLabel label="30-Day Attendance Trend" style={{marginTop:18}}/>
        <GlowCard color="cyan" style={s.chartCard}>
          {trend.length===0
            ? <EmptyState icon="📊" title="No data yet" subtitle="Start sessions to see trends"/>
            : (
              <>
                <View style={s.chartArea}>
                  <View style={s.yAxis}>
                    {['100','75','50','25','0'].map(v=><Text key={v} style={s.yLabel}>{v}</Text>)}
                  </View>
                  <View style={s.barsArea}>
                    {[0.25,0.5,0.75,1].map(p=><View key={p} style={[s.gridLine,{bottom:CHART_H*p}]}/>)}
                    <View style={[s.threshLine,{bottom:CHART_H*0.75}]}/>
                    <View style={s.bars}>
                      {trend.map((val,i)=>{
                        const h=Math.max((val/100)*CHART_H,2);
                        const bc=val>=85?Colors.green:val>=75?Colors.cyan:Colors.red;
                        return (
                          <View key={i} style={s.barWrap}>
                            <View style={[s.bar,{height:h,backgroundColor:bc}]}/>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
                <View style={s.chartLegend}>
                  {[{c:Colors.green,l:'≥85%'},{c:Colors.cyan,l:'75-84%'},{c:Colors.red,l:'<75%'}].map((l,i)=>(
                    <View key={i} style={{flexDirection:'row',alignItems:'center',gap:5}}>
                      <View style={{width:8,height:8,borderRadius:4,backgroundColor:l.c}}/>
                      <Text style={s.legendTxt}>{l.l}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.threshNote}>— 75% threshold</Text>
              </>
            )
          }
        </GlowCard>

        {/* Defaulters */}
        <SectionLabel label={`Defaulters < 75% — ${defaulters.length} students`} style={{marginTop:18}}/>
        {defaulters.length===0?(
          <GlowCard color="green" style={{alignItems:'center',padding:18,gap:7}}>
            <Ionicons name="checkmark-circle" size={30} color={Colors.green}/>
            <Text style={{fontFamily:'monospace',fontSize:12,color:Colors.green,letterSpacing:1}}>ALL STUDENTS ABOVE 75%</Text>
          </GlowCard>
        ):defaulters.map((d,i)=>(
          <GlowCard key={i} color="red" style={s.defCard}>
            <View style={s.defRow}>
              <View style={s.defRank}><Text style={s.defRankTxt}>{i+1}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.defName}>{d.name}</Text>
                <Text style={s.defRoll}>Roll: {d.roll}</Text>
                <ProgressBar value={d.pct} color="red" style={{marginTop:5}}/>
              </View>
              <Text style={s.defPct}>{d.pct}%</Text>
            </View>
          </GlowCard>
        ))}

        <View style={{height:40}}/>
      </ScrollView>

      {/* Export Modal */}
      <ModalSheet visible={showExport} onClose={()=>setShowExport(false)} title="Export Report">
        <Text style={s.fieldLabel}>CUSTOM DATE RANGE (OPTIONAL)</Text>
        <View style={{flexDirection:'row',gap:10,marginBottom:16,alignItems:'flex-end'}}>
          <View style={{flex:1}}>
            <Text style={s.miniLabel}>FROM</Text>
            <TouchableOpacity style={s.input} onPress={() => setShowPicker({ visible: true, mode: 'from' })}>
              <Text style={{color: fromDate ? Colors.textPrimary : Colors.textDim, fontFamily:'monospace',fontSize:12}}>{formatDate(fromDate)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{flex:1}}>
            <Text style={s.miniLabel}>TO</Text>
            <TouchableOpacity style={s.input} onPress={() => setShowPicker({ visible: true, mode: 'to' })}>
              <Text style={{color: toDate ? Colors.textPrimary : Colors.textDim, fontFamily:'monospace',fontSize:12}}>{formatDate(toDate)}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.rangeDownloadBtn} onPress={()=>handleExport('daily')} disabled={exporting || (!fromDate && !toDate)}>
             <Ionicons name="cloud-download" size={20} color={(!fromDate && !toDate) ? Colors.textDim : Colors.cyan}/>
          </TouchableOpacity>
        </View>

        {showPicker.visible && (
          <DateTimePicker
            testID="dateTimePicker"
            value={(showPicker.mode === 'from' ? fromDate : toDate) || new Date()}
            mode="date"
            is24Hour={true}
            display="default"
            maximumDate={new Date()}
            onChange={onDateChange}
          />
        )}
        
        <Text style={s.fieldLabel}>OR SELECT A QUICK REPORT TYPE</Text>
        {REPORT_TYPES.map(r=>(
          <TouchableOpacity key={r.key} style={s.reportBtn} onPress={()=>handleExport(r.key)} disabled={exporting}>
            <Ionicons name={r.icon} size={16} color={Colors.cyan}/>
            <Text style={s.reportBtnTxt}>{r.label.toUpperCase()}</Text>
            <Ionicons name="download" size={14} color={Colors.textMuted}/>
          </TouchableOpacity>
        ))}
        {exporting&&<Text style={{fontFamily:'monospace',fontSize:10,color:Colors.cyan,textAlign:'center',marginTop:10,letterSpacing:1}}>EXPORTING...</Text>}
      </ModalSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     {flex:1,backgroundColor:Colors.void},
  scroll:   {paddingHorizontal:Spacing.md,paddingTop:12},
  headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8},
  title:    {fontFamily:'monospace',fontSize:19,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1},
  subtitle: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  exportHeaderBtn:{flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:11,paddingVertical:7},
  exportHeaderTxt:{fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:1},
  todayRow: {flexDirection:'row',gap:8,flexWrap:'wrap'},
  todayCard:{width:'22%',alignItems:'center',padding:9},
  todayVal: {fontFamily:'monospace',fontSize:20,fontWeight:'900'},
  todayLabel:{fontFamily:'monospace',fontSize:7,color:Colors.textMuted,letterSpacing:1,marginTop:2,textAlign:'center'},
  chartCard:{padding:Spacing.md},
  chartArea:{flexDirection:'row',height:CHART_H+14},
  yAxis:    {justifyContent:'space-between',paddingRight:6,paddingVertical:2},
  yLabel:   {fontFamily:'monospace',fontSize:7,color:Colors.textDim,textAlign:'right'},
  barsArea: {flex:1,position:'relative'},
  gridLine: {position:'absolute',left:0,right:0,height:1,backgroundColor:Colors.border},
  threshLine:{position:'absolute',left:0,right:0,height:1,backgroundColor:Colors.amber,opacity:0.6},
  bars:     {position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',alignItems:'flex-end',height:CHART_H},
  barWrap:  {flex:1,alignItems:'center',justifyContent:'flex-end',height:CHART_H,paddingHorizontal:1},
  bar:      {width:'100%',borderRadius:1,minHeight:2},
  chartLegend:{flexDirection:'row',gap:14,marginTop:10,flexWrap:'wrap'},
  legendTxt:{fontFamily:'monospace',fontSize:8,color:Colors.textMuted},
  threshNote:{fontFamily:'monospace',fontSize:7,color:Colors.amber,marginTop:4,letterSpacing:0.5},
  defCard:  {marginBottom:8},
  defRow:   {flexDirection:'row',alignItems:'center',gap:11},
  defRank:  {width:26,height:26,borderRadius:13,backgroundColor:Colors.redGlow,borderWidth:1,borderColor:Colors.redBorder,alignItems:'center',justifyContent:'center'},
  defRankTxt:{fontFamily:'monospace',fontSize:10,fontWeight:'700',color:Colors.red},
  defName:  {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.textPrimary},
  defRoll:  {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,marginTop:1},
  defPct:   {fontFamily:'monospace',fontSize:20,fontWeight:'900',color:Colors.red,minWidth:46,textAlign:'right'},
  fieldLabel:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1.5,marginBottom:8},
  miniLabel: {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,letterSpacing:1,marginBottom:4},
  input:     {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,padding:10,fontFamily:'monospace',fontSize:12,color:Colors.textPrimary},
  rangeDownloadBtn: {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,padding:9,alignItems:'center',justifyContent:'center'},
  reportBtn: {flexDirection:'row',alignItems:'center',gap:10,paddingVertical:13,borderBottomWidth:1,borderBottomColor:Colors.border},
  reportBtnTxt:{fontFamily:'monospace',fontSize:11,color:Colors.textPrimary,flex:1,letterSpacing:0.5},
});
