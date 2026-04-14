// src/screens/student/StudentProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { studentApi, notifApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Background from '../../components/Background';
import { GlowCard, Badge, CyberButton, InfoRow, SectionLabel, LoadingScreen, ModalSheet } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

export default function StudentProfileScreen() {
  const { profile, logout } = useAuth();
  const [device,     setDevice]     = useState(null);
  const [disputes,   setDisputes]   = useState([]);
  const [subjects,   setSubjects]   = useState([]);
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDisp,   setShowDisp]   = useState(false);
  const [dispForm,   setDispForm]   = useState({subject_id:'',date:'',message:''});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab,  setActiveTab]  = useState('profile'); // profile | device | disputes | notifs

  const fetchData = useCallback(async () => {
    try {
      const [dev, disp, subj, nf] = await Promise.all([
        studentApi.getDevice(),
        studentApi.getDisputes(),
        studentApi.getSubjects(),
        notifApi.list(),
      ]);
      setDevice(dev);
      setDisputes(Array.isArray(disp)?disp:[]);
      setSubjects(subj.subjects||[]);
      setNotifs(nf);
    } catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  const submitDispute = async () => {
    if(!dispForm.subject_id||!dispForm.date||!dispForm.message){Alert.alert('Error','All fields required.');return;}
    setSubmitting(true);
    try {
      await studentApi.submitDispute(dispForm);
      Alert.alert('Success','Dispute submitted.');
      setShowDisp(false); setDispForm({subject_id:'',date:'',message:''});
      fetchData();
    } catch(e){Alert.alert('Error',e.message);}
    finally{setSubmitting(false);}
  };

  const markNotifRead = async (id) => {
    try {
      await notifApi.markRead(id);
      setNotifs(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
    } catch{}
  };

  const deleteNotif = async (id) => {
    try {
      await notifApi.delete(id);
      setNotifs(prev=>prev.filter(n=>n.id!==id));
    } catch(e){Alert.alert('Error',e.message);}
  };

  if(loading) return <LoadingScreen/>;

  const scColor=(s)=>s==='resolved'?'green':s==='rejected'?'red':'amber';
  const TABS=[{key:'profile',icon:'person',label:'PROFILE'},{key:'device',icon:'phone-portrait',label:'DEVICE'},{key:'disputes',icon:'document-text',label:'DISPUTES'},{key:'notifs',icon:'notifications',label:'ALERTS'}];

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchData();}} tintColor={Colors.cyan}/>}
        contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{profile?.name?.charAt(0)||'S'}</Text></View>
          <View style={{flex:1}}>
            <Text style={s.name}>{profile?.name}</Text>
            <Text style={s.roll}>Roll No: {profile?.roll}</Text>
            <Badge label={`Division ${profile?.division}`} color="cyan" style={{marginTop:5}}/>
          </View>
          <TouchableOpacity onPress={()=>Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])} style={s.logoutBtn}>
            <Ionicons name="power" size={18} color={Colors.red}/>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap}>
          {TABS.map(t=>(
            <TouchableOpacity key={t.key} style={[s.tab,activeTab===t.key&&s.tabActive]} onPress={()=>setActiveTab(t.key)}>
              <Ionicons name={t.icon} size={14} color={activeTab===t.key?Colors.cyan:Colors.textMuted}/>
              <Text style={[s.tabText,activeTab===t.key&&{color:Colors.cyan}]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Profile tab ── */}
        {activeTab==='profile'&&(
          <>
            <SectionLabel label="Student Information"/>
            <GlowCard>
              <InfoRow label="Name"        value={profile?.name}/>
              <InfoRow label="Roll Number" value={profile?.roll} color={Colors.cyan}/>
              <InfoRow label="Division"    value={`Division ${profile?.division}`}/>
              <InfoRow label="Semester"    value={`Semester ${profile?.semester}`}/>
              <InfoRow label="Department"  value={profile?.department}/>
              <InfoRow label="Email"       value={profile?.email}/>
              <InfoRow label="Institution" value={profile?.institution}/>
            </GlowCard>
          </>
        )}

        {/* ── Device tab ── */}
        {activeTab==='device'&&(
          <>
            <SectionLabel label="Registered Device"/>
            <GlowCard color={device?.status==='approved'?'green':device?.status==='pending'?'amber':'red'}>
              {device?.mac?(
                <>
                  <View style={s.deviceRow}>
                    <Ionicons name="phone-portrait" size={24} color={device.status==='approved'?Colors.green:Colors.amber}/>
                    <View style={{flex:1}}>
                      <Text style={s.deviceMac}>{device.mac}</Text>
                      <Text style={s.deviceName}>{device.device_name||'Primary Device'}</Text>
                    </View>
                    <Badge label={device.status?.toUpperCase()} color={device.status==='approved'?'green':device.status==='pending'?'amber':'red'}/>
                  </View>
                  {device.registered_at&&<Text style={s.deviceDate}>Registered: {new Date(device.registered_at).toLocaleDateString()}</Text>}
                </>
              ):(
                <View style={{alignItems:'center',padding:20,gap:8}}>
                  <Ionicons name="phone-portrait-outline" size={30} color={Colors.textMuted}/>
                  <Text style={{fontFamily:'monospace',fontSize:12,color:Colors.textMuted}}>No device registered</Text>
                  <Text style={{fontFamily:'monospace',fontSize:9,color:Colors.textDim,textAlign:'center'}}>Contact admin to register your device MAC address</Text>
                </View>
              )}
            </GlowCard>
            <SectionLabel label="MAC Address Info" style={{marginTop:16}}/>
            <GlowCard>
              <Text style={{fontFamily:'monospace',fontSize:10,color:Colors.textSecondary,lineHeight:17}}>
                Your device's MAC address is used as the second layer of the 2FA attendance system. It must match your registered device to mark attendance. Contact admin if you need to change your registered device.
              </Text>
            </GlowCard>
          </>
        )}

        {/* ── Disputes tab ── */}
        {activeTab==='disputes'&&(
          <>
            <View style={{flexDirection:'row',alignItems:'center',marginBottom:14}}>
              <Text style={[s.name,{flex:1,fontSize:14}]}>Disputes ({disputes.length})</Text>
              <TouchableOpacity style={s.addBtn} onPress={()=>setShowDisp(true)}>
                <Ionicons name="add" size={16} color={Colors.cyan}/>
                <Text style={s.addBtnText}>NEW</Text>
              </TouchableOpacity>
            </View>
            {disputes.length===0?(
              <GlowCard style={{alignItems:'center',padding:24}}>
                <Ionicons name="document-text-outline" size={32} color={Colors.textMuted}/>
                <Text style={{fontFamily:'monospace',fontSize:11,color:Colors.textMuted,marginTop:8}}>No disputes submitted</Text>
              </GlowCard>
            ):disputes.map(d=>(
              <GlowCard key={d.id} color={scColor(d.status)} style={s.dispCard}>
                <View style={s.dispTop}>
                  <View style={{flex:1}}>
                    <Text style={s.dispSubj}>{d.subjects?.code||'Subject'} — {d.subjects?.name}</Text>
                    <Text style={s.dispDate}>Date: {d.date}</Text>
                  </View>
                  <Badge label={d.status.toUpperCase()} color={scColor(d.status)}/>
                </View>
                <Text style={s.dispMsg} numberOfLines={3}>{d.message}</Text>
              </GlowCard>
            ))}
          </>
        )}

        {/* ── Notifications tab ── */}
        {activeTab==='notifs'&&(
          <>
            <Text style={[s.name,{fontSize:14,marginBottom:14}]}>Notifications ({notifs.filter(n=>!n.read).length} unread)</Text>
            {notifs.length===0?(
              <GlowCard style={{alignItems:'center',padding:24}}>
                <Ionicons name="notifications-outline" size={32} color={Colors.textMuted}/>
                <Text style={{fontFamily:'monospace',fontSize:11,color:Colors.textMuted,marginTop:8}}>No notifications</Text>
              </GlowCard>
            ):notifs.map(n=>{
              const nc=n.type==='success'?'green':n.type==='warning'?'amber':n.type==='error'?'red':'cyan';
              return (
                <GlowCard key={n.id} color={nc} style={s.notifCard}>
                  <View style={s.notifRow}>
                    <View style={{flex:1}}>
                      <Text style={s.notifMsg}>{n.message}</Text>
                      <Text style={s.notifTime}>{new Date(n.created_at).toLocaleString()}</Text>
                    </View>
                    <View style={{gap:6}}>
                      {!n.read&&(
                        <TouchableOpacity onPress={()=>markNotifRead(n.id)} style={s.notifBtn}>
                          <Ionicons name="checkmark" size={12} color={Colors.green}/>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={()=>deleteNotif(n.id)} style={[s.notifBtn,{borderColor:Colors.redBorder}]}>
                        <Ionicons name="trash" size={12} color={Colors.red}/>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {!n.read&&<View style={s.unreadStrip}/>}
                </GlowCard>
              );
            })}
          </>
        )}

        <View style={{height:40}}/>
      </ScrollView>

      {/* Dispute modal */}
      <ModalSheet visible={showDisp} onClose={()=>setShowDisp(false)} title="Raise Dispute">
        <Text style={s.fieldLabel}>SUBJECT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
          {subjects.map(sub=>(
            <TouchableOpacity key={sub.subject_code}
              style={[s.chip,dispForm.subject_id===sub.subject_code&&s.chipActive]}
              onPress={()=>setDispForm(f=>({...f,subject_id:sub.subject_code}))}>
              <Text style={[s.chipText,dispForm.subject_id===sub.subject_code&&{color:Colors.cyan}]}>{sub.subject_code}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={s.fieldLabel}>DATE (YYYY-MM-DD)</Text>
        <TextInput style={s.input} placeholder="2025-01-15" placeholderTextColor={Colors.textDim} value={dispForm.date} onChangeText={v=>setDispForm(f=>({...f,date:v}))}/>
        <Text style={[s.fieldLabel,{marginTop:12}]}>REASON</Text>
        <TextInput style={[s.input,{height:80,textAlignVertical:'top'}]} placeholder="Explain why attendance should be marked..." placeholderTextColor={Colors.textDim} multiline value={dispForm.message} onChangeText={v=>setDispForm(f=>({...f,message:v}))}/>
        <CyberButton label="Submit Dispute" color="cyan" onPress={submitDispute} loading={submitting} style={{marginTop:16}}/>
      </ModalSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:Colors.void},
  scroll:  {paddingHorizontal:Spacing.md,paddingTop:12,paddingBottom:24},
  header:  {flexDirection:'row',alignItems:'center',gap:14,marginBottom:18},
  avatar:  {width:56,height:56,borderRadius:28,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyan,alignItems:'center',justifyContent:'center'},
  avatarTxt:{fontFamily:'monospace',fontSize:20,fontWeight:'900',color:Colors.cyan},
  name:    {fontFamily:'monospace',fontSize:15,fontWeight:'800',color:Colors.textPrimary},
  roll:    {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  logoutBtn:{padding:8,borderWidth:1,borderColor:Colors.redBorder,borderRadius:4},
  tabsWrap:{marginBottom:16},
  tab:     {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:Colors.border,borderRadius:3,marginRight:8},
  tabActive:{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow},
  tabText: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1},
  addBtn:  {flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:10,paddingVertical:6},
  addBtnText:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1},
  dispCard:{marginBottom:9},
  dispTop: {flexDirection:'row',alignItems:'flex-start',marginBottom:8},
  dispSubj:{fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.textPrimary},
  dispDate:{fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:2},
  dispMsg: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,lineHeight:16},
  deviceRow:{flexDirection:'row',alignItems:'center',gap:12},
  deviceMac:{fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textPrimary,letterSpacing:1},
  deviceName:{fontFamily:'monospace',fontSize:10,color:Colors.textMuted,marginTop:2},
  deviceDate:{fontFamily:'monospace',fontSize:8,color:Colors.textDim,marginTop:8},
  notifCard:{marginBottom:8,padding:12},
  notifRow: {flexDirection:'row',alignItems:'flex-start',gap:10},
  notifMsg: {fontFamily:'monospace',fontSize:11,color:Colors.textSecondary,lineHeight:16,flex:1},
  notifTime:{fontFamily:'monospace',fontSize:8,color:Colors.textDim,marginTop:4},
  notifBtn: {width:26,height:26,borderRadius:3,borderWidth:1,borderColor:Colors.greenBorder,alignItems:'center',justifyContent:'center'},
  unreadStrip:{position:'absolute',left:0,top:0,bottom:0,width:3,backgroundColor:Colors.cyan,borderRadius:1},
  fieldLabel:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1.5,marginBottom:6},
  input:    {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,padding:12,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary},
  chip:     {paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:Colors.border,borderRadius:3,marginRight:8},
  chipActive:{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow},
  chipText: {fontFamily:'monospace',fontSize:11,color:Colors.textMuted},
});
