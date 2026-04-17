// src/components/Background.js
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../utils/theme';
const { width: W } = Dimensions.get('window');

export default function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.void }]} />
      {Array.from({ length: 18 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.gridH, { top: i * 64 }]} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.gridV, { left: i * 64 }]} />
      ))}

    </View>
  );
}

const styles = StyleSheet.create({
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,200,255,0.04)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,200,255,0.04)' },
});
