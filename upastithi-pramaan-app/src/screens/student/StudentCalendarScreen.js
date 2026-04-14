// src/screens/student/StudentCalendarScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { studentApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, SectionLabel, LoadingScreen } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const { width: W } = Dimensions.get('window');
const DAYS   = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function StudentCalendarScreen() {
  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth()+1);
  const [year,  setYear]      = useState(now.getFullYear());
  const [calData, setCalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCal = useCallback(async () => {
    try { const d = await studentApi.getCalendar(month,year); setCalData(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[month,year]);

  useEffect(()=>{ setLoading(true); fetchCal(); },[fetchCal]);

  const changeMonth = (dir) => {
    let nm=month+dir, ny=year;
    if(nm<1){nm=12;ny--;}
    if(nm>12){nm=1;ny++;}
    setMonth(nm); setYear(ny);
  };

  const statusMap={};
  calData.forEach(d=>{statusMap[d.day]=d.status;});

  const daysInMonth = new Date(year,month,0).getDate();
  const firstDay    = new Date(year,month-1,1).getDay();

  const stats={present:calData.filter(d=>d.status==='present').length, absent:calData.filter(d=>d.status==='absent').length};

  const dayBg  =(st)=>st==='present'?Colors.greenGlow:st==='absent'?Colors.redGlow:'transparent';
  const dayBc  =(st)=>st==='present'?Colors.green:st==='absent'?Colors.red:Colors.border;
  const dayTc  =(st)=>st==='present'?Colors.green:st==='absent'?Colors.red:Colors.textMuted;

  if(loading) return <LoadingScreen/>;

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchCal();}} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        <Text style={s.title}>ATTENDANCE CALENDAR</Text>
        <Text style={s.subtitle}>Monthly attendance view</Text>

        {/* Month navigator */}
        <GlowCard style={s.navCard} noPad>
          <View style={s.navRow}>
            <TouchableOpacity onPress={()=>changeMonth(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.cyan}/>
            </TouchableOpacity>
            <View style={s.navCenter}>
              <Text style={s.navMonth}>{MONTHS[month-1].toUpperCase()}</Text>
              <Text style={s.navYear}>{year}</Text>
            </View>
            <TouchableOpacity onPress={()=>changeMonth(1)} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={22} color={Colors.cyan}/>
            </TouchableOpacity>
          </View>
        </GlowCard>

        {/* Month stats */}
        <View style={s.statsRow}>
          {[
            {val:stats.present, label:'Present', color:Colors.green},
            {val:stats.absent,  label:'Absent',  color:Colors.red},
            {val:daysInMonth-stats.present-stats.absent, label:'No Class', color:Colors.textMuted},
          ].map((st,i)=>(
            <GlowCard key={i} color={i===0?'green':i===1?'red':'cyan'} style={s.statCard}>
              <Text style={[s.statVal,{color:st.color}]}>{st.val}</Text>
              <Text style={s.statLabel}>{st.label.toUpperCase()}</Text>
            </GlowCard>
          ))}
        </View>

        {/* Calendar */}
        <GlowCard style={s.calCard}>
          <View style={s.weekRow}>
            {DAYS.map((d,i)=><Text key={i} style={s.weekDay}>{d}</Text>)}
          </View>
          <View style={s.daysGrid}>
            {Array.from({length:firstDay}).map((_,i)=><View key={`e${i}`} style={s.dayCell}/>)}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1;
              const st=statusMap[day]||'no-class';
              const isToday=day===now.getDate()&&month===now.getMonth()+1&&year===now.getFullYear();
              return (
                <View key={day} style={[s.dayCell,{backgroundColor:dayBg(st),borderColor:dayBc(st)},isToday&&s.todayCell]}>
                  <Text style={[s.dayNum,{color:dayTc(st)},isToday&&{color:Colors.cyan}]}>{day}</Text>
                  {st!=='no-class'&&<View style={[s.dayDot,{backgroundColor:dayBc(st)}]}/>}
                </View>
              );
            })}
          </View>
        </GlowCard>

        {/* Legend */}
        <SectionLabel label="Legend" style={{marginTop:18}}/>
        <GlowCard>
          {[
            {color:Colors.green, label:'Present — Verified attendance'},
            {color:Colors.red,   label:'Absent — Session held, not attended'},
            {color:Colors.border,label:'No Class — No session scheduled'},
          ].map((l,i)=>(
            <View key={i} style={s.legRow}>
              <View style={[s.legDot,{backgroundColor:l.color}]}/>
              <Text style={s.legText}>{l.label}</Text>
            </View>
          ))}
        </GlowCard>
        <View style={{height:32}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:Colors.void},
  scroll:  {paddingHorizontal:Spacing.md,paddingTop:8,paddingBottom:16},
  title:   {fontFamily:'monospace',fontSize:18,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1},
  subtitle:{fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2,marginBottom:16},
  navCard: {marginBottom:14},
  navRow:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:4},
  navBtn:  {padding:12},
  navCenter:{alignItems:'center'},
  navMonth:{fontFamily:'monospace',fontSize:18,fontWeight:'900',color:Colors.cyan,letterSpacing:2},
  navYear: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1},
  statsRow:{flexDirection:'row',gap:10,marginBottom:14},
  statCard:{flex:1,alignItems:'center',padding:10},
  statVal: {fontFamily:'monospace',fontSize:22,fontWeight:'900'},
  statLabel:{fontFamily:'monospace',fontSize:7,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  calCard: {padding:10,marginBottom:14},
  weekRow: {flexDirection:'row',marginBottom:6},
  weekDay: {flex:1,fontFamily:'monospace',fontSize:9,color:Colors.cyan,textAlign:'center'},
  daysGrid:{flexDirection:'row',flexWrap:'wrap'},
  dayCell: {width:'14.28%',aspectRatio:1,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:'transparent',borderRadius:2},
  todayCell:{borderColor:Colors.cyan,borderWidth:1.5},
  dayNum:  {fontFamily:'monospace',fontSize:11,fontWeight:'600'},
  dayDot:  {width:3,height:3,borderRadius:1.5,marginTop:1},
  legRow:  {flexDirection:'row',alignItems:'center',gap:9,paddingVertical:6},
  legDot:  {width:10,height:10,borderRadius:5},
  legText: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary},
});
