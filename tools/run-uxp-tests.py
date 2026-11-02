#!/usr/bin/env python3
"""Run every native UXP regression fixture and the XML layout check.

All suites are included by default; no hidden allowlist or exception for
legacy fixtures. A test passes ONLY if its child process exits with code 0
within the timeout. Workloads are isolated in separate child processes.
"""
from pathlib import Path
import argparse
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
TEST_DIRS = (ROOT / "tools", ROOT / "uxp" / "tests")

def discover():
    tests = []
    for folder in TEST_DIRS:
        for extension in ("js", "py"):
            tests.extend(folder.glob(f"test-*.{extension}"))
    return sorted(tests, key=lambda p: str(p.relative_to(ROOT)))

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="List every discovered test without executing it")
    parser.add_argument("--filter", default="", help="Run only paths containing this substring")
    parser.add_argument("--timeout", type=float, default=12.0, help="Per-test timeout in seconds (default: 12)")
    parser.add_argument("--all", action="store_true", help="Deprecated: all tests already run by default")
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    tests = [t for t in discover() if args.filter in str(t.relative_to(ROOT))]
    if not tests:
        print("No tests selected", file=sys.stderr)
        return 2
    if args.list:
        for f in tests: print(f.relative_to(ROOT))
        return 0
    failures = []
    for file in tests:
        rel = file.relative_to(ROOT)
        command = (["node", str(file)] if file.suffix == ".js"
                   else [sys.executable, str(file)])
        t0 = time.monotonic()
        try:
            run = subprocess.run(command, cwd=ROOT, capture_output=True,
                                 text=True, timeout=args.timeout)
            elapsed = time.monotonic() - t0
            if run.returncode == 0:
                print(f"PASS {rel} ({elapsed:.2f}s)", flush=True)
            else:
                failures.append(str(rel))
                print(f"FAIL {rel} (exit {run.returncode}; {elapsed:.2f}s)",flush=True)
                for line in (run.stdout + run.stderr).splitlines()[-14:]:
                    print("     " + line, flush=True)
        except subprocess.TimeoutExpired as e:
            failures.append(str(rel))
            print(f"TIMEOUT {rel} (>{args.timeout:.1f}s)",flush=True)
            if e.stdout:
                output = e.stdout.decode('utf-8', 'replace') if isinstance(e.stdout,bytes) else e.stdout
                print('     '+ ' | '.join(output.splitlines()[-3:]),flush=True)
    print(f"Result: {len(tests)-len(failures)}/{len(tests)} suites passed; "
          f"{len(failures)} failed/timeouts",flush=True)
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
