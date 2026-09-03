import { View, Text, TextInput, Pressable, Dimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="dark" />

            {/* Header Graphic Area */}
            <View className="h-[38%] relative bg-white overflow-hidden">
                {/* We use a large rounded rect shifted up to create the curve effect */}
                <View
                    className="absolute bg-[#ff9db4] w-[150%] h-full rounded-b-[150px]"
                    style={{ left: '-25%', top: 0 }}
                >
                    {/* Decorative Circles inside the header */}
                    <View
                        className="absolute rounded-full bg-[#ff7b9a] opacity-50"
                        style={{ width: width * 0.7, height: width * 0.7, top: -height * 0.05, right: -width * 0.2 }}
                    />
                    <View
                        className="absolute rounded-full bg-[#ff7b9a] opacity-50"
                        style={{ width: width * 0.6, height: width * 0.6, top: height * 0.15, left: -width * 0.1 }}
                    />
                </View>

                {/* Back Button */}
                <Pressable
                    onPress={() => router.back()}
                    className="absolute top-14 left-6 w-10 h-10 bg-white/50 rounded-full items-center justify-center z-10"
                >
                    <Ionicons name="arrow-back" size={24} color="#ff5b83" />
                </Pressable>
            </View>

            {/* Main Content */}
            <View className="flex-1 px-8 pt-8 pb-10">
                <View className="items-center mb-8">
                    <Text className="text-3xl font-bold text-[#ff5b83] mb-2">Welcome back</Text>
                    <Text className="text-gray-400 text-base">Login to your account</Text>
                </View>

                {/* Form Inputs */}
                <View className="space-y-6">
                    {/* Email Input */}
                    <View>
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="mail-outline" size={16} color="#9ca3af" />
                            <Text className="text-gray-500 font-medium ml-2 text-sm">E-mail</Text>
                        </View>
                        <TextInput
                            className="border-b border-gray-200 py-2 text-base text-gray-800 focus:border-[#ff5b83]"
                            placeholder="ex: hello@elia.com"
                            placeholderTextColor="#d1d5db"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password Input */}
                    <View className="mt-6">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
                            <Text className="text-gray-500 font-medium ml-2 text-sm">Password</Text>
                        </View>
                        <View className="flex-row items-center border-b border-gray-200 focus:border-[#ff5b83]">
                            <TextInput
                                className="flex-1 py-2 text-base text-gray-800"
                                placeholder="••••••••"
                                placeholderTextColor="#d1d5db"
                                secureTextEntry
                            />
                            <Ionicons name="eye-outline" size={20} color="#9ca3af" className="mr-2" />
                        </View>
                    </View>

                    {/* Remember me & Forgot Password */}
                    <View className="flex-row justify-between items-center mt-6">
                        <Pressable className="flex-row items-center">
                            <View className="w-4 h-4 rounded border border-gray-300 mr-2 items-center justify-center bg-[#ff5b83] border-transparent">
                                <Ionicons name="checkmark" size={12} color="white" />
                            </View>
                            <Text className="text-gray-500 text-sm">Remember me</Text>
                        </Pressable>
                        <Pressable>
                            <Text className="text-[#ff5b83] text-sm font-semibold">Forgot password?</Text>
                        </Pressable>
                    </View>
                </View>

                <View className="mt-8 mb-6">
                    <Pressable className="bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]">
                        <Text className="text-white font-bold text-lg">Sign In</Text>
                    </Pressable>
                </View>

                {/* Social Login Separator */}
                <View className="flex-row items-center mb-6 px-4">
                    <View className="flex-1 h-[1px] bg-gray-200" />
                    <Text className="mx-4 text-gray-400 text-xs text-center">or continue with</Text>
                    <View className="flex-1 h-[1px] bg-gray-200" />
                </View>

                {/* Social Buttons */}
                <View className="items-center mb-8 px-4">
                    <Link href="/(tabs)" asChild>
                        <Pressable className="flex-row items-center justify-center bg-[#f2f2f2] px-8 py-3 rounded-full active:bg-[#e6e6e6]">
                            <FontAwesome name="google" size={22} color="#DB4437" className="mr-3" />
                            <Text className="text-[#1f2937] font-bold text-lg">Sign in with Google</Text>
                        </Pressable>
                    </Link>
                </View>

                <View className="flex-row justify-center mt-auto">
                    <Text className="text-gray-400 text-sm">Don't have account? </Text>
                    <Link href="/register" asChild>
                        <Pressable>
                            <Text className="text-[#ff5b83] text-sm font-bold">Sign Up</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </View>
    );
}
