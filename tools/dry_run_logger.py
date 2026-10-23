#!/usr/bin/env python3
"""
tools/dry_run_logger.py

Standalone BLE telemetry logger and real-time labeling tool for Her Comfort band dry-runs.
Connects directly to the ESP32 band via BLE using the bleak library, receives GATT notifications,
and logs every packet to a timestamped CSV file alongside real-time operator labels.

Label Keybinds (press during session):
  [R] - REST (Baseline resting state)
  [L] - LIGHT_TENSION (Simulated mild contraction/tightness)
  [S] - STRONG_TENSION (Simulated high tension/cramp)
  [W] - WALK (Kinematic walking motion)
  [P] - PULSE_MOTOR_ON (Vibration motor active: Pulse mode)
  [H] - HARMONIC_MOTOR_ON (Vibration motor active: Harmonic mode)
  [X] - UNLABELED (Transition / calibration)
  [Q] - Quit session and finalize CSV

Usage:
  python tools/dry_run_logger.py --participant D01 --run 1
  python tools/dry_run_logger.py --participant D01 --run 2 --address "XX:XX:XX:XX:XX:XX"
"""

import sys
import os
import time
import datetime
import argparse
import asyncio
import base64
import json
import csv

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    print("[ERROR] 'bleak' is required. Install via: pip install bleak")
    sys.exit(1)

# Platform-specific non-blocking keyboard reading
if os.name == 'nt':
    import msvcrt
    def check_key():
        if msvcrt.kbhit():
            ch = msvcrt.getch()
            try:
                return ch.decode('utf-8').upper()
            except UnicodeDecodeError:
                return None
        return None
else:
    import select
    def check_key():
        dr, _, _ = select.select([sys.stdin], [], [], 0)
        if dr:
            return sys.stdin.read(1).upper()
        return None

# ==============================================================================
# CONFIGURATION CONSTANTS (Update if firmware GATT definitions change)
# ==============================================================================
DEFAULT_SERVICE_UUID = "12345678-1234-1234-1234-123456789000"
DEFAULT_CHAR_UUID    = "12345678-1234-1234-1234-123456789001"
DEVICE_NAME_KEYWORDS = ["HER COMFORT", "HERCOMFORT", "HER_COMFORT", "ESP32"]

# Label Mapping
KEY_LABEL_MAP = {
    'R': 'REST',
    'L': 'LIGHT_TENSION',
    'S': 'STRONG_TENSION',
    'W': 'WALK',
    'P': 'PULSE_MOTOR_ON',
    'H': 'HARMONIC_MOTOR_ON',
    'X': 'UNLABELED',
}

# CSV Fieldnames
CSV_FIELDS = [
    'participant_id',
    'run_id',
    'current_label',
    'laptop_timestamp_iso',
    'laptop_timestamp_ms',
    'esp_timestamp',
    'emg_envelope',
    'emg_raw',
    'temperature',
    'heater_state',
    'heater_setpoint',
    'motor_state',
    'motor_mode',
    'motor_speed',
    'position',
    'body_angle',
    'raw_packet_json'
]


class DryRunLogger:
    def __init__(self, participant_id, run_id, service_uuid, char_uuid, output_dir="tools/data"):
        self.participant_id = participant_id
        self.run_id = run_id
        self.service_uuid = service_uuid
        self.char_uuid = char_uuid
        self.output_dir = output_dir

        self.current_label = 'UNLABELED'
        self.packet_count = 0
        self.is_running = True
        self.csv_file = None
        self.csv_writer = None
        self.filepath = None

    def initialize_csv(self):
        os.makedirs(self.output_dir, exist_ok=True)
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dry_run_{self.participant_id}_run{self.run_id}_{timestamp_str}.csv"
        self.filepath = os.path.join(self.output_dir, filename)

        self.csv_file = open(self.filepath, mode='w', newline='', encoding='utf-8')
        self.csv_writer = csv.DictWriter(self.csv_file, fieldnames=CSV_FIELDS)
        self.csv_writer.writeheader()
        self.csv_file.flush()
        print(f"[*] Logging output initialized: {self.filepath}")

    def decode_payload(self, raw_data: bytearray) -> dict:
        """Decode incoming packet (handles Base64-wrapped JSON or UTF-8 JSON)."""
        raw_str = ""
        try:
            raw_str = raw_data.decode('utf-8').strip()
        except UnicodeDecodeError:
            raw_str = str(raw_data)

        parsed = {}
        # Try base64 decode first
        try:
            decoded_bytes = base64.b64decode(raw_str)
            candidate = decoded_bytes.decode('utf-8').strip()
            first_brace = candidate.find('{')
            last_brace = candidate.rfind('}')
            if first_brace != -1 and last_brace > first_brace:
                candidate = candidate[first_brace:last_brace + 1]
            parsed = json.loads(candidate)
        except Exception:
            # Fallback to direct JSON
            try:
                first_brace = raw_str.find('{')
                last_brace = raw_str.rfind('}')
                if first_brace != -1 and last_brace > first_brace:
                    parsed = json.loads(raw_str[first_brace:last_brace + 1])
            except Exception:
                pass

        return parsed, raw_str

    def notification_handler(self, sender, data: bytearray):
        """Callback for incoming BLE GATT notifications."""
        now = datetime.datetime.now(datetime.timezone.utc)
        laptop_iso = now.isoformat()
        laptop_ms = int(now.timestamp() * 1000)

        parsed, raw_str = self.decode_payload(data)
        self.packet_count += 1

        # Extract normalized fields
        esp_ts = parsed.get('espTimestamp') or parsed.get('timestamp') or 0
        emg_env = parsed.get('emgEnvelope') or parsed.get('emg_envelope') or parsed.get('emg') or 0.0
        emg_raw = parsed.get('emg') or parsed.get('raw_analog') or 0.0
        temp = parsed.get('temp') or parsed.get('temperature') or 0.0

        # Heater extraction
        heater_val = parsed.get('heater', False)
        if isinstance(heater_val, str):
            heater_state = heater_val.upper() == 'ON'
        else:
            heater_state = bool(heater_val)

        # Motor extraction
        motor_mode = str(parsed.get('motorMode', 'OFF')).upper()
        motor_state = motor_mode != 'OFF' or bool(parsed.get('motor', False))
        motor_speed = parsed.get('motorSpeed', 0)

        row = {
            'participant_id': self.participant_id,
            'run_id': self.run_id,
            'current_label': self.current_label,
            'laptop_timestamp_iso': laptop_iso,
            'laptop_timestamp_ms': laptop_ms,
            'esp_timestamp': esp_ts,
            'emg_envelope': emg_env,
            'emg_raw': emg_raw,
            'temperature': temp,
            'heater_state': heater_state,
            'heater_setpoint': parsed.get('heaterSetpoint', 40.0),
            'motor_state': motor_state,
            'motor_mode': motor_mode,
            'motor_speed': motor_speed,
            'position': parsed.get('position', 'UNKNOWN'),
            'body_angle': parsed.get('bodyAngle', 0.0),
            'raw_packet_json': json.dumps(parsed) if parsed else raw_str,
        }

        if self.csv_writer and self.csv_file:
            self.csv_writer.writerow(row)
            self.csv_file.flush()

        # Terminal status output
        print(f"\r[Pkt #{self.packet_count:04d}] Label: [{self.current_label:<15}] | EMG Env: {emg_env:5.1f} | Temp: {temp:4.1f}C | Motor: {motor_mode:<10} | Heat: {'ON ' if heater_state else 'OFF'}", end="", flush=True)

    async def run(self, target_address=None):
        self.initialize_csv()

        print("\n" + "="*70)
        print(" HER COMFORT DRY-RUN TELEMETRY LOGGER & ANNOTATOR")
        print("="*70)
        print(f" Participant ID : {self.participant_id}")
        print(f" Run ID         : {self.run_id}")
        print(f" Service UUID   : {self.service_uuid}")
        print(f" Char UUID      : {self.char_uuid}")
        print(f" Output File    : {self.filepath}")
        print("-" * 70)
        print(" Label Hotkeys:")
        print("   [R] REST               [L] LIGHT_TENSION     [S] STRONG_TENSION")
        print("   [W] WALK               [P] PULSE_MOTOR_ON    [H] HARMONIC_MOTOR_ON")
        print("   [X] UNLABELED          [Q] QUIT / STOP")
        print("="*70 + "\n")

        device = None
        if target_address:
            print(f"[*] Targeting specified BLE address: {target_address}")
            device = await BleakScanner.find_device_by_address(target_address, timeout=10.0)
        else:
            print("[*] Scanning for Her Comfort / ESP32 device...")
            devices = await BleakScanner.discover(timeout=7.0)
            for d in devices:
                d_name = (d.name or "").upper()
                if any(k in d_name for k in DEVICE_NAME_KEYWORDS):
                    device = d
                    print(f"[+] Found candidate band: {d.name} ({d.address})")
                    break

        if not device:
            print("[-] No compatible Her Comfort device found. Check device power and advertising.")
            return

        print(f"[*] Connecting to {device.address}...")
        async with BleakClient(device) as client:
            connected = client.is_connected
            if not connected:
                print("[-] Failed to establish BLE connection.")
                return

            print(f"[+] Connected successfully to {device.address}!")
            print(f"[*] Subscribing to telemetry notifications on {self.char_uuid}...")

            await client.start_notify(self.char_uuid, self.notification_handler)
            print("[+] Subscribed! Logging active. Press label keys at any time.\n")

            try:
                while self.is_running and client.is_connected:
                    key = check_key()
                    if key:
                        if key == 'Q':
                            print("\n\n[*] Operator pressed [Q]. Stopping logger...")
                            self.is_running = False
                            break
                        elif key in KEY_LABEL_MAP:
                            self.current_label = KEY_LABEL_MAP[key]
                            print(f"\n--> LABEL UPDATED TO: [{self.current_label}]")
                    await asyncio.sleep(0.05)
            except asyncio.CancelledError:
                pass
            finally:
                try:
                    await client.stop_notify(self.char_uuid)
                except Exception:
                    pass

        if self.csv_file:
            self.csv_file.close()
        print(f"\n[+] Session complete. Logged {self.packet_count} packets to:\n    {self.filepath}")


def main():
    parser = argparse.ArgumentParser(description="Her Comfort Dry-Run Telemetry Logger")
    parser.add_argument("--participant", default="D01", help="Participant ID (e.g. D01, D02). Default: D01")
    parser.add_argument("--run", type=int, default=1, help="Run sequence number (1, 2, ...). Default: 1")
    parser.add_argument("--address", default=None, help="Specific BLE MAC or UUID (optional)")
    parser.add_argument("--service", default=DEFAULT_SERVICE_UUID, help=f"GATT Service UUID (default: {DEFAULT_SERVICE_UUID})")
    parser.add_argument("--char", default=DEFAULT_CHAR_UUID, help=f"GATT Characteristic UUID (default: {DEFAULT_CHAR_UUID})")
    parser.add_argument("--outdir", default="tools/data", help="Output directory for CSV files (default: tools/data)")

    args = parser.parse_args()

    # Enforce D-prefix convention for dry run
    participant = args.participant.upper()
    if not participant.startswith('D'):
        print(f"[WARNING] Dry-run participants must have prefix 'D' (e.g. D01). Changing '{participant}' to 'D{participant}'")
        participant = f"D{participant}"

    logger = DryRunLogger(
        participant_id=participant,
        run_id=args.run,
        service_uuid=args.service,
        char_uuid=args.char,
        output_dir=args.outdir
    )

    try:
        asyncio.run(logger.run(target_address=args.address))
    except KeyboardInterrupt:
        print("\n[*] Interrupted by user.")
        if logger.csv_file:
            logger.csv_file.close()


if __name__ == '__main__':
    main()
