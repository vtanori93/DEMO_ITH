#!/usr/bin/env python3
"""Ejecuta setup/loop reales con Wi-Fi, reloj, NTP, socket y watchdog modelados."""

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import urllib.request


BASE = Path(__file__).resolve().parent
SKETCH = BASE.parent / "PruebaReal1/PruebaReal1.ino"
ARTIFACTS = BASE / "artifacts"
PARSER_HASHES = {
    "http_parser.c": "ce1831c1fd09a06c3a82f107fc292309bca49f5a9c3a870db8f6ea06eae9fd28",
    "http_parser.h": "21fcfe834198349472a878e0334dd74b8571fafc70c6dd701169f525dd463041",
}


def run(command: list[str]) -> str:
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f"Falló {command[0]} ({result.returncode}):\n{result.stdout}")
    return result.stdout


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    cc = shutil.which("clang") or shutil.which("gcc")
    cxx = shutil.which("clang++") or shutil.which("g++")
    if not cc or not cxx:
        raise RuntimeError("Se requiere un compilador C/C++ nativo para ejecutar la simulación.")
    parser = ARTIFACTS / "http-parser-2.7.0"
    parser.mkdir(exist_ok=True)
    for name, expected in PARSER_HASHES.items():
        path = parser / name
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            url = f"https://raw.githubusercontent.com/nodejs/http-parser/v2.7.0/{name}"
            data = urllib.request.urlopen(url, timeout=30).read()
            if hashlib.sha256(data).hexdigest() != expected:
                raise RuntimeError(f"El archivo publicado no coincide con el hash fijado: {name}")
            path.write_bytes(data)
    parser_object = parser / "http_parser.o"
    run([cc, "-std=c99", "-I", str(parser), "-c", str(parser / "http_parser.c"), "-o", str(parser_object)])
    source = SKETCH.read_text()
    results = {
        "sketchSha256": hashlib.sha256(SKETCH.read_bytes()).hexdigest(),
        "type": "Simulación nativa de lógica; no emulación del chip ni prueba física de Wi-Fi/TLS/RTC.",
        "httpParser": "2.7.0, archivos oficiales con SHA-256 fijado",
        "runs": [],
    }
    variants = {"original": SKETCH}
    fixture = ARTIFACTS / "PruebaReal1-three-networks.ino"
    pattern = r'(const WifiNetwork WIFI_NETWORKS\[\] = \{)(.*?)(\n\};)'
    replacement = r'\1\2\n  {"RESPALDO_SIMULADO", "clave-prueba"},\n  {"TERCERA_RED_SIMULADA", "clave-prueba-2"},\3'
    modified, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("No se encontró la lista de redes para el caso de respaldo opcional.")
    fixture.write_text(modified)
    variants["three-networks"] = fixture
    total_frames = 0
    for name, sketch in variants.items():
        binary = ARTIFACTS / f"simulation-{name}"
        messages = ARTIFACTS / f"messages-{name}.jsonl"
        run([cxx, "-std=c++17", "-Wall", "-Wextra", "-Werror", "-I", str(BASE / "stubs"),
             "-I", str(parser), f'-DSKETCH_FILE="{sketch}"', str(BASE / "simulation.cpp"),
             str(parser_object), "-o", str(binary)])
        result = subprocess.run([str(binary), str(messages)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (ARTIFACTS / f"simulation-{name}.log").write_text(result.stdout)
        print(f"\nConfiguración: {name}\n{result.stdout}", end="", flush=True)
        if result.returncode:
            raise RuntimeError(f"La simulación {name} falló ({result.returncode}).")
        frames = []
        for line in messages.read_text().splitlines():
            values = json.loads(line)
            if set(values) != {"temperature", "voltage", "current"}:
                raise RuntimeError("El sketch no produjo los tres canales esperados.")
            for key, lower, upper in [("temperature", -30, 100), ("voltage", 0, 12), ("current", 0, 50)]:
                value = values[key]
                if type(value) not in (int, float) or not lower <= value <= upper:
                    raise RuntimeError(f"Valor de prueba fuera del contrato: {values}")
            frames.append(values)
        if not frames or not any(value["temperature"] % 1 for value in frames):
            raise RuntimeError("No se generaron lecturas con fracciones para validar el formato.")
        total_frames += len(frames)
        results["runs"].append({"configuration": name, "passed": result.stdout.count("PASS | "),
                                "framesValidated": len(frames), "log": f"simulation-{name}.log"})
    (ARTIFACTS / "simulation-results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
    print(f"\nCorrecto: {total_frames} mensajes JSON, rangos y fracciones verificados.")
    print(f"Informe: {ARTIFACTS / 'simulation-results.json'}")


if __name__ == "__main__":
    main()
