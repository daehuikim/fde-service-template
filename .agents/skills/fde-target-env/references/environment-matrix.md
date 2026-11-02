# 환경 호환 매트릭스

자주 만나는 고객 환경의 기본값과 함정. 확인일 2026-11-02. 배포판 point release, 고객 커스텀 커널, 추가 저장소(AppStream, backports)로 값이 달라질 수 있으므로 **결정 전 `env-probe.sh` 결과와 공식 문서로 재확인**한다.

## 배포판 기본값

| 배포판 | glibc | 기본 커널 | 기본 python3 | cgroup 기본 | 컨테이너 기본 | 비고 |
|---|---|---|---|---|---|---|
| RHEL/CentOS 7 | 2.17 | 3.10 | 3.6 (EPEL/SCL) | v1 | Docker(구버전) | 일반 지원 종료(2024-06-30). Node 18+ 공식 바이너리 불가 |
| RHEL 8 / Rocky·Alma 8 | 2.28 | 4.18 | 3.6 (3.8~3.12 AppStream) | v1 | Podman | maintenance 단계 |
| RHEL 9 / Rocky·Alma 9 | 2.34 | 5.14 | 3.9 (3.11·3.12 AppStream) | v2 | Podman | |
| RHEL 10 | 2.39 | 6.12 | 3.12 | v2 | Podman | |
| Ubuntu 20.04 | 2.31 | 5.4 | 3.8 | v1 | Docker(별도) | 표준 지원 종료(2025-05) |
| Ubuntu 22.04 | 2.35 | 5.15 | 3.10 | v2 | Docker(별도) | |
| Ubuntu 24.04 | 2.39 | 6.8 | 3.12 | v2 | Docker(별도) | |
| Debian 11 | 2.31 | 5.10 | 3.9 | v2 | Docker(별도) | LTS 종료(2026-08) |
| Debian 12 | 2.36 | 6.1 | 3.11 | v2 | Docker(별도) | |
| Amazon Linux 2 | 2.26 | 4.14/5.10 | 3.7 | v1 | Docker | Node 18+ 공식 바이너리 불가 |
| Amazon Linux 2023 | 2.34 | 6.1+ | 3.9 | v2 | Docker | |

## 컨테이너로 배포할 때

- 컨테이너는 호스트 **커널**을 공유하고 **userspace(glibc 포함)는 이미지**의 것을 쓴다. 호스트 glibc 차이는 문제가 아니지만 다음은 문제가 된다.
  - 오래된 런타임의 seccomp profile이 새 syscall을 모른다. 예: glibc 2.34+ 이미지(Ubuntu 22.04, Debian 12 등)가 오래된 Docker(20.10.10 이전)/libseccomp에서 `clone3` 등을 EPERM으로 거부당한다. 증상은 스레드 생성 실패, `Operation not permitted`.
  - cgroup v1 호스트: 최신 JVM/Node/Go의 메모리·CPU 한도 인식, Kubernetes 신버전의 cgroup v1 지원 축소(1.31부터 maintenance). 대상 K8s 버전 릴리스 노트로 확인.
  - 아키텍처: arm64 서버(Graviton, Ampere)에는 amd64 전용 이미지가 실행되지 않는다. `docker buildx`로 multi-arch 빌드 또는 아키텍처별 태그.
  - SELinux enforcing(RHEL 계열 기본): bind mount에 `:Z`/`:z` 또는 적절한 context 없으면 permission denied.
  - FIPS 모드: 이미지 안 암호 라이브러리도 FIPS 검증 모듈을 요구받을 수 있다(고객 정책 확인).
- **Podman**(RHEL 기본): rootless가 기본, 1024 미만 포트 바인딩 제한, `docker compose`와 `podman compose`/`podman-compose` 기능 차이, systemd 연동은 Quadlet.
- **OpenShift**: 컨테이너를 임의 UID + GID 0으로 실행. 쓰기 경로는 `chgrp 0` + `chmod g=u`. 80/443 직접 바인딩 불가, privileged/hostPath 금지가 기본.
- **Kubernetes 버전 skew**: kubelet은 kube-apiserver보다 최대 3 minor 낮을 수 있고, kubectl은 ±1 minor. 우리가 쓰는 API(`apiVersion`)가 고객 버전에서 제거되지 않았는지 확인(예: deprecated API 제거 일정).
- **Windows 호스트**: Linux 컨테이너는 WSL2/Hyper-V 위에서 실행된다. Windows 컨테이너는 호스트 OS 빌드와 이미지 빌드가 맞아야 한다.

## 네이티브(비컨테이너) 설치일 때

- Python wheel: `manylinux2014` = glibc 2.17 이상, `manylinux_2_28` = glibc 2.28 이상. musl(Alpine)은 `musllinux` wheel이 필요하고 없으면 소스 빌드(컴파일러 필요).
- Node.js 18 이상 공식 Linux 바이너리는 glibc 2.28 이상을 요구한다. RHEL 7/Amazon Linux 2에서는 컨테이너 또는 비공식 빌드가 필요하다.
- 시스템 Python을 건드리지 않는다(RHEL의 `platform-python`, Debian의 PEP 668 externally-managed). 전용 venv 또는 `uv`가 관리하는 인터프리터를 쓴다.
- OpenSSL 1.1 vs 3.x: 네이티브 확장/바이너리가 특정 버전에 링크되어 있으면 호스트와 맞아야 한다.

## 네트워크 · 폐쇄망

- 프록시: `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`를 빌드와 런타임에 각각 전달. 클러스터 내부 주소, metadata 주소를 `NO_PROXY`에 넣는다.
- 사내 CA: RHEL 계열 `/etc/pki/ca-trust/source/anchors` + `update-ca-trust`, Debian 계열 `/usr/local/share/ca-certificates` + `update-ca-certificates`. Node는 `NODE_EXTRA_CA_CERTS`, Python requests는 `REQUESTS_CA_BUNDLE`/`SSL_CERT_FILE`, Java는 truststore 별도.
- 폐쇄망 번들: 이미지 `docker save`/`skopeo copy`(digest 유지), Helm chart `helm package`, Python `pip download --platform ... --only-binary=:all:` wheelhouse, npm/pnpm offline store, 모델 가중치와 라이선스 파일, SHA-256 목록. 반입 후 고객 registry로 push하고 manifest의 이미지 경로를 바꾼다.
- 텔레메트리, 자동 업데이트, 원격 라이선스 확인, 원격 모델/임베딩 다운로드가 기본 켜진 의존성을 찾아 끈다.

## 지원 기간 점검

배포판, 언어 런타임(Python, Node, Java), DB, Kubernetes의 EOL을 [endoflife.date](https://endoflife.date/) 같은 집계 또는 공식 일정으로 확인하고, 고객 계약 기간 동안 보안 패치를 받을 수 있는지 적는다. 예: Python 3.10은 2026-10 EOL, Node.js 22 LTS는 2027-04 EOL 예정.
