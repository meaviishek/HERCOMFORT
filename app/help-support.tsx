import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';

interface FAQ {
  q: string;
  a: string;
  category: string;
}

const FAQS: FAQ[] = [
  {
    category: 'Device',
    q: 'How do I pair my Her Comfort belt with the app?',
    a: 'Power on your Her Comfort belt by holding the power button until the LED illuminates. Open the Nari app, tap the Bluetooth icon or navigate to Device Setup, and tap "Scan & Connect". The belt will automatically pair and stream real-time temperature, EMG biofeedback, and posture dynamics.',
  },
  {
    category: 'Therapy',
    q: 'What temperature is safe for menstrual relief?',
    a: 'Her Comfort features built-in medical safety thermal regulation between 36.0°C and 40.0°C. We recommend starting at 38.0°C and adjusting upwards as needed. The firmware automatically regulates heating elements to prevent thermal discomfort.',
  },
  {
    category: 'Biometrics',
    q: 'What does the EMG muscle contraction reading mean?',
    a: 'The EMG (Electromyogram) sensor measures electrical micro-voltages produced by pelvic and uterine smooth muscle contractions. Lower readings indicate relaxed muscle tone, while higher values (>50 µV) reflect active cramping and uterine tension.',
  },
  {
    category: 'Therapy',
    q: 'How often can I run a therapy session?',
    a: 'You can use Her Comfort as frequently as needed for pain relief. Standard clinical presets range from 10 to 30 minutes. We recommend alternating vibration modes (Continuous, Pulse, Harmonic) for optimal sensory neuromodulation.',
  },
  {
    category: 'Clinical',
    q: 'Can I share session reports with my doctor?',
    a: 'Yes. In the History tab, tap any completed session and select "Export PDF Report" or visit Data & Analytics to generate a comprehensive physician-grade summary showing your pain reduction trends and EMG contraction history.',
  },
  {
    category: 'Maintenance',
    q: 'How do I clean and store the belt?',
    a: 'Wipe the inner thermal surface with a damp, alcohol-free cloth after use. Do not submerge the belt in water. Store in the protective pouch away from direct sunlight.',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [guideModal, setGuideModal] = useState(false);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  const handleContactEmail = () => {
    Linking.openURL('mailto:care@narihealth.ai?subject=Her%20Comfort%20Support%20Inquiry').catch(
      () => {
        Alert.alert('Support Email', 'You can reach our clinical team directly at: care@narihealth.ai');
      }
    );
  };

  const handleOpenTroubleshooter = () => {
    Alert.alert(
      'BLE Troubleshooter',
      '1. Ensure Bluetooth and Location services are enabled.\n2. Verify the Her Comfort belt is powered on.\n3. Make sure the belt is not currently paired to another device.\n4. Keep phone within 5 meters of the belt.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Device Screen', onPress: () => router.push('/ble-device' as any) },
      ]
    );
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
        <Text style={s.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={s.searchWrap}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search FAQs, belt guides, troubleshooting..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Action Assistance Cards */}
        <Text style={s.sectionHeader}>SUPPORT & GUIDANCE</Text>
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionCard}
            onPress={() => setGuideModal(true)}
            activeOpacity={0.8}
          >
            <View style={[s.actionIconBox, { backgroundColor: '#FFF0F5' }]}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color={T.pink.action} />
            </View>
            <Text style={s.actionTitle}>Belt User Guide</Text>
            <Text style={s.actionDesc}>Placement & modes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionCard}
            onPress={handleOpenTroubleshooter}
            activeOpacity={0.8}
          >
            <View style={[s.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="bluetooth-connect" size={22} color="#0284C7" />
            </View>
            <Text style={s.actionTitle}>BLE Diagnostic</Text>
            <Text style={s.actionDesc}>Pairing helper</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionCard}
            onPress={handleContactEmail}
            activeOpacity={0.8}
          >
            <View style={[s.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="headphones" size={22} color="#059669" />
            </View>
            <Text style={s.actionTitle}>Care Team</Text>
            <Text style={s.actionDesc}>Email support</Text>
          </TouchableOpacity>
        </View>

        {/* FAQs Accordion */}
        <Text style={s.sectionHeader}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={s.card}>
          {filteredFaqs.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>No matching questions found.</Text>
            </View>
          ) : (
            filteredFaqs.map((faq, i) => {
              const isOpen = expandedIndex === i;
              const isLast = i === filteredFaqs.length - 1;
              return (
                <View
                  key={faq.q}
                  style={[s.faqItem, isLast && { borderBottomWidth: 0 }]}
                >
                  <TouchableOpacity
                    style={s.faqHeader}
                    onPress={() => setExpandedIndex(isOpen ? null : i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.faqQuestion, isOpen && { color: T.pink.action }]}>
                      {faq.q}
                    </Text>
                    <Feather
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={isOpen ? T.pink.action : '#94A3B8'}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={s.faqBody}>
                      <Text style={s.faqAnswer}>{faq.a}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Clinical Disclaimer Notice */}
        <View style={s.disclaimerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="information" size={16} color="#0284C7" />
            <Text style={s.disclaimerTitle}>CLINICAL & MEDICAL NOTICE</Text>
          </View>
          <Text style={s.disclaimerText}>
            Her Comfort and the Nari AI platform provide physiological biofeedback, thermal comfort, and neuromodulating vibration for menstrual symptom relief. They are not intended to diagnose, cure, or substitute professional gynecological medical advice. Consult your physician for persistent pelvic symptoms.
          </Text>
        </View>

        {/* App Version Info */}
        <View style={s.versionBox}>
          <Text style={s.versionTitle}>Nari Health &bull; Her Comfort</Text>
          <Text style={s.versionSub}>App Version 2.4.0 (Build 108) &bull; Firmware v1.2</Text>
          <Text style={s.versionSub}>BLE Protocol v2 (9000/9001/9002) &bull; MongoDB Cloud Connected</Text>
        </View>

      </ScrollView>

      {/* User Guide Modal */}
      <Modal
        visible={guideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGuideModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.modalTitle}>Her Comfort User Guide</Text>
              <TouchableOpacity onPress={() => setGuideModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={s.guideStep}>
                <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.stepTitle}>Positioning the Belt</Text>
                  <Text style={s.stepDesc}>Place the thermal plate directly against your lower abdomen (suprapubic area) or lower back. Fasten comfortably using the elastic strap.</Text>
                </View>
              </View>

              <View style={s.guideStep}>
                <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.stepTitle}>Thermal Temperature Control</Text>
                  <Text style={s.stepDesc}>Set target temperature between 36°C and 40°C. The internal safety regulator maintains gentle thermal relief without overheating.</Text>
                </View>
              </View>

              <View style={s.guideStep}>
                <View style={s.stepNum}><Text style={s.stepNumText}>3</Text></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.stepTitle}>Vibration Neuromodulation</Text>
                  <Text style={s.stepDesc}>Choose Continuous mode for consistent relief, Pulse mode for wave-like soothing, or Harmonic mode to disrupt pain signals.</Text>
                </View>
              </View>

              <View style={s.guideStep}>
                <View style={s.stepNum}><Text style={s.stepNumText}>4</Text></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.stepTitle}>EMG BioAmp Feedback</Text>
                  <Text style={s.stepDesc}>The bio-potential sensors detect uterine muscle cramping. Watch the real-time oscilloscope on the Session screen to track muscle relaxation.</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setGuideModal(false)}
              style={s.modalDoneBtn}
            >
              <Text style={s.modalDoneText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  actionDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 14,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  faqBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  faqAnswer: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  disclaimerCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  disclaimerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.6,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 17,
  },
  versionBox: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 3,
  },
  versionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  versionSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.pink.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  modalDoneBtn: {
    backgroundColor: T.pink.action,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
