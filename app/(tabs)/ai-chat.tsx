/**
 * Nari AI Companion / Chat Screen — ai-chat.tsx
 * Instant personalized women's health guidance & pain relief assistant
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T, palette } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useBluetooth } from '../../context/BluetoothContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  suggestions?: string[];
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm-1',
    sender: 'ai',
    text: "Hello! I'm your Nari Health Companion. Whether you're feeling cramps, fatigue, or want custom relief advice for your cycle, I'm here for you. How can I assist you right now?",
    time: 'Just now',
    suggestions: [
      'Relieve severe period cramps',
      'Recommended heat & vibration',
      'What should I eat during period?',
      'Safe exercises for back pain',
    ],
  },
];

export default function AIChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { connectedDevice, liveData } = useBluetooth();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    return () => showSub.remove();
  }, []);

  const curTemp = Number(liveData?.temp ?? liveData?.temperature ?? 36.6).toFixed(1);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // AI smart response generation
    setTimeout(() => {
      const reply = generateAiResponse(query, curTemp);
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, 900);
  };

  function generateAiResponse(q: string, temp: string): Message {
    const lower = q.toLowerCase();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (lower.includes('cramp') || lower.includes('pain') || lower.includes('hurt')) {
      return {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `I'm sorry you're in pain 🫂. Here is what will bring fast relief:\n\n1. **Therapy Session**: Turn on Her Comfort Band with 39.5°C soothing heat and 'Pulse' vibration.\n2. **Gentle Stretch**: Try Child's Pose or Knees-to-Chest for 3 minutes.\n3. **Hydration**: Drink warm chamomile or ginger tea to relax uterine muscles.\n\nWould you like to launch a 15-minute soothing relief session now?`,
        time,
        suggestions: ['Start Relief Session ⚡', 'Show Relief Exercises 🧘', 'Check my current temperature'],
      };
    }

    if (lower.includes('heat') || lower.includes('vibrat') || lower.includes('session') || lower.includes('device')) {
      return {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Your Her Comfort Band is calibrated for targeted therapeutic neuromodulation:\n\n• **Target Heat**: 39°C - 41°C is ideal for pelvic vascular circulation.\n• **Vibration**: 65% - 80% intensity on 'Wave' mode blocks pain signal transmission via gate-control mechanism.\n• **Current Sensor**: Reading approx ${temp}°C.\n\nHead over to the **Session tab** to fine-tune your parameters!`,
        time,
        suggestions: ['Go to Session Tab', 'Is high heat safe?', 'How does vibration help?'],
      };
    }

    if (lower.includes('eat') || lower.includes('food') || lower.includes('diet') || lower.includes('tea')) {
      return {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Optimal nutrition for menstrual comfort 🍵:\n\n• **Anti-inflammatory**: Dark chocolate (70%+), walnuts, berries, and spinach rich in magnesium.\n• **Soothing Fluids**: Peppermint, ginger, or fennel tea.\n• **Limit**: Excess caffeine, refined sugars, and salty foods that worsen water retention and cramping.`,
        time,
        suggestions: ['More healthy snacks', 'Relieve severe period cramps'],
      };
    }

    if (lower.includes('exercise') || lower.includes('stretch') || lower.includes('yoga') || lower.includes('back')) {
      return {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Gentle movement can significantly release pelvic and lumbar tension 🌸:\n\n• **Cat-Cow Stretch** (5 min): Mobilizes the lumbar spine.\n• **Reclined Bound Angle**: Opens hips and relaxes lower abdominal wall.\n• **Deep Diaphragmatic Breathing**: Calms nervous system and lowers pain perception.`,
        time,
        suggestions: ['View Exercises Page', 'What about intense workouts?'],
      };
    }

    return {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: `I understand! Taking care of your comfort and hormonal wellbeing is our top priority 💖. Remember to listen to your body, stay warm, and take breaks whenever needed. Feel free to ask me about cycle symptoms, soothing band settings, or nutrition advice!`,
      time,
      suggestions: ['Relieve severe period cramps', 'Recommended heat & vibration', 'Log today symptoms'],
    };
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="robot-happy" size={24} color="#fff" />
            <View style={styles.onlineDot} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.title}>Nari AI Assistant</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeTxt}>GPT-4o Health</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              {connectedDevice ? `Syncing with ${connectedDevice.name}` : 'Always here for your wellness'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/wellness' as any)}
          style={styles.wellnessBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={16} color={T.pink.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Chat Messages ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Disclaimer badge */}
          <View style={styles.disclaimerBox}>
            <Ionicons name="shield-checkmark" size={14} color={T.pink.primary} />
            <Text style={styles.disclaimerTxt}>
              Personalized wellness companion. Not a substitute for clinical medical advice.
            </Text>
          </View>

          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.msgRow,
                m.sender === 'user' ? styles.userRow : styles.aiRow,
              ]}
            >
              {m.sender === 'ai' && (
                <View style={styles.aiMsgAvatar}>
                  <Ionicons name="sparkles" size={16} color={T.pink.primary} />
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  m.sender === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text
                  style={[
                    styles.msgText,
                    m.sender === 'user' ? styles.userText : styles.aiText,
                  ]}
                >
                  {m.text}
                </Text>
                <Text
                  style={[
                    styles.timeText,
                    m.sender === 'user' ? styles.userTime : styles.aiTime,
                  ]}
                >
                  {m.time}
                </Text>

                {/* Quick suggestions */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {m.suggestions.map((sug, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (sug.includes('Start Relief Session')) {
                            router.push('/(tabs)/session' as any);
                          } else if (sug.includes('Exercises')) {
                            router.push('/exercises' as any);
                          } else {
                            handleSend(sug);
                          }
                        }}
                        style={styles.suggestionChip}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.suggestionText}>{sug}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          {isTyping && (
            <View style={[styles.msgRow, styles.aiRow]}>
              <View style={styles.aiMsgAvatar}>
                <Ionicons name="sparkles" size={16} color={T.pink.primary} />
              </View>
              <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color={T.pink.primary} />
                <Text style={{ color: T.text.muted, fontSize: 13, fontWeight: '600' }}>
                  Nari is thinking…
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input Bar ── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about cramps, symptoms, relief…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim()}
            style={[
              styles.sendButton,
              { backgroundColor: input.trim() ? T.pink.primary : '#fce7f3' },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={input.trim() ? '#ffffff' : '#f472b6'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff5fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#fce7f3',
    elevation: 3,
    shadowColor: '#e84ea1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    elevation: 4,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  onlineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: T.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: T.text.muted,
    marginTop: 1,
  },
  aiBadge: {
    backgroundColor: '#fce7f3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeTxt: {
    color: T.pink.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  wellnessBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff0f7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  msgList: {
    padding: 16,
    paddingBottom: 24,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fce7f3',
    marginBottom: 16,
    alignSelf: 'center',
  },
  disclaimerTxt: {
    fontSize: 11,
    color: T.text.muted,
    fontWeight: '600',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiMsgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: T.pink.primary,
    borderBottomRightRadius: 4,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#fce7f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  aiText: {
    color: T.text.primary,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  aiTime: {
    color: '#9ca3af',
  },
  suggestionsContainer: {
    marginTop: 10,
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: '#fff0f7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    alignSelf: 'flex-start',
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.pink.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#fce7f3',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff5fa',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: T.text.primary,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: '#fce7f3',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: T.pink.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
