# 🚀 Expo App — Android Development Build Guide

This guide explains how to set up an Expo project, run it locally, create an Android development build using EAS, and run your app with the development client.

---

## 1. Create an Expo Project

If you are starting a new project:

```bash
npx create-expo-app@latest my-app
```

Move into the project:

```bash
cd my-app
```

---

## 2. Install Dependencies

Install all project dependencies:

```bash
npm install
```

---

## 3. Start the Expo Development Server

Run:

```bash
npx expo start
```

You will see options such as:

```text
› Press a │ open Android
› Press i │ open iOS
› Press w │ open web
```

For a normal Expo Go project, you can scan the QR code using Expo Go.

However, if your project uses **native modules** or requires a custom development client, you should use an **Expo Development Build** instead.

---

# 4. Install EAS CLI

EAS CLI is used to build your Expo application in the cloud.

Install it globally:

```bash
npm install -g eas-cli
```

Check that it was installed:

```bash
eas --version
```

---

# 5. Login to Expo

Login to your Expo account:

```bash
eas login
```

Follow the instructions shown in the terminal.

You can verify your account with:

```bash
eas whoami
```

---

# 6. Configure EAS

Inside your Expo project, run:

```bash
eas build:configure
```

This creates an `eas.json` file.

A typical configuration in `eas.json` looks like:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://hercomfort-jet.vercel.app",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "295403776708-hfp3crgf487hto886nuu4pl7r7od6c7e.apps.googleusercontent.com"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://hercomfort-jet.vercel.app",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "295403776708-hfp3crgf487hto886nuu4pl7r7od6c7e.apps.googleusercontent.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://hercomfort-jet.vercel.app",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "295403776708-hfp3crgf487hto886nuu4pl7r7od6c7e.apps.googleusercontent.com"
      }
    }
  }
}
```

### What these profiles mean

| Profile | Output | Requires Dev Server? | Use Case |
| :--- | :--- | :--- | :--- |
| **`preview`** | Standalone `.apk` | **NO** (Runs independently) | Install directly on any Android phone to test the real app & API |
| **`development`** | Dev Client `.apk` | **YES** (`npx expo start --dev-client`) | Active code editing with hot-reloading |
| **`production`** | `.apk` or `.aab` | **NO** | Final release for distribution |

---

# 7. WORKFLOW 1: Standalone Installable APK (No Dev Server Needed)

Use this when you want an **installable `.apk` file** to put on a phone, share with testers, or use independently. The app will run completely standalone and call the live backend API.

### Option A: Build via EAS Cloud (Recommended)

```bash
eas build --platform android --profile preview
```

* **What it does**:
  1. Compiles the full JavaScript bundle and assets directly into the APK.
  2. Embeds `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` into the binary.
  3. Generates a download link & QR code for the standalone `.apk`.
  4. **No development server needed** — open the app and use it directly.

### Option B: Build Standalone Release APK Locally (Offline)

If you have Android Studio / Android SDK set up locally:

```bash
cd android
./gradlew assembleRelease
```
Output location:
`android/app/build/outputs/apk/release/app-release.apk`

### Installing the APK:
* Download directly onto your Android device from the EAS link/QR code.
* Or install via USB using ADB:
  ```bash
  adb install path/to/app.apk
  ```

---

# 8. WORKFLOW 2: Development & Expo Run (For Active Coding)

Use this when you are **writing code** and want hot-reloading and instant live updates.

### Option A: Run Directly on Connected Device / Emulator (`expo run`)

To compile and launch the development app directly on your USB-connected Android phone or emulator:

```bash
npx expo run:android
```

### Option B: Build Development Client via EAS Cloud

```bash
eas build --profile development --platform android
```

### Starting the Development Server:

Once your development build is installed on your phone:

```bash
npx expo start --dev-client
```

* Connect your phone to the same Wi-Fi network as your computer.
* Any edits in `app/` or `components/` update immediately on the phone without rebuilding the APK.

### Standard Expo Start (Expo Go):

```bash
npx expo start
```
*(Note: Expo Go does not support custom native modules such as Bluetooth Classic).*

---

# 9. Quick Comparison of Commands

| Goal | Command | Dev Server Required? |
| :--- | :--- | :--- |
| **Installable standalone APK (EAS)** | `eas build --platform android --profile preview` | **NO** (Runs independently) |
| **Installable standalone APK (Local)** | `cd android && ./gradlew assembleRelease` | **NO** (Runs independently) |
| **Run locally on connected device** | `npx expo run:android` | **YES** (Starts Metro dev server) |
| **Build Dev Client (EAS)** | `eas build --profile development --platform android` | **YES** (`npx expo start --dev-client`) |
| **Start Dev Server for Dev Client** | `npx expo start --dev-client` | **YES** |


---

# 10. Making Changes to Your App

After you have installed the development build, you can normally make JavaScript/TypeScript changes without creating another Android build.

For example:

```text
app/
 ├── index.tsx
 ├── login.tsx
 └── profile.tsx
```

Edit your files and run:

```bash
npx expo start --dev-client
```

Your changes can be loaded through the development server.

---

# 11. When Do You Need to Build Again?

You **do not need to run EAS Build after every code change**.

### Usually NO new build is required

For changes such as:

* UI
* Text
* Colors
* Images
* React components
* JavaScript/TypeScript logic
* API calls
* Navigation
* Styling

You can simply run:

```bash
npx expo start --dev-client
```

and continue developing.

### A new development build IS usually required

If you change something that affects the native Android application, for example:

* Installing a new native package
* Removing a native package
* Changing native Android configuration
* Changing permissions
* Changing plugins in `app.json` / `app.config.js`
* Changing native code
* Changing some Expo SDK/native dependencies
* Adding Bluetooth/native functionality

Then rebuild:

```bash
eas build --profile development --platform android
```

---

# 12. Local Android Build (Offline / On Your Machine)

You can also build the Android application locally if you have Android Studio and the Android development environment configured.

### Run Local Development Build:

```bash
npx expo run:android
```

### Build Standalone Release APK Locally (No Dev Server):

```bash
cd android
./gradlew assembleRelease
```
The generated APK will be in:
`android/app/build/outputs/apk/release/app-release.apk`


This will:

1. Generate/update the native Android project.
2. Build the Android application locally.
3. Install it on a connected Android device or emulator.
4. Launch the application.

You may need to have an Android emulator running or an Android phone connected.

---

# 13. Recommended Development Workflow

Once your development build is already installed, your normal workflow should be:

```bash
# Start development server
npx expo start --dev-client
```

Then:

```text
Edit code
   ↓
Save
   ↓
Expo updates the app
   ↓
Test changes
   ↓
Repeat
```

You **don't need to rebuild with EAS every time you save code**.

---

# 15. Complete First-Time Setup

For a brand-new project, the overall process is:

```bash
# 1. Create project
npx create-expo-app@latest my-app

# 2. Enter project
cd my-app

# 3. Install dependencies
npm install

# 4. Install EAS CLI
npm install -g eas-cli

# 5. Login
eas login

# 6. Configure EAS
eas build:configure

# 7. Create Android development build
eas build --profile development --platform android

# 8. Install the generated APK

# 9. Start development server
npx expo start --dev-client
```

---

# 16. Daily Development Workflow

After the first development build has been installed, you generally only need:

```bash
npx expo start --dev-client
```

Then develop normally.

If you make a native change:

```bash
eas build --profile development --platform android
```

Install the new build and continue development.

---

# 17. Production Build

When the application is finished and you want to create a production Android build:

```bash
eas build --platform android --profile production
```

For Google Play Store distribution, you will generally use an **AAB** production build rather than an APK.

---

# 18. Quick Command Reference

| Purpose                   | Command                                              |
| ------------------------- | ---------------------------------------------------- |
| Install dependencies      | `npm install`                                        |
| Start Expo                | `npx expo start`                                     |
| Start development client  | `npx expo start --dev-client`                        |
| Install EAS CLI           | `npm install -g eas-cli`                             |
| Login to Expo             | `eas login`                                          |
| Check Expo account        | `eas whoami`                                         |
| Configure EAS             | `eas build:configure`                                |
| Android development build | `eas build --profile development --platform android` |
| Local Android build       | `npx expo run:android`                               |
| Android production build  | `eas build --platform android --profile production`  |

---

# ⭐ Most Important Thing to Remember

If you have **already created and installed your development build**, you normally **do not need to build it again for ordinary code changes**.

Use:

```bash
npx expo start --dev-client
```

for regular development.

Use:

```bash
eas build --profile development --platform android
```

when you make changes that require a new native Android build.

### Simple rule:

```text
UI / JS / TS changes
        ↓
npx expo start --dev-client
        ↓
No EAS build needed


Native changes
        ↓
eas build --profile development --platform android
        ↓
Install new build
        ↓
npx expo start --dev-client
```
