#!/bin/sh
# Read-only environment probe for deployment planning.
# Prints one JSON object to stdout. Makes no network calls, changes nothing,
# and records only whether proxy variables are set (never their values,
# which can contain credentials). Review the output before sharing it.
# Usage: sh env-probe.sh > env.json
set -u

esc() {
  # JSON string escape; drop control characters.
  printf '%s' "$1" | tr -d '\000-\010\013-\037' | tr '\n\t' '  ' | sed 's/\\/\\\\/g; s/"/\\"/g'
}

has() { command -v "$1" >/dev/null 2>&1; }

# Run a command with a short timeout when available; print first line only.
first() {
  if has timeout; then timeout 5 "$@" 2>/dev/null | head -n 1; else "$@" 2>/dev/null | head -n 1; fi
}

field() { printf '  "%s": "%s"' "$1" "$(esc "$2")"; }

# Parse /etc/os-release without sourcing it.
osr() {
  if [ -r /etc/os-release ]; then
    sed -n "s/^$1=//p" /etc/os-release | head -n 1 | sed 's/^"//; s/"$//'
  fi
}
os_id=$(osr ID); os_version=$(osr VERSION_ID); os_name=$(osr PRETTY_NAME)

libc=""
if has getconf && getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
  libc=$(getconf GNU_LIBC_VERSION)
elif has ldd; then
  libc=$(ldd --version 2>&1 | head -n 1)
fi

cgroup="unknown"
if [ -d /sys/fs/cgroup ]; then
  if [ -f /sys/fs/cgroup/cgroup.controllers ]; then cgroup="v2"; else cgroup="v1"; fi
fi

selinux="not_found"
if has getenforce; then selinux=$(getenforce 2>/dev/null); fi
apparmor="not_found"
if [ -r /sys/module/apparmor/parameters/enabled ]; then apparmor=$(cat /sys/module/apparmor/parameters/enabled); fi

fips="unknown"
if [ -r /proc/sys/crypto/fips_enabled ]; then fips=$(cat /proc/sys/crypto/fips_enabled); fi

cpus=""
if has nproc; then cpus=$(nproc); fi
mem_kb=""
if [ -r /proc/meminfo ]; then mem_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo); fi

ver() { if has "$1"; then shift; first "$@"; else printf 'not_found'; fi; }

docker_client=$(ver docker docker version --format '{{.Client.Version}}')
docker_server=$(ver docker docker version --format '{{.Server.Version}}')
[ -n "$docker_server" ] || docker_server="unreachable"
podman=$(ver podman podman --version)
containerd=$(ver containerd containerd --version)
kubectl=$(ver kubectl kubectl version --client)
helm=$(ver helm helm version --short)
oc=$(ver oc oc version --client)
python3v=$(ver python3 python3 --version)
nodev=$(ver node node --version)
javav=$(if has java; then java -version 2>&1 | grep -v '^Picked up' | head -n 1; else printf 'not_found'; fi)
openssl=$(ver openssl openssl version)
nvidia=$(ver nvidia-smi nvidia-smi --query-gpu=driver_version,name --format=csv,noheader)

is_set() { eval "v=\${$1:-}"; if [ -n "$v" ]; then printf 'set'; else printf 'unset'; fi; }

ca_extra=0
for d in /etc/pki/ca-trust/source/anchors /usr/local/share/ca-certificates; do
  if [ -d "$d" ]; then
    n=$(find "$d" -type f 2>/dev/null | wc -l | tr -d ' ')
    ca_extra=$((ca_extra + n))
  fi
done

var_free=""
if has df; then var_free=$(df -Pk /var 2>/dev/null | awk 'NR==2 {print $4}'); fi

in_container="no"
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then in_container="yes"; fi

{
  printf '{\n'
  field probe_version "1"; printf ',\n'
  field collected_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; printf ',\n'
  field os_id "$os_id"; printf ',\n'
  field os_version "$os_version"; printf ',\n'
  field os_name "$os_name"; printf ',\n'
  field kernel "$(uname -r)"; printf ',\n'
  field arch "$(uname -m)"; printf ',\n'
  field libc "$libc"; printf ',\n'
  field cgroup "$cgroup"; printf ',\n'
  field selinux "$selinux"; printf ',\n'
  field apparmor "$apparmor"; printf ',\n'
  field fips_enabled "$fips"; printf ',\n'
  field cpus "$cpus"; printf ',\n'
  field mem_total_kb "$mem_kb"; printf ',\n'
  field var_free_kb "$var_free"; printf ',\n'
  field running_in_container "$in_container"; printf ',\n'
  field docker_client "$docker_client"; printf ',\n'
  field docker_server "$docker_server"; printf ',\n'
  field podman "$podman"; printf ',\n'
  field containerd "$containerd"; printf ',\n'
  field kubectl_client "$kubectl"; printf ',\n'
  field helm "$helm"; printf ',\n'
  field oc_client "$oc"; printf ',\n'
  field python3 "$python3v"; printf ',\n'
  field node "$nodev"; printf ',\n'
  field java "$javav"; printf ',\n'
  field openssl "$openssl"; printf ',\n'
  field nvidia "$nvidia"; printf ',\n'
  field http_proxy "$(is_set HTTP_PROXY)/$(is_set http_proxy)"; printf ',\n'
  field https_proxy "$(is_set HTTPS_PROXY)/$(is_set https_proxy)"; printf ',\n'
  field no_proxy "$(is_set NO_PROXY)/$(is_set no_proxy)"; printf ',\n'
  field extra_ca_files "$ca_extra"; printf '\n'
  printf '}\n'
}
