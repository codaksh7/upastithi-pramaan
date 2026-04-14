// src/screens/admin/AdminStudentsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { adminApi } from '../../api';
import Background from '../../components/Background';
import { GlowCard, CyberButton, LoadingScreen, ModalSheet, OutlineButton } from '../../components/UI';
import { Colors, Spacing } from '../../utils/theme';

const EMPTY = { name:'',roll:'',division:'B',email:'',mac:'',semester:'5',department:'Computer Engineering',password:'frcrce@123' };

export default function AdminStudentsScreen() {
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [showAdd,    setShowAdd]    = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploading,  setUploading]  = useState(false);

  const fetchStudents = useCallback(async (q='') => {
    try { const d=await adminApi.getStudents(q); setStudents(d); }
    catch(e){ console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchStudents(); },[fetchStudents]);

  const handleSearch = (t) => { setSearch(t); fetchStudents(t); };

  const enrollStudent = async () => {
    if(!form.name||!form.roll){Alert.alert('Error','Name and Roll Number required.');return;}
    setSubmitting(true);
    try {
      await adminApi.enrollStudent(form);
      Alert.alert('Success',`${form.name} enrolled.`);
      setShowAdd(false); setForm(EMPTY); fetchStudents(search);
    } catch(e){Alert.alert('Error',e.message);}
    finally{setSubmitting(false);}
  };

  const updateStudent = async () => {
    if(!editTarget) return;
    setSubmitting(true);
    try {
      await adminApi.updateStudent(editTarget.id,{name:form.name,division:form.division,email:form.email,mac:form.mac,semester:form.semester});
      Alert.alert('Success','Student updated.');
      setShowEdit(false); setEditTarget(null); setForm(EMPTY); fetchStudents(search);
    } catch(e){Alert.alert('Error',e.message);}
    finally{setSubmitting(false);}
  };

  const deleteStudent = (id,name) => {
    Alert.alert('Delete Student',`Remove ${name}?`,[
      {text:'Cancel'},
      {text:'Delete',style:'destructive',onPress:async()=>{
        try { await adminApi.deleteStudent(id); fetchStudents(search); }
        catch(e){Alert.alert('Error',e.message);}
      }},
    ]);
  };

  // ✅ Mass enroll via CSV
  const massEnroll = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type:['text/csv','text/comma-separated-values','application/csv'] });
      if(result.canceled) return;
      setUploading(true);
      const fd = new FormData();
      fd.append('file',{ uri:result.assets[0].uri, name:result.assets[0].name, type:'text/csv' });
      await adminApi.massEnrollStudents(fd);
      Alert.alert('Success','Students bulk enrolled from CSV.');
      fetchStudents(search);
    } catch(e){ Alert.alert('CSV Upload Error',e.message); }
    finally{setUploading(false);}
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setForm({name:item.name||'',roll:item.roll||'',division:item.division||'B',email:item.email||'',mac:item.mac||'',semester:item.semester||'5',department:item.department||'Computer Engineering',password:''});
    setShowEdit(true);
  };

  if(loading) return <LoadingScreen/>;

  const FIELDS = [
    {label:'Full Name *',   key:'name',       ph:'e.g. Devansh Nayak'},
    {label:'Roll Number *', key:'roll',        ph:'e.g. 10268'},
    {label:'Email',         key:'email',       ph:'student@frcrce.ac.in'},
    {label:'MAC Address',   key:'mac',         ph:'AA:BB:CC:DD:EE:FF'},
    {label:'Semester',      key:'semester',    ph:'5'},
    {label:'Department',    key:'department',  ph:'Computer Engineering'},
    {label:'Password',      key:'password',    ph:'frcrce@123',secure:true},
  ];

  return (
    <SafeAreaView style={s.safe}>
      <Background/>
      <View style={s.header}>
        <View>
          <Text style={s.title}>STUDENTS</Text>
          <Text style={s.subtitle}>{students.length} enrolled</Text>
        </View>
        <View style={s.headerBtns}>
          <TouchableOpacity style={[s.hBtn,{borderColor:Colors.amberBorder}]} onPress={massEnroll} disabled={uploading}>
            <Ionicons name="cloud-upload-outline" size={16} color={Colors.amber}/>
            <Text style={[s.hBtnTxt,{color:Colors.amber}]}>{uploading?'...':'CSV'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.hBtn} onPress={()=>{setForm(EMPTY);setShowAdd(true);}}>
            <Ionicons name="person-add" size={16} color={Colors.cyan}/>
            <Text style={s.hBtnTxt}>ADD</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={15} color={Colors.textMuted}/>
        <TextInput style={s.searchInput} placeholder="Search by name or roll..." placeholderTextColor={Colors.textDim} value={search} onChangeText={handleSearch}/>
        {search?<TouchableOpacity onPress={()=>handleSearch('')}><Ionicons name="close-circle" size={15} color={Colors.textMuted}/></TouchableOpacity>:null}
      </View>

      <FlatList data={students} keyExtractor={item=>item.id||item.roll}
        contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchStudents(search);}} tintColor={Colors.cyan}/>}
        renderItem={({item})=>(
          <GlowCard color="cyan" style={s.stuCard}>
            <View style={s.stuRow}>
              <View style={s.stuAvatar}><Text style={s.stuAvatarTxt}>{item.name?.charAt(0)}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.stuName}>{item.name}</Text>
                <Text style={s.stuMeta}>Roll: {item.roll} · Div: {item.division} · Sem: {item.semester}</Text>
                {item.mac&&<Text style={s.stuMac}>MAC: {item.mac}</Text>}
                {item.email&&<Text style={s.stuMac}>{item.email}</Text>}
              </View>
              <View style={s.stuActions}>
                <TouchableOpacity onPress={()=>openEdit(item)} style={s.actionBtn}>
                  <Ionicons name="create-outline" size={15} color={Colors.cyan}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>deleteStudent(item.id,item.name)} style={[s.actionBtn,{borderColor:Colors.redBorder}]}>
                  <Ionicons name="trash-outline" size={15} color={Colors.red}/>
                </TouchableOpacity>
              </View>
            </View>
          </GlowCard>
        )}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="people-outline" size={38} color={Colors.textMuted}/><Text style={s.emptyTxt}>No students found</Text></View>}
      />

      {/* Add modal */}
      <ModalSheet visible={showAdd} onClose={()=>setShowAdd(false)} title="Enroll Student">
        <ScrollView showsVerticalScrollIndicator={false}>
          {FIELDS.map(f=>(
            <View key={f.key} style={s.fWrap}>
              <Text style={s.fLabel}>{f.label.toUpperCase()}</Text>
              <TextInput style={s.input} placeholder={f.ph} placeholderTextColor={Colors.textDim}
                value={form[f.key]} onChangeText={v=>setForm(p=>({...p,[f.key]:v}))} secureTextEntry={f.secure}/>
            </View>
          ))}
          <View style={s.fWrap}>
            <Text style={s.fLabel}>DIVISION</Text>
            <View style={s.divRow}>
              {['A','B','C','D'].map(d=>(
                <TouchableOpacity key={d} style={[s.divBtn,form.division===d&&s.divBtnActive]} onPress={()=>setForm(p=>({...p,division:d}))}>
                  <Text style={[s.divBtnTxt,form.division===d&&{color:Colors.cyan}]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <CyberButton label="Enroll Student" color="cyan" onPress={enrollStudent} loading={submitting} style={{marginTop:14,marginBottom:32}}/>
        </ScrollView>
      </ModalSheet>

      {/* Edit modal */}
      <ModalSheet visible={showEdit} onClose={()=>setShowEdit(false)} title="Edit Student">
        <ScrollView showsVerticalScrollIndicator={false}>
          {[{label:'Full Name',key:'name',ph:''},{label:'Email',key:'email',ph:''},{label:'MAC Address',key:'mac',ph:''},{label:'Semester',key:'semester',ph:''}].map(f=>(
            <View key={f.key} style={s.fWrap}>
              <Text style={s.fLabel}>{f.label.toUpperCase()}</Text>
              <TextInput style={s.input} placeholder={f.ph} placeholderTextColor={Colors.textDim}
                value={form[f.key]} onChangeText={v=>setForm(p=>({...p,[f.key]:v}))}/>
            </View>
          ))}
          <View style={s.fWrap}>
            <Text style={s.fLabel}>DIVISION</Text>
            <View style={s.divRow}>
              {['A','B','C','D'].map(d=>(
                <TouchableOpacity key={d} style={[s.divBtn,form.division===d&&s.divBtnActive]} onPress={()=>setForm(p=>({...p,division:d}))}>
                  <Text style={[s.divBtnTxt,form.division===d&&{color:Colors.cyan}]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <CyberButton label="Update Student" color="amber" onPress={updateStudent} loading={submitting} style={{marginTop:14,marginBottom:32}}/>
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
  hBtn:     {flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:Colors.cyanBorder,borderRadius:3,paddingHorizontal:10,paddingVertical:7},
  hBtnTxt:  {fontFamily:'monospace',fontSize:10,color:Colors.cyan,letterSpacing:1},
  searchWrap:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,marginHorizontal:Spacing.md,marginBottom:10,paddingHorizontal:11,paddingVertical:9},
  searchInput:{flex:1,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary},
  list:     {paddingHorizontal:Spacing.md,paddingBottom:40},
  stuCard:  {marginBottom:8,padding:11},
  stuRow:   {flexDirection:'row',alignItems:'center',gap:11},
  stuAvatar:{width:36,height:36,borderRadius:18,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyan,alignItems:'center',justifyContent:'center'},
  stuAvatarTxt:{fontFamily:'monospace',fontSize:14,fontWeight:'800',color:Colors.cyan},
  stuName:  {fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.textPrimary},
  stuMeta:  {fontFamily:'monospace',fontSize:8,color:Colors.textMuted,marginTop:2,letterSpacing:0.4},
  stuMac:   {fontFamily:'monospace',fontSize:8,color:Colors.textDim,marginTop:1},
  stuActions:{flexDirection:'row',gap:6},
  actionBtn:{width:30,height:30,borderRadius:3,borderWidth:1,borderColor:Colors.cyanBorder,alignItems:'center',justifyContent:'center'},
  empty:    {alignItems:'center',paddingTop:56,gap:10},
  emptyTxt: {fontFamily:'monospace',fontSize:12,color:Colors.textMuted},
  fWrap:    {marginBottom:13},
  fLabel:   {fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1.5,marginBottom:5},
  input:    {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:3,padding:11,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary},
  divRow:   {flexDirection:'row',gap:8},
  divBtn:   {flex:1,paddingVertical:9,alignItems:'center',borderWidth:1,borderColor:Colors.border,borderRadius:3},
  divBtnActive:{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow},
  divBtnTxt:{fontFamily:'monospace',fontSize:13,color:Colors.textMuted},
});
