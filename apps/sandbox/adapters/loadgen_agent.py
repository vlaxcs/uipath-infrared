import json
import socket
import sys
import time
import urllib.error
import urllib.request


def fetch(url, timeout):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.status, response.read()


def read_phase(control_url):
    try:
        return json.loads(fetch(control_url, 2)[1]).get("phase", "warmup")
    except Exception:
        return "warmup"


def http_probe(url, timeout):
    started = time.time()
    try:
        status, body = fetch(url, timeout)
        return 200 <= status < 300, (time.time() - started) * 1000, body.decode(errors="replace").strip()[:80]
    except urllib.error.HTTPError as error:
        return False, (time.time() - started) * 1000, f"http {error.code}"
    except Exception as error:
        return False, (time.time() - started) * 1000, type(error).__name__


def tcp_probe(target, timeout):
    started = time.time()
    try:
        with socket.create_connection((target["host"], target["port"]), timeout=timeout) as connection:
            connection.sendall(bytes.fromhex(target["send_hex"]))
            reply = connection.recv(16)
        latency = (time.time() - started) * 1000
        if any(reply.startswith(bytes.fromhex(expected)) for expected in target["expect_hex"]):
            return True, latency, "reply ok"
        return False, latency, f"unexpected reply {reply[:8].hex() or 'empty'}"
    except Exception as error:
        return False, (time.time() - started) * 1000, type(error).__name__


def upload(url, document):
    request = urllib.request.Request(url, data=json.dumps(document).encode(), method="PUT")
    try:
        urllib.request.urlopen(request, timeout=5).close()
    except Exception:
        pass


def main(config_path):
    with open(config_path) as handle:
        config = json.load(handle)
    started = time.time()
    samples = []
    last_upload = 0.0
    turn = 0
    phase = read_phase(config["control_url"])
    while phase != "stop" and time.time() - started < config["max_seconds"]:
        tick = time.time()
        for target in config["tcp_targets"]:
            ok, latency, detail = tcp_probe(target, config["timeout_s"])
            samples.append([round(time.time() - started, 3), phase, "tcp", target["component_id"], ok, round(latency, 2), detail])
        for index in range(config["requests_per_second"] if config["http_targets"] else 0):
            target = config["http_targets"][turn % len(config["http_targets"])]
            turn += 1
            ok, latency, detail = http_probe(target["url"], config["timeout_s"])
            samples.append([round(time.time() - started, 3), phase, "http", target["component_id"], ok, round(latency, 2), detail])
            pause = tick + (index + 1) / config["requests_per_second"] - time.time()
            if pause > 0:
                time.sleep(pause)
        if time.time() - last_upload >= config["upload_every_s"]:
            upload(config["results_url"], {"done": False, "samples": samples})
            last_upload = time.time()
        rest = tick + 1.0 - time.time()
        if rest > 0:
            time.sleep(rest)
        phase = read_phase(config["control_url"])
    upload(config["results_url"], {"done": True, "samples": samples})


if __name__ == "__main__":
    main(sys.argv[1])
