import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/theme';

const APPEARANCE_KEY = '@nari_appearance_config_v1';

type ThemeMode = 'system' | 'light' | 'dark' | 'clinical';
type AccentColor = '#E84EA1' | '#0284C7' | '#7C3AED' | '#059669' | '#D97706';
type FontSizeScale = 'Standard' | 'Comfort' | 'Large';

const ACCENT_COLORS: { name: string; color: AccentColor }[] = [
  { name: 'Nari Rose', color: '#E84EA1' },
  { name: 'Ocean Blue', color: '#0284C7' },
  { name: 'Lavender', color: '#7C3AED' },
  { name: 'Mint Fresh', color: '#059669' },
  { name: 'Warm Amber', color: '#D97706' },
];

export default function AppAppearanceScreen() {
  const router = useRouter();
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState<AccentColor>('#E84EA1');
  const [fontScale, setFontScale] = useState<FontSizeScale>('Standard');
  const [compactCards, setCompactCards] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [smoothWaveform, setSmoothWaveform] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.themeMode) setThemeMode(parsed.themeMode);
          if (parsed.accent) setAccent(parsed.accent);
          if (parsed.fontScale) setFontScale(parsed.fontScale);
          if (parsed.compactCards !== undefined) setCompactCards(parsed.compactCards);
          if (parsed.highContrast !== undefined) setHighContrast(parsed.highContrast);
          if (parsed.smoothWaveform !== undefined) setSmoothWaveform(parsed.smoothWaveform);
          if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
        } catch {}
      }
    });
  }, []);

  const saveConfig = (key: string, val: any) => {
    AsyncStorage.getItem(APPEARANCE_KEY).then((raw) => {
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, [key]: val };
      AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)).catch(() => {});
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>App Appearance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Mode Grid */}
        <Text style={s.sectionHeader}>THEME MODE</Text>
        <View style={s.themeGrid}>
          {[
            { id: 'light', label: 'Light Theme', icon: 'sunny-outline', desc: 'Optimal for daytime' },
            { id: 'dark', label: 'Dark Mode', icon: 'moon-outline', desc: 'Easy on evening eyes' },
            { id: 'system', label: 'Auto System', icon: 'phone-portrait-outline', desc: 'Match device setting' },
            { id: 'clinical', label: 'Clinical Lite', icon: 'medical-outline', desc: 'High-contrast medical' },
          ].map((t) => {
            const isSelected = themeMode === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.themeBox, isSelected && { borderColor: accent, backgroundColor: '#FFFFFF' }]}
                onPress={() => {
                  setThemeMode(t.id as ThemeMode);
                  saveConfig('themeMode', t.id);
                }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <Ionicons
                    name={t.icon as any}
                    size={22}
                    color={isSelected ? accent : '#64748B'}
                  />
                  {isSelected && <Feather name="check-circle" size={16} color={accent} />}
                </View>
                <Text style={[s.themeLabel, isSelected && { color: '#0F172A', fontWeight: '800' }]}>
                  {t.label}
                </Text>
                <Text style={s.themeDesc}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Accent Color Palette */}
        <Text style={s.sectionHeader}>BRAND ACCENT COLOR</Text>
        <View style={s.card}>
          <View style={s.paletteRow}>
            {ACCENT_COLORS.map((c) => {
              const isSelected = accent === c.color;
              return (
                <TouchableOpacity
                  key={c.color}
                  onPress={() => {
                    setAccent(c.color);
                    saveConfig('accent', c.color);
                  }}
                  style={s.colorCircleWrap}
                  activeOpacity={0.8}
                >
                  <View style={[s.colorCircle, { backgroundColor: c.color }]}>
                    {isSelected && <Feather name="check" size={18} color="#FFFFFF" />}
                  </View>
                  <Text style={[s.colorName, isSelected && { color: c.color, fontWeight: '800' }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Typography & Font Scaling */}
        <Text style={s.sectionHeader}>FONT SCALE & ACCESSIBILITY</Text>
        <View style={s.card}>
          <View style={s.fontScaleRow}>
            {(['Standard', 'Comfort', 'Large'] as FontSizeScale[]).map((scale) => {
              const isSelected = fontScale === scale;
              return (
                <TouchableOpacity
                  key={scale}
                  onPress={() => {
                    setFontScale(scale);
                    saveConfig('fontScale', scale);
                  }}
                  style={[s.fontScaleBtn, isSelected && { backgroundColor: accent }]}
                >
                  <Text style={[s.fontScaleText, isSelected && { color: '#FFFFFF', fontWeight: '800' }]}>
                    {scale}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Interface & Visualization Controls */}
        <Text style={s.sectionHeader}>INTERFACE & BIOMETRIC VISUALS</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="view-compact-outline" size={20} color={accent} />
              <View>
                <Text style={s.rowLabel}>Compact Card View</Text>
                <Text style={s.rowSub}>Higher density telemetry cards in history</Text>
              </View>
            </View>
            <Switch
              value={compactCards}
              onValueChange={(v) => {
                setCompactCards(v);
                saveConfig('compactCards', v);
              }}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={compactCards ? accent : '#94A3B8'}
            />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="contrast" size={20} color={accent} />
              <View>
                <Text style={s.rowLabel}>High Contrast Charts</Text>
                <Text style={s.rowSub}>Enhance line boldness on EMG oscilloscopes</Text>
              </View>
            </View>
            <Switch
              value={highContrast}
              onValueChange={(v) => {
                setHighContrast(v);
                saveConfig('highContrast', v);
              }}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={highContrast ? accent : '#94A3B8'}
            />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="sine-wave" size={20} color={accent} />
              <View>
                <Text style={s.rowLabel}>Waveform Smoothing</Text>
                <Text style={s.rowSub}>Interpolate 5Hz BLE packet points</Text>
              </View>
            </View>
            <Switch
              value={smoothWaveform}
              onValueChange={(v) => {
                setSmoothWaveform(v);
                saveConfig('smoothWaveform', v);
              }}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={smoothWaveform ? accent : '#94A3B8'}
            />
          </View>

          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="motion-pause-outline" size={20} color={accent} />
              <View>
                <Text style={s.rowLabel}>Reduce Motion</Text>
                <Text style={s.rowSub}>Minimize transitional animations</Text>
              </View>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(v) => {
                setReduceMotion(v);
                saveConfig('reduceMotion', v);
              }}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={reduceMotion ? accent : '#94A3B8'}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  themeBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  themeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  paletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  colorCircleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  colorName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  fontScaleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  fontScaleBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fontScaleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
});
