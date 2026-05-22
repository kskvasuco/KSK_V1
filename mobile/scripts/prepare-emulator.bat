@echo off
REM Free space on Android emulator before installing Expo Go
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
echo Trimming caches...
"%ADB%" shell pm trim-caches 999999M
echo Done. If install still fails, wipe the AVD: Android Studio - Device Manager - Wipe Data
