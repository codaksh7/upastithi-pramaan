// src/components/UI.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Colors, Spacing, Radius, accentColor, accentGlow, accentBorder } from '../utils/theme';

const { width: W } = Dimensions.get('window');

// ── PulseDot ──────────────────────────────────────────────────────────────────
export function PulseDot({ color = Colors.cyan, size = 6 }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size/2, backgroundColor: color, opacity: anim, marginRight: 5 }} />;
}

// ── GlowCard ──────────────────────────────────────────────────────────────────
export function GlowCard({ children, style, color = 'cyan', onPress, noPad }) {
  const bc = accentBorder(color);
  const bg = accentGlow(color);
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.8}
      style={[styles.card, { borderColor: bc, backgroundColor: Colors.cardBg }, noPad && { padding: 0 }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: 0.35, borderRadius: Radius.sm }]} pointerEvents="none" />
      <View style={[styles.bracketTL, { borderColor: bc }]} pointerEvents="none" />
      <View style={[styles.bracketBR, { borderColor: bc }]} pointerEvents="none" />
      {children}
    </Wrap>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color = 'cyan', dot = true, style }) {
  const tc = accentColor(color); const bc = accentBorder(color); const bg = accentGlow(color);
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: bc }, style]}>
      {dot && <PulseDot color={tc} />}
      <Text style={[styles.badgeText, { color: tc }]}>{String(label).toUpperCase()}</Text>
    </View>
  );
}

// ── CyberButton ────────────────────────────────────────────────────────────────
export function CyberButton({ label, onPress, color='cyan', loading:isLoad=false, disabled=false, icon, style, small=false }) {
  const bg = accentColor(color);
  const pad = small ? { paddingVertical: 8, paddingHorizontal: 14 } : { paddingVertical: 13, paddingHorizontal: 22 };
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled||isLoad} activeOpacity={0.8}
      style={[styles.cyberBtn, { backgroundColor: disabled?'#1a2a3a':bg }, pad, style]}>
      {isLoad
        ? <ActivityIndicator color={disabled?Colors.textMuted:Colors.void} size="small" />
        : <>{icon && <View style={{marginRight:7}}>{icon}</View>}
            <Text style={[styles.cyberBtnText,{color:disabled?Colors.textMuted:Colors.void,fontSize:small?10:12}]}>
              {String(label).toUpperCase()}
            </Text>
          </>
      }
    </TouchableOpacity>
  );
}

// ── OutlineButton ─────────────────────────────────────────────────────────────
export function OutlineButton({ label, onPress, color='cyan', style, small=false, icon, disabled=false }) {
  const tc = accentColor(color); const bc = accentBorder(color);
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
      style={[styles.outlineBtn,{borderColor:bc},small&&{paddingVertical:7,paddingHorizontal:12},style]}>
      {icon&&<View style={{marginRight:5}}>{icon}</View>}
      <Text style={[styles.outlineBtnText,{color:disabled?Colors.textMuted:tc},small&&{fontSize:10}]}>{String(label).toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
export function SectionLabel({ label, style }) {
  return (
    <View style={[styles.secLabelRow, style]}>
      <View style={styles.secLine} />
      <Text style={styles.secLabelText}>{String(label).toUpperCase()}</Text>
      <View style={styles.secLine} />
    </View>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
export function InfoRow({ label, value, color }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{String(label).toUpperCase()}</Text>
      <Text style={[styles.infoValue, color&&{color}]} numberOfLines={1}>{value||'—'}</Text>
    </View>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max=100, color='cyan', style }) {
  const pct = Math.min(Math.max((value/max)*100, 0), 100);
  const tc = accentColor(color);
  return (
    <View style={[styles.progressTrack, style]}>
      <View style={[styles.progressFill,{width:`${pct}%`,backgroundColor:tc}]} />
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────
export function LoadingScreen({ message='INITIALIZING...' }) {
  return (
    <View style={styles.loadScreen}>
      <ActivityIndicator color={Colors.cyan} size="large" />
      <Text style={styles.loadText}>{message}</Text>
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={{fontSize:38,marginBottom:10}}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle&&<Text style={styles.emptySub}>{subtitle}</Text>}
    </View>
  );
}

// ── ModalSheet ────────────────────────────────────────────────────────────────
export function ModalSheet({ visible, onClose, title, children }) {
  return visible ? (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{String(title).toUpperCase()}</Text>
          <TouchableOpacity onPress={onClose} style={{padding:4}}>
            <Text style={{color:Colors.textMuted,fontSize:20,fontFamily:'monospace'}}>✕</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  ) : null;
}

// ── ScreenHeader ──────────────────────────────────────────────────────────────
export function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.screenHeader}>
      <View style={{flex:1}}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle&&<Text style={styles.screenSub}>{subtitle}</Text>}
      </View>
      {right&&<View>{right}</View>}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card:        { borderWidth:1, borderRadius:Radius.sm, padding:Spacing.md, overflow:'hidden', position:'relative' },
  bracketTL:   { position:'absolute',top:-1,left:-1,width:12,height:12,borderTopWidth:2,borderLeftWidth:2 },
  bracketBR:   { position:'absolute',bottom:-1,right:-1,width:12,height:12,borderBottomWidth:2,borderRightWidth:2 },
  badge:       { flexDirection:'row',alignItems:'center',paddingHorizontal:9,paddingVertical:4,borderWidth:1,borderRadius:2,alignSelf:'flex-start' },
  badgeText:   { fontFamily:'monospace',fontSize:9,letterSpacing:1 },
  cyberBtn:    { flexDirection:'row',alignItems:'center',justifyContent:'center',borderRadius:Radius.sm },
  cyberBtnText:{ fontFamily:'monospace',fontWeight:'700',letterSpacing:1.5 },
  outlineBtn:  { flexDirection:'row',alignItems:'center',justifyContent:'center',borderWidth:1,borderRadius:Radius.sm,paddingVertical:10,paddingHorizontal:16 },
  outlineBtnText:{ fontFamily:'monospace',fontSize:11,letterSpacing:1 },
  secLabelRow: { flexDirection:'row',alignItems:'center',gap:10,marginBottom:14,marginTop:4 },
  secLine:     { flex:1,height:1,backgroundColor:Colors.border },
  secLabelText:{ fontFamily:'monospace',fontSize:9,letterSpacing:2,color:Colors.cyan },
  infoRow:     { flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:9,borderBottomWidth:1,borderBottomColor:Colors.border },
  infoLabel:   { fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1.2 },
  infoValue:   { fontFamily:'monospace',fontSize:12,color:Colors.textPrimary,letterSpacing:0.5,flex:1,textAlign:'right' },
  progressTrack:{ height:4,backgroundColor:Colors.border,borderRadius:2,overflow:'hidden' },
  progressFill: { height:'100%',borderRadius:2 },
  divider:     { height:1,backgroundColor:Colors.border,marginVertical:Spacing.sm },
  loadScreen:  { flex:1,backgroundColor:Colors.void,alignItems:'center',justifyContent:'center',gap:16 },
  loadText:    { fontFamily:'monospace',fontSize:11,color:Colors.cyan,letterSpacing:3 },
  emptyWrap:   { alignItems:'center',paddingVertical:48,paddingHorizontal:24 },
  emptyTitle:  { fontFamily:'monospace',fontSize:13,fontWeight:'700',color:Colors.textSecondary,letterSpacing:1,textAlign:'center' },
  emptySub:    { fontFamily:'monospace',fontSize:10,color:Colors.textMuted,textAlign:'center',marginTop:8,lineHeight:17 },
  overlay:     { ...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.78)',justifyContent:'flex-end',zIndex:999 },
  sheet:       { backgroundColor:Colors.deep,borderTopWidth:1,borderTopColor:Colors.border,borderRadius:16,padding:Spacing.lg,paddingBottom:36,maxHeight:'90%' },
  sheetHeader: { flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20 },
  sheetTitle:  { fontFamily:'monospace',fontSize:14,fontWeight:'800',color:Colors.cyan,letterSpacing:2 },
  screenHeader:{ flexDirection:'row',alignItems:'flex-start',paddingHorizontal:Spacing.md,paddingTop:Spacing.md,paddingBottom:Spacing.sm },
  screenTitle: { fontFamily:'monospace',fontSize:19,fontWeight:'900',color:Colors.textPrimary,letterSpacing:1 },
  screenSub:   { fontFamily:'monospace',fontSize:9,color:Colors.textMuted,letterSpacing:1,marginTop:2 },
});
