import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
export const ONBOARDING_COMPLETED_KEY = '@nari_onboarding_completed_v1';

const onboardingData = [
    {
        id: 1,
        image: null,
        title: 'hercomfort! Your Personal\nPeriod Tracker',
        description: "Take control of your health with hercomfort. Track\nyour period, monitor ovulation, and gain\ninsights into your body's natural rhythms."
    },
    {
        id: 2,
        image: null,
        title: 'Track and Record with\nEase in One Place',
        description: "Effortlessly log your daily symptoms, moods,\nand activities. Use the intuitive calendar to\nkeep track of your cycle and monitor."
    },
    {
        id: 3,
        image: null,
        title: 'Empower Yourself with\nKnowledge',
        description: "Explore a wealth of articles and tips on\nmenstrual health, lifestyle, and well-being.\nReady to get started?"
    }
];

export default function OnboardingScreen() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [currentPage, setCurrentPage] = useState(0);
    const [showSplash, setShowSplash] = useState(true);

    const scrollViewRef = useRef<ScrollView>(null);
    const spinValue = useRef(new Animated.Value(0)).current;

    // Check onboarding and existing user status
    useEffect(() => {
        // Spin animation for splash loader
        const spinAnim = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        );
        spinAnim.start();

        const checkFlow = async () => {
            try {
                const hasOnboarded = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);

                // Give 1.2s for clean brand presence
                await new Promise((res) => setTimeout(res, 1200));

                if (hasOnboarded === 'true') {
                    // Existing user -> Bypass onboarding completely!
                    if (isAuthenticated) {
                        if (user && user.profileComplete === false) {
                            router.replace('/complete-profile' as any);
                        } else {
                            router.replace('/(tabs)');
                        }
                    } else {
                        router.replace('/login');
                    }
                    return;
                }
            } catch (err) {
                console.warn('[Onboarding] Error checking completion state:', err);
            }

            // First time user -> Show onboarding
            setShowSplash(false);
        };

        if (!isLoading) {
            checkFlow();
        }

        return () => spinAnim.stop();
    }, [isLoading, isAuthenticated, user?.profileComplete]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const handleScroll = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const currentIndex = Math.round(contentOffsetX / width);
        setCurrentPage(currentIndex);
    };

    const handleNext = () => {
        if (currentPage < onboardingData.length - 1) {
            const nextIndex = currentPage + 1;
            scrollViewRef.current?.scrollTo({
                x: nextIndex * width,
                animated: true,
            });
            setCurrentPage(nextIndex);
        } else {
            handleCompleteOnboarding();
        }
    };

    const handleCompleteOnboarding = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        } catch (e) {
            console.warn('[Onboarding] Failed to persist completion flag:', e);
        }

        if (isAuthenticated) {
            if (user && user.profileComplete === false) {
                router.replace('/complete-profile' as any);
            } else {
                router.replace('/(tabs)');
            }
        } else {
            router.replace('/login');
        }
    };

    if (showSplash) {
        return (
            <View style={{ flex: 1, backgroundColor: '#ff5b83', alignItems: 'center', justifyContent: 'center' }}>
                <StatusBar style="light" />

                {/* Actual logo PNG */}
                <Image
                    source={require('../assets/images/android-chrome-512x512.png')}
                    style={{ width: 180, height: 180, resizeMode: 'contain', marginBottom: 28 }}
                />

                {/* Two-tone brand name */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{
                        color: '#ffffff',
                        fontSize: 38,
                        fontWeight: '800',
                        letterSpacing: 0.5,
                    }}>her</Text>
                    <Text style={{
                        color: '#ffe4eb',
                        fontSize: 38,
                        fontWeight: '400',
                        letterSpacing: 0.5,
                    }}>comfort</Text>
                </View>

                {/* Loading Spinner */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        bottom: 80,
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 4,
                        borderColor: 'rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        transform: [{ rotate: spin }]
                    }}
                />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white relative">
            <StatusBar style="dark" />

            {/* Scrollable Content */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                bounces={false}
            >
                {onboardingData.map((item, index) => (
                    <View key={item.id} style={{ width, height }} className="items-center">

                        {/* Pink Top Background Graphic */}
                        <View className="w-full h-[55%] bg-[#ff5b83] items-center justify-end rounded-b-[60px] relative overflow-hidden pb-4">
                            {/* Mocking the phone screen wrapper */}
                            <View className="bg-white rounded-[40px] w-[70%] h-[85%] border-[6px] border-[#1f2937] shadow-lg mb-[-25px] relative overflow-hidden">

                                {/* Fake iPhone Notch */}
                                <View className="absolute top-2 left-1/2 -ml-8 w-16 h-5 bg-black rounded-full z-10" />

                                {/* Phone Screen Mock Content based on step */}
                                <View className="flex-1 p-4 pt-10 bg-[#fefcfd] items-center">
                                    {index === 0 && (
                                        <View className="items-center w-full">
                                            <Text className="font-bold text-gray-800 text-sm">hercomfort</Text>
                                            <View className="mt-8 border-[8px] border-gray-100 rounded-full p-4 w-40 h-40 items-center justify-center relative">
                                                <View className="absolute w-full h-full border-[8px] border-[#fbbf24] rounded-full" style={{ borderTopColor: '#ff5b83', borderRightColor: '#ff5b83', borderLeftColor: 'transparent', transform: [{ rotate: '-45deg' }] }} />
                                                <Text className="text-gray-400 text-[10px] mt-2">Period</Text>
                                                <Text className="text-3xl font-extrabold text-gray-800">4th <Text className="text-[10px] font-medium text-gray-500">days</Text></Text>
                                            </View>
                                        </View>
                                    )}
                                    {index === 1 && (
                                        <View className="items-center w-full">
                                            <Text className="font-bold text-gray-800 text-sm">Tracker</Text>
                                            <View className="w-full flex-row justify-between bg-gray-100 p-1 rounded-full mt-4">
                                                <View className="bg-[#ff5b83] flex-1 py-1 rounded-full items-center"><Text className="text-white text-[10px] font-bold">Log Count</Text></View>
                                                <View className="flex-1 py-1 rounded-full items-center"><Text className="text-gray-500 text-[10px] font-bold">Health</Text></View>
                                            </View>
                                            <View className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-3 mt-4">
                                                <Text className="text-[10px] font-bold text-gray-800 mb-2">My Cycles</Text>
                                                <View className="flex-row">
                                                    <View className="mr-3">
                                                        <Text className="font-bold text-xs">4 days</Text>
                                                        <Text className="text-[8px] text-gray-400">Average period</Text>
                                                    </View>
                                                    <View>
                                                        <Text className="font-bold text-xs">28 days</Text>
                                                        <Text className="text-[8px] text-gray-400">Average cycle</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                    {index === 2 && (
                                        <View className="items-center w-full">
                                            <Text className="font-bold text-gray-800 text-sm">Articles</Text>
                                            <View className="w-full mt-4">
                                                <Text className="font-bold text-[10px] text-gray-800 mb-2">Period & Menstruation</Text>
                                                <View className="bg-white p-2 rounded-xl border border-gray-100 mb-2 shadow-sm flex-row items-center justify-between">
                                                    <Text className="text-[8px] text-gray-600 w-2/3">Understanding Your Menstrual Cycle</Text>
                                                    <View className="h-4 w-4 bg-red-100 rounded-full" />
                                                </View>
                                                <View className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex-row items-center justify-between">
                                                    <Text className="text-[8px] text-gray-600 w-2/3">Coping with PMS: Tips and Tricks</Text>
                                                    <View className="h-4 w-4 bg-yellow-100 rounded-full" />
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Bottom Content Area */}
                        <View className="w-full px-10 pt-10 bg-white items-center">
                            <Text className="text-[22px] font-extrabold text-[#1f2937] text-center mb-4 leading-8">
                                {item.title}
                            </Text>
                            <Text className="text-gray-400 text-center text-[13px] leading-6 px-2">
                                {item.description}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Pagination & Controls Footer */}
            <View className="absolute bottom-0 w-full px-8 pb-12 bg-white">

                {/* Pagination Dots */}
                <View className="flex-row justify-center space-x-2 mb-8 gap-2">
                    {onboardingData.map((_, index) => (
                        <View
                            key={index}
                            className={`h-2 rounded-full ${currentPage === index ? 'w-6 bg-[#ff5b83]' : 'w-2 bg-[#ffe4eb]'}`}
                        />
                    ))}
                </View>

                {/* Action Buttons */}
                {currentPage === onboardingData.length - 1 ? (
                    <Pressable
                        onPress={handleCompleteOnboarding}
                        className="bg-[#ff5b83] w-full py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]"
                    >
                        <Text className="text-white font-bold text-base">Let's Get Started</Text>
                    </Pressable>
                ) : (
                    <View className="flex-row justify-between space-x-4 gap-4">
                        <Pressable
                            onPress={handleCompleteOnboarding}
                            className="flex-1 bg-[#fff0f4] py-[16px] rounded-xl items-center active:bg-[#ffe4eb]"
                        >
                            <Text className="text-[#ff5b83] font-bold text-base">Skip</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleNext}
                            className="flex-1 bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]"
                        >
                            <Text className="text-white font-bold text-base">Continue</Text>
                        </Pressable>
                    </View>
                )}
            </View>

        </View>
    );
}
