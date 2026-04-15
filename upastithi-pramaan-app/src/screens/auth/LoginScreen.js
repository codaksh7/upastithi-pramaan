// src/screens/auth/LoginScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Background from '../../components/Background';
import { Colors, Spacing } from '../../utils/theme';

const { width: W } = Dimensions.get('window');

const ROLES = [
  { key:'faculty', label:'Faculty',  desc:'Start sessions · Manage attendance · Reports', icon:'shield-checkmark', color:Colors.cyan,  glow:Colors.cyanGlow,  border:Colors.cyanBorder,  idLabel:'Employee ID',  ph:'e.g. EMP-2024-042' },
  { key:'student', label:'Student',  desc:'View attendance · Mark presence · Disputes',   icon:'person-circle',   color:Colors.green, glow:Colors.greenGlow, border:Colors.greenBorder, idLabel:'Roll Number',   ph:'e.g. 10275' },
  { key:'admin',   label:'Admin',    desc:'System config · Enrollment · Disputes · Logs', icon:'settings',        color:Colors.red,   glow:Colors.redGlow,   border:Colors.redBorder,   idLabel:'Admin ID',     ph:'e.g. ADM-001' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [role,     setRole]     = useState(null);
  const [form,     setForm]     = useState({ id:'', password:'', division:'B' });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const shakeX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeX,{toValue:10, duration:55,useNativeDriver:true}),
      Animated.timing(shakeX,{toValue:-10,duration:55,useNativeDriver:true}),
      Animated.timing(shakeX,{toValue:6,  duration:55,useNativeDriver:true}),
      Animated.timing(shakeX,{toValue:-6, duration:55,useNativeDriver:true}),
      Animated.timing(shakeX,{toValue:0,  duration:55,useNativeDriver:true}),
    ]).start();
  };

  const selectRole = (r) => {
    Haptics.selectionAsync();
    Animated.timing(fadeAnim,{toValue:0,duration:140,useNativeDriver:true}).start(()=>{
      setRole(r); setError(''); setForm({id:'',password:'',division:'B'});
      Animated.timing(fadeAnim,{toValue:1,duration:240,useNativeDriver:true}).start();
    });
  };

  const handleSubmit = async () => {
    if (!form.id||!form.password){setError('All fields required.');shake();return;}
    setLoading(true); setError('');
    try {
      const data = await authApi.login(role.key, form.id.trim(), form.password, form.division);
      await login(data.access_token, data.role, data.profile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // RootNavigator automatically switches to the correct screen based on role
    } catch(err){
      setError(err.message||'Login failed.');shake();
    } finally { setLoading(false); }
  };

  const R = role ? ROLES.find(r=>r.key===role.key)||role : null;

  return (
    <SafeAreaView style={s.safe}>
      <Background />
      <KeyboardAvoidingView style={{flex:1}} behavior="padding">
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoIcon}><Ionicons name="scan" size={26} color={Colors.cyan}/></View>
            <Text style={s.logoName}>UPASTITHI-PRAMAAN</Text>
            <Text style={s.logoSub}>SECURE ACCESS PORTAL // v2.4.1</Text>
          </View>

          <Animated.View style={{transform:[{translateX:shakeX}]}}>
            {/* Role selection */}
            {!role ? (
              <View style={s.card}>
                <View style={[s.bracketTL,{borderColor:Colors.cyan}]}/>
                <View style={[s.bracketBR,{borderColor:Colors.cyan}]}/>
                <Text style={s.cardTitle}>SELECT ACCESS LEVEL</Text>
                <Text style={s.cardSub}>Authentication required for system access</Text>
                <Animated.View style={{opacity:fadeAnim}}>
                  {ROLES.map(r=>(
                    <TouchableOpacity key={r.key} style={[s.roleBtn,{borderColor:r.border}]} onPress={()=>selectRole(r)} activeOpacity={0.75}>
                      <View style={[s.roleIcon,{backgroundColor:r.glow,borderColor:r.border}]}>
                        <Ionicons name={r.icon} size={21} color={r.color}/>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={[s.roleLabel,{color:r.color}]}>{r.label} Access</Text>
                        <Text style={s.roleDesc}>{r.desc}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={Colors.textDim}/>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </View>
            ) : (
              /* Login form */
              <Animated.View style={[s.card,{opacity:fadeAnim}]}>
                <View style={[s.bracketTL,{borderColor:R.color}]}/>
                <View style={[s.bracketBR,{borderColor:R.color}]}/>

                <View style={s.formHeader}>
                  <View style={[s.badge,{backgroundColor:R.glow,borderColor:R.border}]}>
                    <View style={[s.dot,{backgroundColor:R.color}]}/>
                    <Text style={[s.badgeText,{color:R.color}]}>{R.label.toUpperCase()} ACCESS</Text>
                  </View>
                  <TouchableOpacity onPress={()=>selectRole(null)}>
                    <Text style={s.changeRole}>← CHANGE</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.formTitle}>{R.label} Login</Text>
                <Text style={s.formSub}>
                  {R.key==='faculty'?'Enter your Employee ID and credentials'
                   :R.key==='student'?'Enter your Roll Number and credentials'
                   :'Restricted — authorized personnel only'}
                </Text>

                {R.key==='student'&&(
                  <View style={s.warnBox}>
                    <Ionicons name="warning" size={12} color={Colors.amber}/>
                    <Text style={s.warnText}>Attendance can only be marked from your registered device.</Text>
                  </View>
                )}

                {/* ID */}
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>{R.idLabel.toUpperCase()}</Text>
                  <TextInput style={[s.input,{borderColor:R.border}]} placeholder={R.ph}
                    placeholderTextColor={Colors.textDim} value={form.id}
                    onChangeText={v=>setForm(f=>({...f,id:v}))} autoCapitalize="none" autoFocus/>
                </View>

                {/* Division (students) */}
                {R.key==='student'&&(
                  <View style={s.fieldWrap}>
                    <Text style={s.fieldLabel}>DIVISION</Text>
                    <View style={s.divRow}>
                      {['A','B','C','D'].map(d=>(
                        <TouchableOpacity key={d} style={[s.divBtn,form.division===d&&{borderColor:Colors.cyan,backgroundColor:Colors.cyanGlow}]}
                          onPress={()=>setForm(f=>({...f,division:d}))}>
                          <Text style={[s.divBtnText,form.division===d&&{color:Colors.cyan}]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Password */}
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>PASSWORD</Text>
                  <View style={s.passWrap}>
                    <TextInput style={[s.input,{borderColor:R.border,flex:1}]} placeholder="••••••••••••"
                      placeholderTextColor={Colors.textDim} secureTextEntry={!showPass}
                      value={form.password} onChangeText={v=>setForm(f=>({...f,password:v}))}/>
                    <TouchableOpacity onPress={()=>setShowPass(x=>!x)} style={s.eyeBtn}>
                      <Ionicons name={showPass?'eye-off':'eye'} size={17} color={Colors.textMuted}/>
                    </TouchableOpacity>
                  </View>
                </View>

                {error?<View style={s.errorBox}><Ionicons name="alert-circle" size={13} color={Colors.red}/><Text style={s.errorText}>{error}</Text></View>:null}

                <TouchableOpacity style={[s.submitBtn,{backgroundColor:R.color},loading&&{opacity:0.7}]}
                  onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator color={Colors.void}/>
                    : <><Ionicons name="log-in" size={15} color={Colors.void}/>
                        <Text style={s.submitText}>ACCESS {R.label.toUpperCase()} PORTAL</Text></>
                  }
                </TouchableOpacity>

                <View style={s.secNote}>
                  <Ionicons name="lock-closed" size={10} color={Colors.textDim}/>
                  <Text style={s.secNoteText}>Sessions expire after 4h. All logins are audited.</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Status bar */}
          <View style={s.statusBar}>
            {['Engine Online','Network Active','DB Connected'].map((l,i)=>(
              <View key={i} style={s.statusItem}>
                <View style={s.statusDot}/><Text style={s.statusText}>{l}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      {flex:1,backgroundColor:Colors.void},
  scroll:    {flexGrow:1,paddingHorizontal:Spacing.md,paddingBottom:32},
  logoWrap:  {alignItems:'center',paddingTop:32,paddingBottom:24},
  logoIcon:  {width:54,height:54,borderRadius:4,backgroundColor:Colors.cyanGlow,borderWidth:1,borderColor:Colors.cyanBorder,alignItems:'center',justifyContent:'center',marginBottom:12},
  logoName:  {fontFamily:'monospace',fontSize:13,fontWeight:'900',color:Colors.cyan,letterSpacing:3,textAlign:'center'},
  logoSub:   {fontFamily:'monospace',fontSize:9,color:Colors.textDim,letterSpacing:2,marginTop:4},
  card:      {backgroundColor:Colors.cardBg,borderWidth:1,borderColor:Colors.border,borderRadius:4,padding:Spacing.lg,position:'relative',overflow:'hidden'},
  bracketTL: {position:'absolute',top:-1,left:-1,width:14,height:14,borderTopWidth:2,borderLeftWidth:2},
  bracketBR: {position:'absolute',bottom:-1,right:-1,width:14,height:14,borderBottomWidth:2,borderRightWidth:2},
  cardTitle: {fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textPrimary,letterSpacing:1,marginBottom:4,textAlign:'center'},
  cardSub:   {fontFamily:'monospace',fontSize:10,color:Colors.textMuted,letterSpacing:1,textAlign:'center',marginBottom:22},
  roleBtn:   {flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:3,padding:13,marginBottom:9,backgroundColor:'rgba(0,200,255,0.02)'},
  roleIcon:  {width:42,height:42,borderRadius:4,borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:13},
  roleLabel: {fontFamily:'monospace',fontSize:13,fontWeight:'700',letterSpacing:0.5},
  roleDesc:  {fontFamily:'monospace',fontSize:9,color:Colors.textDim,marginTop:2},
  formHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:15},
  badge:     {flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:2,paddingHorizontal:9,paddingVertical:4},
  dot:       {width:5,height:5,borderRadius:2.5,marginRight:5},
  badgeText: {fontFamily:'monospace',fontSize:9,letterSpacing:1},
  changeRole:{fontFamily:'monospace',fontSize:10,color:Colors.textDim,letterSpacing:1},
  formTitle: {fontFamily:'monospace',fontSize:15,fontWeight:'800',color:Colors.textPrimary,letterSpacing:0.5,marginBottom:4},
  formSub:   {fontFamily:'monospace',fontSize:10,color:Colors.textDim,letterSpacing:0.5,marginBottom:14,lineHeight:16},
  warnBox:   {flexDirection:'row',gap:7,alignItems:'flex-start',backgroundColor:Colors.amberGlow,borderWidth:1,borderColor:Colors.amberBorder,borderRadius:3,padding:10,marginBottom:14},
  warnText:  {fontFamily:'monospace',fontSize:10,color:Colors.amber,flex:1,lineHeight:15},
  fieldWrap: {marginBottom:14},
  fieldLabel:{fontFamily:'monospace',fontSize:9,color:Colors.cyan,letterSpacing:1.5,marginBottom:6},
  input:     {backgroundColor:'rgba(0,200,255,0.03)',borderWidth:1,borderRadius:3,padding:13,fontFamily:'monospace',fontSize:13,color:Colors.textPrimary},
  divRow:    {flexDirection:'row',gap:8},
  divBtn:    {flex:1,paddingVertical:10,alignItems:'center',borderWidth:1,borderColor:Colors.border,borderRadius:3},
  divBtnText:{fontFamily:'monospace',fontSize:14,color:Colors.textMuted},
  passWrap:  {flexDirection:'row',alignItems:'center',gap:8},
  eyeBtn:    {padding:8},
  errorBox:  {flexDirection:'row',alignItems:'center',gap:7,backgroundColor:Colors.redGlow,borderWidth:1,borderColor:Colors.redBorder,borderRadius:3,padding:10,marginBottom:14},
  errorText: {fontFamily:'monospace',fontSize:11,color:Colors.red,flex:1},
  submitBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,padding:13,borderRadius:3,marginTop:4},
  submitText:{fontFamily:'monospace',fontSize:12,fontWeight:'700',color:Colors.void,letterSpacing:1.5},
  secNote:   {flexDirection:'row',alignItems:'center',gap:5,marginTop:16,paddingTop:13,borderTopWidth:1,borderTopColor:Colors.border},
  secNoteText:{fontFamily:'monospace',fontSize:9,color:Colors.textDim,flex:1,lineHeight:14},
  statusBar: {flexDirection:'row',justifyContent:'space-around',marginTop:20,padding:12,backgroundColor:'rgba(0,255,157,0.04)',borderWidth:1,borderColor:Colors.greenBorder,borderRadius:3},
  statusItem:{flexDirection:'row',alignItems:'center',gap:5},
  statusDot: {width:5,height:5,borderRadius:2.5,backgroundColor:Colors.green},
  statusText:{fontFamily:'monospace',fontSize:9,color:Colors.green,letterSpacing:1},
});
