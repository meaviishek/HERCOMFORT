import { View, Text, TextInput, Pressable, Dimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <StatusBar style="dark" />

            {/* Header Graphics */}
            <View className="absolute top-0 right-0 overflow-hidden w-40 h-40">
                <View
                    className="absolute rounded-full bg-[#ff9db4] opacity-50"
                    style={{ width: width * 0.25, height: width * 0.25, top: width * 0.05, right: width * 0.05 }}
                />
                <View
                    className="absolute rounded-full bg-[#ff9db4] opacity-40"
                    style={{ width: width * 0.15, height: width * 0.15, top: width * 0.18, right: -width * 0.02 }}
                />
            </View>

            {/* Back Button */}
            <Pressable
                onPress={() => router.back()}
                className="absolute top-14 left-6 z-10 p-2"
            >
                <Ionicons name="arrow-back" size={24} color="#ff5b83" />
            </Pressable>

            {/* Main Content */}
            <View className="flex-1 px-8 pt-[35%] pb-10">
                <View className="items-center mb-8">
                    <Text className="text-3xl font-bold text-[#ff5b83] mb-2">Register</Text>
                    <Text className="text-gray-400 text-base">Create your new account</Text>
                </View>

                {/* Form Inputs */}
                <View className="space-y-5">
                    {/* Full Name Input */}
                    <View>
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="person-outline" size={16} color="#9ca3af" />
                            <Text className="text-gray-500 font-medium ml-2 text-sm">Full name</Text>
                        </View>
                        <TextInput
                            className="border-b border-gray-200 py-2 text-base text-gray-800 focus:border-[#ff5b83]"
                            placeholder="ex: Jane Doe"
                            placeholderTextColor="#d1d5db"
                        />
                    </View>

                    {/* Email Input */}
                    <View className="mt-5">
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
                    <View className="mt-5">
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
                </View>

                {/* Sign Up Button */}
                <View className="mt-10 mb-6">
                    <Pressable className="bg-[#ff5b83] py-[16px] rounded-xl items-center shadow-sm active:bg-[#e04f73]">
                        <Text className="text-white font-bold text-lg">Sign Up</Text>
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
                    <Text className="text-gray-400 text-sm">Already have an account? </Text>
                    <Link href="/login" asChild>
                        <Pressable>
                            <Text className="text-[#ff5b83] text-sm font-bold">Sign In</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </View>
    );
}
