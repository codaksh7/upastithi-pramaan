// src/screens/faculty/FacultyProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { facultyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Background from '../../components/Background';
import { GlowCard, SectionLabel, InfoRow, Badge, LoadingScreen } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

export default function FacultyProfileScreen() {
  const { profile, logout } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    facultyApi.getSubjects().then(setSubjects).catch(console.warn).finally(()=>setLoading(false));
  },[]);

  if(loading) return <LoadingScreen/>;

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{profile?.name?.charAt(0)||'F'}</Text></View>
          <View style={{flex:1}}>
            <Text style={s.name}>{profile?.name}</Text>
            <Text style={s.empId}>{profile?.emp_id}</Text>
            <Badge label={profile?.department||'Faculty'} color="cyan" style={{marginTop:5}}/>
          </View>
          <TouchableOpacity onPress={()=>Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])} style={s.logoutBtn}>
            <Ionicons name="power" size={18} color={Colors.red}/>
          </TouchableOpacity>
        </View>

        <SectionLabel label="Faculty Information"/>
        <GlowCard style={s.infoCard}>
          <InfoRow label="Name"        value={profile?.name}/>
          <InfoRow label="Employee ID" value={profile?.emp_id} color={Colors.cyan}/>
          <InfoRow label="Department"  value={profile?.department}/>
        </GlowCard>

        <SectionLabel label="Assigned Subjects" style={{marginTop:18}}/>
        {subjects.length===0
          ? <GlowCard style={{alignItems:'center',padding:20}}><Text style={{fontFamily:'monospace',fontSize:11,color:Colors.textMuted}}>No subjects assigned</Text></GlowCard>
          : subjects.map(sub=>(
            <GlowCard key={sub.id} color="cyan" style={s.subCard}>
              <View style={s.subRow}>
                <View style={s.subCodeBadge}><Text style={s.subCode}>{sub.code}</Text></View>
                <View style={{flex:1}}>
                  <Text style={s.subName}>{sub.name}</Text>
                  <Text style={s.subMeta}>Semester {sub.semester}</Text>
                </View>
              </View>
            </GlowCard>
          ))
        }


        <View style={{height:40}}/>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:Colors.void},
  scroll:  {paddingHorizontal:Spacing.md,paddingTop:14,paddingBottom:24},
  header:  {flexDirection:'row',alignItems:'center',gap:14,marginBottom:22},
  avatar:  {width:58,height:58,borderRadius:29,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyan,alignItems:'center',justifyContent:'center'},
  avatarTxt:{fontFamily:'monospace',fontSize:20,fontWeight:'900',color:Colors.cyan},
  name:    {fontFamily:'monospace',fontSize:15,fontWeight:'800',color:Colors.textPrimary},
  empId:   {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  logoutBtn:{padding:8,borderWidth:1,borderColor:Colors.redBorder,borderRadius:4},
  infoCard:{marginBottom:8},
  subCard: {marginBottom:8,padding:13},
  subRow:  {flexDirection:'row',alignItems:'center',gap:13},
  subCodeBadge:{backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyan,borderRadius:3,paddingHorizontal:9,paddingVertical:5},
  subCode: {fontFamily:'monospace',fontSize:12,fontWeight:'800',color:Colors.cyan},
  subName: {fontFamily:'monospace',fontSize:12,fontWeight:'600',color:Colors.textPrimary},
  subMeta: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,marginTop:2},
});
