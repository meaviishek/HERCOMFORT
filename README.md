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

A typical configuration looks like:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### What these profiles mean

#### `development`

Used while actively developing the application.

```json
"development": {
  "developmentClient": true,
  "distribution": "internal"
}
```


eas build --platform android --profile preview
eas build --profile development --platform android
eas build --platform android

This creates a **Development Build** that works with:

```bash
npx expo start --dev-client
```

#### `preview`

Used for testing a release-like version internally.

#### `production`

Used for the final production build that you intend to distribute to users.

---

# 7. Build the Android Development App

Run:

```bash
eas build --profile development --platform android
```

EAS will:

1. Upload your project.
2. Install dependencies.
3. Build the Android application.
4. Generate an APK/AAB depending on the configuration.
5. Provide a link to the completed build.

The first build can take some time.

---

# 8. Install the Development Build

Once the EAS build finishes, download the generated Android development build.

Install the APK on your Android phone.

You can also install it using ADB:

```bash
adb install path/to/app.apk
```

Make sure USB debugging is enabled if you're using a physical Android device.

---

# 9. Start the Development Server

After installing the development build, run:

```bash
npx expo start --dev-client
```

This starts Expo specifically for your **development build**.

You can then open the application on your Android device.

---

# 10. Important: Development Build vs Expo Go

There are two different workflows.

### Expo Go

```bash
npx expo start
```

Expo Go is a prebuilt app provided by Expo.

It supports many Expo features but does **not** contain every native module your project may need.

### Development Build

```bash
npx expo start --dev-client
```

A development build is your own customized version of the Expo app.

It contains the native modules configured for your project.

For projects using things such as Bluetooth, custom native libraries, or other native functionality, a development build is often the better choice.

---

# 11. Making Changes to Your App

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

# 12. When Do You Need to Build Again?

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

# 13. Local Android Build

You can also build the Android application locally if you have Android Studio and the Android development environment configured.

Run:

```bash
npx expo run:android
```

This will:

1. Generate/update the native Android project.
2. Build the Android application locally.
3. Install it on a connected Android device or emulator.
4. Launch the application.

You may need to have an Android emulator running or an Android phone connected.

---

# 14. Recommended Development Workflow

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
