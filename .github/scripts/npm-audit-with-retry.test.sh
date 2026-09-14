#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
helper="${script_dir}/npm-audit-with-retry.sh"
test_root="$(mktemp -d)"

cleanup() {
  rm -rf "${test_root}"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  [[ "${actual}" == "${expected}" ]] || fail "${label}: expected '${expected}', got '${actual}'"
}

make_fake_npm() {
  local case_dir="$1"

  cat >"${case_dir}/npm" <<'FAKE_NPM'
#!/usr/bin/env bash
set -Eeuo pipefail

count_file="${FAKE_NPM_COUNT_FILE:?}"
args_file="${FAKE_NPM_ARGS_FILE:?}"
scenario="${FAKE_NPM_SCENARIO:?}"

count=0
if [[ -f "${count_file}" ]]; then
  count="$(<"${count_file}")"
fi
count=$((count + 1))
printf '%s' "${count}" >"${count_file}"
printf '%s\n' "$*" >>"${args_file}"

case "${scenario}" in
  success)
    echo "found 0 vulnerabilities"
    exit 0
    ;;
  vulnerability)
    echo "# npm audit report"
    echo "critical-pkg  <=1.0.0"
    echo "1 high severity vulnerability"
    exit 1
    ;;
  transient-then-success)
    if (( count < 3 )); then
      echo "npm ERR! audit endpoint returned an error"
      echo "npm ERR! 503 Service Unavailable"
      exit 1
    fi
    echo "found 0 vulnerabilities"
    exit 0
    ;;
  persistent-transient)
    echo "npm ERR! network timeout at: https://registry.npmjs.org/-/npm/v1/security/advisories/bulk"
    echo "npm ERR! ETIMEDOUT"
    exit 1
    ;;
  *)
    echo "Unknown fake npm scenario: ${scenario}" >&2
    exit 2
    ;;
esac
FAKE_NPM
  chmod +x "${case_dir}/npm"
}

run_case() {
  local name="$1"
  local scenario="$2"
  local expected_status="$3"
  local expected_attempts="$4"
  shift 4

  local case_dir="${test_root}/${name}"
  mkdir -p "${case_dir}"
  make_fake_npm "${case_dir}"

  local count_file="${case_dir}/count"
  local args_file="${case_dir}/args"
  local stdout_file="${case_dir}/stdout"
  local stderr_file="${case_dir}/stderr"

  set +e
  PATH="${case_dir}:${PATH}" \
    FAKE_NPM_COUNT_FILE="${count_file}" \
    FAKE_NPM_ARGS_FILE="${args_file}" \
    FAKE_NPM_SCENARIO="${scenario}" \
    NPM_AUDIT_RETRY_DELAY_SECONDS=0 \
    bash "${helper}" "$@" >"${stdout_file}" 2>"${stderr_file}"
  local status=$?
  set -e

  local attempts=0
  if [[ -f "${count_file}" ]]; then
    attempts="$(<"${count_file}")"
  fi

  assert_equals "${expected_status}" "${status}" "${name} exit status"
  assert_equals "${expected_attempts}" "${attempts}" "${name} attempt count"

  if [[ "${name}" == "audit-production-args" ]]; then
    assert_equals "audit --omit=dev --audit-level=high" "$(<"${args_file}")" "${name} arguments"
  fi

  if [[ "${name}" == "audit-all-args" ]]; then
    assert_equals "audit --audit-level=high" "$(<"${args_file}")" "${name} arguments"
  fi

  echo "PASS: ${name}"
}

run_case "immediate-success" "success" 0 1 --audit-level=high
run_case "vulnerability-fails-without-retry" "vulnerability" 1 1 --audit-level=high
run_case "transient-then-success" "transient-then-success" 0 3 --audit-level=high
run_case "persistent-transient" "persistent-transient" 1 3 --audit-level=high
run_case "audit-production-args" "success" 0 1 --omit=dev --audit-level=high
run_case "audit-all-args" "success" 0 1 --audit-level=high
