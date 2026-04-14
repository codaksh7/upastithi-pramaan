// src/screens/admin/AdminFacultyScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, CyberButton, LoadingScreen, ModalSheet } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const EMPTY = { name:'', emp_id:'', department:'Computer Engineering', subjects:'', email:'', password:'frcrce@123' };

export default function AdminFacultyScreen() {
  const [faculty,    setFaculty]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploading,  setUploading]  = useState(false);

  const fetchFaculty = useCallback(async () => {
    try { const d=await adminApi.getFaculty(); setFaculty(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchFaculty(); },[fetchFaculty]);

  const addFaculty = async () => {
    if(!form.name||!form.emp_id){Alert.alert('Error','Name and Employee ID required.');return;}
    setSubmitting(true);
    try {
      const payload={...form,subjects:form.subjects?form.subjects.split(',').map(s=>s.trim()):[]};
      await adminApi.addFaculty(payload);
      Alert.alert('Success',`${form.name} added.`);
      setShowAdd(false); setForm(EMPTY); fetchFaculty();
    } catch(e){Alert.alert('Error',e.message);}
    finally{setSubmitting(false);}
  };

  // ✅ Update faculty (was missing)
  const updateFaculty = async () => {
    if(!editTarget) return;
    setSubmitting(true);
    try {
      const payload={
        name:form.name, department:form.department, email:form.email,
        subjects:form.subjects?form.subjects.split(',').map(s=>s.trim()):undefined,
      };
      await adminApi.updateFaculty(editTarget.id,payload);
      Alert.alert('Success','Faculty updated.');
      setShowEdit(false); setEditTarget(null); setForm(EMPTY); fetchFaculty();
    } catch(e){Alert.alert('Error',e.message);}
    finally{setSubmitting(false);}
  };

  const deleteFaculty = (id,name) => {
    Alert.alert('Remove Faculty',`Remove ${name}?`,[
      {text:'Cancel'},
      {text:'Remove',style:'destructive',onPress:async()=>{
        try { await adminApi.deleteFaculty(id); fetchFaculty(); }
        catch(e){Alert.alert('Error',e.message);}
      }},
    ]);
  };

  // ✅ Mass add faculty via CSV (was missing)
  const massAddFaculty = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type:['text/csv','text/comma-separated-values','application/csv'] });
      if(result.canceled) return;
      setUploading(true);
      const fd = new FormData();
      fd.append('file',{uri:result.assets[0].uri,name:result.assets[0].name,type:'text/csv'});
      await adminApi.massAddFaculty(fd);
      Alert.alert('Success','Faculty bulk added from CSV.');
      fetchFaculty();
    } catch(e){Alert.alert('CSV Upload Error',e.message);}
    finally{setUploading(false);}
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({name:item.name||'',emp_id:item.emp_id||'',department:item.department||'Computer Engineering',subjects:Array.isArray(item.subjects)?item.subjects.join(', '):'',email:item.email||'',password:''});
    setShowEdit(true);
  };

  if(loading) return <LoadingScreen/>;

  const FIELDS_ADD = [
    {label:'Full Name *',    key:'name',       ph:'Prof. Sharma'},
    {label:'Employee ID *',  key:'emp_id',     ph:'EMP-2024-042'},
    {label:'Email',          key:'email',      ph:'faculty@frcrce.ac.in'},
    {label:'Department',     key:'department', ph:'Computer Engineering'},
    {label:'Subjects (comma-separated)', key:'subjects', ph:'CS-101, CS-203'},
    {label:'Password',       key:'password',   ph:'frcrce@123', secure:true},
  ];

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <View style={s.header}>
        <View>
          <Text style={s.title}>FACULTY</Text>
          <Text style={s.subtitle}>{faculty.length} registered</Text>
        </View>
        <View style={s.headerBtns}>
          <TouchableOpacity style={[s.hBtn,{borderColor:Colors.amberBorder}]} onPress={massAddFaculty} disabled={uploading}>
            <Ionicons name="cloud-upload-outline" size={15} color={Colors.amber}/>
            <Text style={[s.hBtnTxt,{color:Colors.amber}]}>{uploading?'...':'CSV'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.hBtn,{borderColor:Colors.greenBorder}]} onPress={()=>{setForm(EMPTY);setShowAdd(true);}}>
            <Ionicons name="person-add" size={15} color={Colors.green}/>
            <Text style={[s.hBtnTxt,{color:Colors.green}]}>ADD</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList data={faculty} keyExtractor={item=>item.id}
        showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchFaculty();}} tintColor={Colors.cyan}/>}
        renderItem={({item})=>(
          <GlowCard color="cyan" style={s.card}>
            <View style={s.cardRow}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{item.name?.charAt(0)}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.empId}>EMP: {item.emp_id}</Text>
                <Text style={s.dept}>{item.department}</Text>
                {item.subjects?.length>0&&(
                  <View style={s.chips}>
                    {item.subjects.map((sub,i)=>(
                      <View key={i} style={s.chip}><Text style={s.chipTxt}>{sub}</Text></View>
                    ))}
                  </View>
                )}
              </View>
              <View style={s.actions}>
                <TouchableOpacity onPress={()=>openEdit(item)} style={s.actionBtn}>
                  <Ionicons name="create-outline" size={14} color={Colors.cyan}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>deleteFaculty(item.id,item.name)} style={[s.actionBtn,{borderColor:Colors.redBorder}]}>
                  <Ionicons name="trash-outline" size={14} color={Colors.red}/>
                </TouchableOpacity>
              </View>
            </View>
          </GlowCard>
        )}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="person-outline" size={38} color={Colors.textMuted}/><Text style={s.emptyTxt}>No faculty registered</Text></View>}
      />

      {/* Add modal */}
      <ModalSheet visible={showAdd} onClose={()=>setShowAdd(false)} title="Add Faculty">
        <ScrollView showsVerticalScrollIndicator={false}>
          {FIELDS_ADD.map(f=>(
            <View key={f.key} style={s.fWrap}>
              <Text style={s.fLabel}>{f.label.toUpperCase()}</Text>
              <TextInput style={s.input} placeholder={f.ph} placeholderTextColor={Colors.textDim}
                value={form[f.key]} onChangeText={v=>setForm(p=>({...p,[f.key]:v}))} secureTextEntry={f.secure}/>
            </View>
          ))}
          <CyberButton label="Add Faculty" color="green" onPress={addFaculty} loading={submitting} style={{marginTop:14,marginBottom:32}}/>
        </ScrollView>
      </ModalSheet>

      {/* Edit modal */}
      <ModalSheet visible={showEdit} onClose={()=>setShowEdit(false)} title="Edit Faculty">
        <ScrollView showsVerticalScrollIndicator={false}>
          {[
            {label:'Full Name',   key:'name',       ph:''},
            {label:'Email',       key:'email',      ph:''},
            {label:'Department',  key:'department', ph:''},
            {label:'Subjects (comma-separated)', key:'subjects', ph:'CS-101, CS-203'},
          ].map(f=>(
            <View key={f.key} style={s.fWrap}>
              <Text style={s.fLabel}>{f.label.toUpperCase()}</Text>
              <TextInput style={s.input} placeholder={f.ph} placeholderTextColor={Colors.textDim}
                value={form[f.key]} onChangeText={v=>setForm(p=>({...p,[f.key]:v}))}/>
            </View>
          ))}
          <CyberButton label="Update Faculty" color="amber" onPress={updateFaculty} loading={submitting} style={{marginTop:14,marginBottom:32}}/>
        </ScrollView>
      </ModalSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     {flex:1,backgroundColor:Colors.void},
  header:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:Spacing.md,paddingTop:10,paddingBottom:8},
  title:    {fontFamily:'monospace',fontSize:18,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1},
  subtitle: {fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2},
  headerBtns:{flexDirection:'row',gap:8},
  hBtn:     {flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:9,paddingVertical:6},
  hBtnTxt:  {fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1},
  list:     {paddingHorizontal:Spacing.md,paddingBottom:40},
  card:     {marginBottom:9,padding:11},
  cardRow:  {flexDirection:'row',alignItems:'flex-start',gap:11},
  avatar:   {width:38,height:38,borderRadius:19,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyan,alignItems:'center',justifyContent:'center'},
  avatarTxt:{fontFamily:'monospace',fontSize:14,fontWeight:'800',color:Colors.cyan},
  name:     {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.textPrimary},
  empId:    {fontFamily:'monospace',fontSize:8,color:Colors.cyan,letterSpacing:1,marginTop:2},
  dept:     {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,marginTop:1},
  chips:    {flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:5},
  chip:     {backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:2,paddingHorizontal:6,paddingVertical:2},
  chipTxt:  {fontFamily:'monospace',fontSize:8,color:Colors.cyan},
  actions:  {flexDirection:'row',gap:5},
  actionBtn:{width:28,height:28,borderRadius:3,borderWidth:1,borderColor:Colors.cyanBorder,alignItems:'center',justifyContent:'center'},
  empty:    {alignItems:'center',paddingTop:56,gap:10},
  emptyTxt: {fontFamily:'monospace',fontSize:12,color:Colors.textMuted},
  fWrap:    {marginBottom:12},
  fLabel:   {fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1.5,marginBottom:5},
  input:    {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,padding:11,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary},
});
