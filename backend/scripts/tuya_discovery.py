"""
Tuya Device Discovery
Queries your 4 devices and prints every property code + current value.
Share the output so the bridge can be built with correct mappings.

Usage (run from the backend/ folder):
    pip install tuya-connector-python
    python scripts/tuya_discovery.py
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(".env.shared")
load_dotenv(".env")

ACCESS_ID     = os.getenv("TUYA_ACCESS_ID", "")
ACCESS_SECRET = os.getenv("TUYA_ACCESS_SECRET", "")
ENDPOINT      = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaeu.com")

DEVICES = {
    "electricity_sensor" : "bf8cdc51717280dbc2m5mg",
    "irrigation_actuator": "bf2d54577d8ffd6885rukf",
    "climate_sensor"     : "bfccd86ffbd8ec78aboefq",
    "soil_sensor"        : "bfd0da8fd01f2d116es2wa",
}


def main():
    try:
        from tuya_connector import TuyaOpenAPI
    except ImportError:
        print("ERROR: Run this first:  pip install tuya-connector-python")
        sys.exit(1)

    if not ACCESS_ID or not ACCESS_SECRET:
        print("ERROR: TUYA_ACCESS_ID and TUYA_ACCESS_SECRET not found in .env.shared")
        sys.exit(1)

    print(f"Connecting to: {ENDPOINT}")
    print(f"Access ID:     {ACCESS_ID[:8]}...")

    api = TuyaOpenAPI(ENDPOINT, ACCESS_ID, ACCESS_SECRET)
    result = api.connect()

    if not result.get("success"):
        print(f"\nConnection FAILED: {result}")
        print("\nIf you see 'data center' error, try changing TUYA_API_ENDPOINT in .env.shared to:")
        print("  China:  https://openapi.tuyacn.com")
        print("  EU:     https://openapi.tuyaeu.com")
        print("  US:     https://openapi.tuyaus.com")
        sys.exit(1)

    print("Connected!\n")
    print("=" * 60)

    all_results = {}

    for label, device_id in DEVICES.items():
        print(f"\n[ {label.upper()} ]")
        print(f"  Device ID: {device_id}")

        # Device info
        info_resp = api.get(f"/v1.0/devices/{device_id}")
        if info_resp.get("success"):
            info = info_resp.get("result", {})
            print(f"  Name:      {info.get('name', 'N/A')}")
            print(f"  Category:  {info.get('category', 'N/A')}")
            print(f"  Online:    {info.get('online', 'N/A')}")

        # Try every known Tuya API path — different device protocols need different endpoints
        status_resp = None
        attempts = [
            ("v1.0 standard",  f"/v1.0/devices/{device_id}/status"),
            ("v1.0 iot-03",    f"/v1.0/iot-03/devices/{device_id}/status"),
            ("v2.0 shadow",    f"/v2.0/cloud/thing/{device_id}/shadow/properties"),
            ("v1.0 functions", f"/v1.0/devices/{device_id}/functions"),
        ]
        for attempt_label, path in attempts:
            resp = api.get(path)
            if resp.get("success") and resp.get("result"):
                print(f"  API used: {attempt_label} ({path})")
                status_resp = resp
                break
            else:
                print(f"  {attempt_label}: {resp.get('msg', 'failed')}")

        if not status_resp or not status_resp.get("success"):
            print(f"  ERROR: all API paths failed for this device")
            continue

        raw_result = status_resp.get("result", [])
        if isinstance(raw_result, list):
            props = raw_result
        elif isinstance(raw_result, dict):
            if "properties" in raw_result:
                inner = raw_result["properties"]
                props = inner if isinstance(inner, list) else [{"code": k, "value": v} for k, v in inner.items()]
            elif "functions" in raw_result:
                props = raw_result["functions"]
            else:
                props = [{"code": k, "value": v} for k, v in raw_result.items()]
        else:
            props = []
        print(f"  Properties ({len(props)} found):")
        device_props = {}
        for p in props:
            print(f"    {p['code']:<30} = {p['value']}")
            device_props[p["code"]] = p["value"]

        # Also show what commands/functions this device accepts
        func_resp = api.get(f"/v1.0/devices/{device_id}/functions")
        if func_resp.get("success"):
            functions = func_resp.get("result", {}).get("functions", [])
            if functions:
                print(f"  Controllable functions ({len(functions)} found):")
                for f in functions:
                    print(f"    {f.get('code','?'):<30} type={f.get('type','?')}  values={f.get('values','')}")

        all_results[label] = {"device_id": device_id, "properties": device_props}
        print()

    print("=" * 60)
    print("\nFull JSON output (copy and share this):")
    print(json.dumps(all_results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
