// src/screens/student/StudentHomeScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { studentApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Background from '../../components/Background';
import { GlowCard, Badge, SectionLabel, ProgressBar, LoadingScreen, PulseDot, Divider } from '../../components/UI';
import { Colors, Spacing, accentColor } from '../../utils/theme';

const pctColor = (p) => p>=85?'green':p>=75?'amber':'red';

export default function StudentHomeScreen({ navigation }) {
  const { profile, logout } = useAuth();
  const [attendance,     setAttendance]     = useState(null);
  const [notifications,  setNotifications]  = useState([]);
  const [activeSession,  setActiveSession]  = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [exporting,      setExporting]      = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [att, notifs, sess] = await Promise.all([
        studentApi.getAttendance(),
        studentApi.getNotifications(),
        studentApi.getActiveSession(),
      ]);
      setAttendance(att);
      setNotifications(notifs.slice(0,5));
      setActiveSession(sess);
    } catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleExport = async () => {
    setExporting(true);
    try { await studentApi.exportCSV(); }
    catch(e){ Alert.alert('Export Error', e.message); }
    finally { setExporting(false); }
  };

  if (loading) return <LoadingScreen />;

  const overall  = attendance?.overall_percentage || 0;
  const subjects = attendance?.subjects || [];

  return (
    <SafeAreaView style={s.safe}>
      <Background />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View style={{flex:1}}>
            <Text style={s.greeting}>WELCOME BACK,</Text>
            <Text style={s.name}>{profile?.name?.split(' ')[0]||'Student'}</Text>
            <View style={s.metaRow}>
              <Badge label={`Roll: ${profile?.roll||'—'}`} color="cyan" dot={false}/>
              <Badge label={`Div: ${profile?.division||'—'}`} color="cyan" dot={false} style={{marginLeft:8}}/>
            </View>
          </View>
          <View style={s.headerBtns}>
            <TouchableOpacity onPress={handleExport} disabled={exporting} style={s.iconBtn}>
              <Ionicons name="download-outline" size={18} color={Colors.cyan}/>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])} style={[s.iconBtn,{borderColor:Colors.redBorder}]}>
              <Ionicons name="power" size={18} color={Colors.red}/>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active session banner */}
        {activeSession&&(
          <TouchableOpacity activeOpacity={0.85} onPress={()=>navigation.navigate('MarkAttendance',{session:activeSession})}>
            <LinearGradient colors={['rgba(0,255,157,0.14)','rgba(0,200,255,0.09)']} style={s.activeBanner} start={{x:0,y:0}} end={{x:1,y:0}}>
              <View style={s.activeBannerLeft}>
                <PulseDot color={Colors.green} size={9}/>
                <View style={{flex:1}}>
                  <Text style={s.activeBannerTitle}>LIVE SESSION — TAP TO MARK</Text>
                  <Text style={s.activeBannerSub}>{activeSession.subject_code} · {activeSession.subject_name}</Text>
                  <Text style={s.activeBannerFac}>Faculty: {activeSession.faculty_name}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.green}/>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Overall attendance */}
        <SectionLabel label="Overall Attendance" style={{marginTop:22}}/>
        <GlowCard color={pctColor(overall)} style={s.overallCard}>
          <View style={s.overallInner}>
            <View style={s.ringWrap}>
              <Text style={[s.ringValue,{color:overall>=75?Colors.green:Colors.red}]}>{overall.toFixed(1)}%</Text>
              <Text style={s.ringLabel}>OVERALL</Text>
            </View>
            <View style={s.quickStats}>
              {[
                {val:subjects.length,          label:'SUBJECTS', color:Colors.cyan},
                {val:subjects.filter(x=>x.percentage>=75).length, label:'SAFE',  color:Colors.green},
                {val:subjects.filter(x=>x.percentage<75).length,  label:'RISK',  color:Colors.red},
              ].map((q,i)=>(
                <React.Fragment key={i}>
                  {i>0&&<View style={{width:1,height:40,backgroundColor:Colors.border}}/>}
                  <View style={s.qStat}>
                    <Text style={[s.qVal,{color:q.color}]}>{q.val}</Text>
                    <Text style={s.qLabel}>{q.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
          <ProgressBar value={overall} color={pctColor(overall)} style={{marginTop:14}}/>
          {overall<75&&(
            <View style={s.warnStrip}>
              <Ionicons name="warning" size={11} color={Colors.red}/>
              <Text style={s.warnText}>ATTENDANCE BELOW 75% — {(75-overall).toFixed(1)}% DEFICIT</Text>
            </View>
          )}
        </GlowCard>

        {/* Export CSV button */}
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={s.exportBtn}>
          <Ionicons name={exporting?'hourglass':'download-outline'} size={14} color={Colors.cyan}/>
          <Text style={s.exportBtnText}>{exporting?'EXPORTING...':'EXPORT MY ATTENDANCE CSV'}</Text>
        </TouchableOpacity>

        {/* Subject breakdown */}
        <SectionLabel label="Subject Breakdown" style={{marginTop:20}}/>
        {subjects.length===0
          ? <GlowCard style={{alignItems:'center',padding:24}}><Text style={{fontFamily:'monospace',fontSize:11,color:Colors.textMuted}}>No subjects found</Text></GlowCard>
          : subjects.map(sub=>{
              const color=pctColor(sub.percentage);
              const tc=accentColor(color);
              return (
                <GlowCard key={sub.subject_code} color={color} style={s.subCard}>
                  <View style={s.subTop}>
                    <View style={{flex:1}}>
                      <Text style={s.subCode}>{sub.subject_code}</Text>
                      <Text style={s.subName}>{sub.subject_name}</Text>
                      <Text style={s.subFac}>Prof. {sub.faculty||'—'}</Text>
                    </View>
                    <Text style={[s.subPct,{color:tc}]}>{sub.percentage}%</Text>
                  </View>
                  <ProgressBar value={sub.percentage} color={color} style={{marginTop:8}}/>
                  <View style={s.subBottom}>
                    <Text style={s.subSmall}>Attended: {sub.attended}/{sub.total}</Text>
                    <Badge label={sub.percentage>=75?'SAFE':'AT RISK'} color={color} dot={false}/>
                  </View>
                </GlowCard>
              );
            })
        }

        {/* Notifications */}
        {notifications.length>0&&(
          <>
            <SectionLabel label="Recent Alerts" style={{marginTop:22}}/>
            {notifications.map(n=>{
              const nc=n.type==='success'?'green':n.type==='warning'?'amber':n.type==='error'?'red':'cyan';
              return (
                <GlowCard key={n.id} color={nc} style={s.notifCard}>
                  <View style={s.notifRow}>
                    <Ionicons name={n.type==='success'?'checkmark-circle':n.type==='warning'?'warning':'information-circle'} size={15} color={accentColor(nc)}/>
                    <Text style={s.notifText}>{n.message}</Text>
                    {!n.read&&<View style={[s.unreadDot,{backgroundColor:accentColor(nc)}]}/>}
                  </View>
                </GlowCard>
              );
            })}
          </>
        )}
        <View style={{height:32}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     {flex:1,backgroundColor:Colors.void},
  scroll:   {paddingHorizontal:Spacing.md,paddingTop:8},
  header:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  greeting: {fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:2},
  name:     {fontFamily:'monospace',fontSize:22,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1,marginTop:2,marginBottom:8},
  metaRow:  {flexDirection:'row'},
  headerBtns:{flexDirection:'row',gap:8,marginTop:4},
  iconBtn:  {padding:8,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:4},
  activeBanner:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:13,borderRadius:4,borderWidth:1,borderColor:Colors.greenBorder,marginBottom:6},
  activeBannerLeft:{flexDirection:'row',alignItems:'flex-start',gap:9,flex:1},
  activeBannerTitle:{fontFamily:'monospace',fontSize:10,fontWeight:'700',color:Colors.green,letterSpacing:1},
  activeBannerSub:  {fontFamily:'monospace',fontSize:12,color:Colors.textPrimary,marginTop:2},
  activeBannerFac:  {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:1},
  overallCard:  {padding:Spacing.lg},
  overallInner: {flexDirection:'row',alignItems:'center'},
  ringWrap:     {alignItems:'center',marginRight:22},
  ringValue:    {fontFamily:'monospace',fontSize:34,fontWeight:'900',letterSpacing:1},
  ringLabel:    {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,letterSpacing:2,marginTop:2},
  quickStats:   {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  qStat:        {alignItems:'center'},
  qVal:         {fontFamily:'monospace',fontSize:20,fontWeight:'800'},
  qLabel:       {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  warnStrip:    {flexDirection:'row',gap:5,alignItems:'center',marginTop:8},
  warnText:     {fontFamily:'monospace',fontSize:9,color:Colors.red,letterSpacing:0.5},
  exportBtn:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:10,paddingVertical:10,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,backgroundColor:Colors.cyanGlow},
  exportBtnText:{fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:1.5},
  subCard:   {marginBottom:9},
  subTop:    {flexDirection:'row',alignItems:'flex-start'},
  subCode:   {fontFamily:'monospace',fontSize:13,fontWeight:'800',color:Colors.cyan,letterSpacing:1},
  subName:   {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,marginTop:2},
  subFac:    {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:2},
  subPct:    {fontFamily:'monospace',fontSize:26,fontWeight:'900'},
  subBottom: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:7},
  subSmall:  {fontFamily:'monospace',fontSize:10,color:Colors.textMuted},
  notifCard: {marginBottom:7,padding:11},
  notifRow:  {flexDirection:'row',alignItems:'flex-start',gap:9},
  notifText: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,flex:1,lineHeight:16},
  unreadDot: {width:6,height:6,borderRadius:3,marginTop:4},
});
