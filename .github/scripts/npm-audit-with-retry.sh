#!/usr/bin/env bash
set -Eeuo pipefail

readonly max_attempts=3

retry_delay_seconds="${NPM_AUDIT_RETRY_DELAY_SECONDS:-5}"
if ! [[ "${retry_delay_seconds}" =~ ^[0-9]+$ ]] || (( retry_delay_seconds > 30 )); then
  retry_delay_seconds=5
fi
readonly retry_delay_seconds

output_file="$(mktemp)"
cleanup() {
  rm -f "${output_file}"
}
trap cleanup EXIT

is_transient_audit_failure() {
  local file="$1"

  grep -Eiq \
    'network timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|socket hang up|audit endpoint returned an error|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout' \
    "${file}"
}

attempt=1
while (( attempt <= max_attempts )); do
  : >"${output_file}"
  echo "npm audit attempt ${attempt}/${max_attempts}" >&2

  if npm audit "$@" >"${output_file}" 2>&1; then
    cat "${output_file}"
    exit 0
  else
    audit_status=$?
  fi

  cat "${output_file}"

  if ! is_transient_audit_failure "${output_file}"; then
    echo "npm audit failed with a non-transient result; not retrying." >&2
    exit "${audit_status}"
  fi

  if (( attempt == max_attempts )); then
    echo "npm audit transient failure persisted after ${max_attempts} attempts." >&2
    exit "${audit_status}"
  fi

  echo "npm audit transient registry/network failure detected; retrying after ${retry_delay_seconds}s." >&2
  sleep "${retry_delay_seconds}"
  attempt=$((attempt + 1))
done
