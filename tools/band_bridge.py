#!/usr/bin/env python3
"""
tools/band_bridge.py

Live BLE-to-Backend Bridge for Her Comfort Band.
Connects directly to the ESP32 band via Bluetooth LE on your PC/laptop,
authenticates with the backend, and relays real incoming telemetry packets
directly into MongoDB via POST http://127.0.0.1:5000/api/readings/batch.

This allows the Web App / Dashboard to display live sensor graphs and run
complete therapy sessions without needing to compile a mobile Android APK.
"""

import sys
import os
import time
import json
import base64
import asyncio
import urllib.request
import urllib.error
from datetime import datetime, timezone

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("[ERROR] 'bleak' is required. Install via: pip install bleak")
    sys.exit(1)

TARGET_MAC = "B4:3A:45:8A:2C:E6"
DEFAULT_SERVICE_UUID = "12345678-1234-1234-1234-123456789000"
DEFAULT_CHAR_UUID    = "12345678-1234-1234-1234-123456789001"
BACKEND_BASE         = "http://127.0.0.1:5000"
BATCH_URL            = f"{BACKEND_BASE}/api/readings/batch"
LOGIN_URL            = f"{BACKEND_BASE}/api/auth/login"
DEVICE_KEYWORDS      = ["HER", "COMFORT", "ESP32", "NARI", "BAND"]

DEFAULT_EMAIL        = "test@hercomfort.com"
DEFAULT_PASSWORD     = "password123"

class BandBridge:
    def __init__(self, target_address=TARGET_MAC, service_uuid=DEFAULT_SERVICE_UUID, char_uuid=DEFAULT_CHAR_UUID):
        self.target_address = target_address
        self.service_uuid = service_uuid.lower()
        self.char_uuid = char_uuid.lower()
        self.batch_url = BATCH_URL
        self.login_url = LOGIN_URL
        self.token = None
        self.packet_count = 0
        self.buffer = []
        self.last_flush = time.time()
        self.is_running = True

    def authenticate(self):
        """Obtain JWT access token from backend for authenticated telemetry ingestion."""
        try:
            payload = json.dumps({
                "email": DEFAULT_EMAIL,
                "password": DEFAULT_PASSWORD,
            }).encode("utf-8")
            req = urllib.request.Request(
                self.login_url,
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.token = data.get("accessToken")
                if self.token:
                    print(f"[+] Backend authenticated as {DEFAULT_EMAIL} (Token acquired)")
                    return True
        except Exception as e:
            print(f"[-] Authentication notice: {e}. (Will retry)")
        return False

    def decode_payload(self, raw_data: bytearray):
        raw_str = ""
        try:
            raw_str = raw_data.decode("utf-8").strip()
        except UnicodeDecodeError:
            raw_str = str(raw_data)

        parsed = {}
        try:
            decoded_bytes = base64.b64decode(raw_str)
            candidate = decoded_bytes.decode("utf-8").strip()
            fb, lb = candidate.find("{"), candidate.rfind("}")
            if fb != -1 and lb > fb:
                candidate = candidate[fb:lb+1]
            parsed = json.loads(candidate)
        except Exception:
            try:
                fb, lb = raw_str.find("{"), raw_str.rfind("}")
                if fb != -1 and lb > fb:
                    parsed = json.loads(raw_str[fb:lb+1])
            except Exception:
                pass
        return parsed

    def post_readings(self, readings):
        if not readings:
            return False

        if not self.token:
            self.authenticate()

        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        payload = json.dumps({"readings": readings}).encode("utf-8")
        req = urllib.request.Request(self.batch_url, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return resp.status in (200, 201)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                # Token expired, re-auth
                self.authenticate()
            return False
        except Exception:
            return False

    def notification_handler(self, sender, data: bytearray):
        parsed = self.decode_payload(data)
        if not parsed:
            return

        self.packet_count += 1
        now_ms = int(time.time() * 1000)

        temp = float(parsed.get("temperature", parsed.get("temp", 36.5)))
        emg = float(parsed.get("emg", 0.0))
        emg_env = float(parsed.get("emgEnvelope", emg))
        angle = float(parsed.get("bodyAngle", 0.0))
        motor_mode = str(parsed.get("motorMode", "OFF")).upper()
        motor_speed = int(parsed.get("motorSpeed", 0))
        heater_str = str(parsed.get("heater", "OFF")).upper()
        heater_state = heater_str == "ON" or parsed.get("heater") is True
        heater_setpt = float(parsed.get("heaterSetpoint", 40.0))
        position = str(parsed.get("position", "UNKNOWN"))

        reading = {
            "deviceId": "HER-COMFORT-BAND",
            "temp": temp,
            "emg": emg,
            "emgEnvelope": emg_env,
            "bodyAngle": angle,
            "position": position,
            "motorMode": motor_mode,
            "motorSpeed": motor_speed,
            "heaterState": "ON" if heater_state else "OFF",
            "heater": 1 if heater_state else 0,
            "motorState": motor_mode if motor_mode != "OFF" else "OFF",
            "heaterSetpoint": heater_setpt,
            "espTimestamp": now_ms,
            "timestamp": now_ms,
        }

        self.buffer.append(reading)

        # Flush every 1.0 second or 4 readings
        if len(self.buffer) >= 4 or (time.time() - self.last_flush) >= 1.0:
            to_send = list(self.buffer)
            self.buffer.clear()
            self.last_flush = time.time()
            ok = self.post_readings(to_send)
            status_str = "RELAYED TO BACKEND [201]" if ok else "BUFFERED"
            print(f"\r[Pkt #{self.packet_count:04d}] EMG: {emg_env:5.1f} | Temp: {temp:4.1f}C | Posture: {position:<8} | Motor: {motor_mode:<10} -> {status_str}  ", end="", flush=True)

    async def scan_for_band(self, max_attempts=15):
        for attempt in range(1, max_attempts + 1):
            print(f"[*] Scanning for Her Comfort band (attempt {attempt}/{max_attempts})...")
            try:
                discovered = await BleakScanner.discover(timeout=4.0, return_adv=True)
            except Exception as e:
                print(f"    [-] Scan error: {e}")
                await asyncio.sleep(1.0)
                continue

            for address, (d, adv) in discovered.items():
                name = (adv.local_name or d.name or "").upper()
                services = [s.lower() for s in (adv.service_uuids or [])]
                
                # Check MAC match, Service UUID match, or Name match
                if (
                    address.upper() == self.target_address.upper() or
                    self.service_uuid in services or
                    any(k in name for k in DEVICE_KEYWORDS)
                ):
                    print(f"\n[+] Found band! Address: {address} | RSSI: {adv.rssi} dBm")
                    return d

            if attempt == 2:
                print("    [!] Tip: If the band is not showing up, tap the RST/EN button or toggle power switch on the band.")
            await asyncio.sleep(1.0)
        return None

    async def run(self):
        print("\n" + "="*70)
        print("  HER COMFORT LIVE BLE-TO-BACKEND RELAY BRIDGE")
        print("="*70)
        print(f" Known Band MAC : {self.target_address}")
        print(f" Service UUID   : {self.service_uuid}")
        print(f" Backend Batch  : {self.batch_url}")
        print("="*70 + "\n")

        self.authenticate()

        while self.is_running:
            device = await self.scan_for_band(max_attempts=12)
            if not device:
                print("\n[-] Could not locate band in scan cycle.")
                print("[*] Please press the RST / EN button on the ESP32 board to restart advertising.")
                print("[*] Retrying in 3 seconds...\n")
                await asyncio.sleep(3.0)
                continue

            print(f"[*] Connecting to {device.address}...")
            try:
                async with BleakClient(device) as client:
                    if not client.is_connected:
                        print("[-] Failed to establish BLE connection. Retrying...")
                        await asyncio.sleep(2.0)
                        continue

                    print(f"[+] Connected to {device.address}!")

                    char_uuid = self.char_uuid
                    notify_candidates = []
                    for service in client.services:
                        for char in service.characteristics:
                            if "notify" in char.properties:
                                notify_candidates.append(char)
                    if notify_candidates and not any(c.uuid.lower() == char_uuid for c in notify_candidates):
                        char_uuid = notify_candidates[0].uuid
                        print(f"[!] Using discovered NOTIFY characteristic: {char_uuid}")

                    await client.start_notify(char_uuid, self.notification_handler)
                    print("[+] Streaming active! Live packets are being forwarded to MongoDB.")
                    print("[*] Web App & Session Dashboard will show live data immediately.")
                    print("[*] Press Ctrl+C to stop bridge.\n")

                    while client.is_connected and self.is_running:
                        await asyncio.sleep(0.5)

                    print("\n[!] Connection lost or disconnected.")
            except Exception as e:
                print(f"\n[-] BLE Client notice: {e}")
                print("[*] Resetting connection in 2 seconds...")
                await asyncio.sleep(2.0)

if __name__ == "__main__":
    bridge = BandBridge()
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\n[*] Bridge stopped.")
