import asyncio
from bleak import BleakScanner

SERVICE_UUID = "12345678-1234-1234-1234-123456789000"
KNOWN_MAC    = "B4:3A:45:8A:2C:E6"

async def scan():
    print("Scanning for Her Comfort Band (MAC: B4:3A:45:8A:2C:E6 or Service: 12345678-1234-1234-1234-123456789000)...")
    discovered = await BleakScanner.discover(timeout=5.0, return_adv=True)
    
    found = False
    for address, (device, adv) in discovered.items():
        name = adv.local_name or device.name or "(Unnamed)"
        services = [s.lower() for s in (adv.service_uuids or [])]
        is_match = (
            address.upper() == KNOWN_MAC or
            SERVICE_UUID.lower() in services or
            any(k in name.upper() for k in ["HER", "COMFORT", "ESP32", "NARI", "BAND"])
        )
        if is_match:
            print(f"\n[+] FOUND BAND: '{name}' [{address}] RSSI: {adv.rssi} dBm")
            print(f"    Services: {adv.service_uuids}")
            found = True

    if not found:
        print("\n[-] Band not visible in scan.")
        print("    -> Action needed: Toggle the power switch or press the RESET (EN) button on the band.")

if __name__ == "__main__":
    asyncio.run(scan())
