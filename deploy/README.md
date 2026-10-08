# Lightsail 배포

Vercel → Lightsail 이전을 위한 서버 설정.

**현재 상태: 2026-09-06 부터 운영 중.** `parkhyo.in` 이 이 서버로 서빙되고 있다.
`main` 에 푸시하면 GitHub Actions 가 빌드해서 rsync 하고 심볼릭 링크를 바꾼다.

## 서버에 들어가기

**두 계정이 있고 키가 다르다.** 헷갈리기 쉬우니 먼저 적어둔다.

| 키 | 계정 | 용도 | sudo |
| --- | --- | --- | --- |
| `~/.ssh/blog-prod-key.pem` | `ubuntu` | **사람이 관리할 때** | ✅ |
| `~/.ssh/parkhyoin-deploy` | `deploy` | CI 배포 전용 | ❌ |

```bash
ssh -i ~/.ssh/blog-prod-key.pem ubuntu@parkhyo.in
```

고정 IP 대신 **도메인으로 붙어도 된다.** IP 는 개인정보가 아니지만 이 저장소가
공개라 적지 않는다 — 필요하면 Lightsail 콘솔에서 본다.

`deploy` 에 sudo 를 안 준 것은 의도다. 하는 일이 파일 받기와 심볼릭 링크 교체뿐이라
그 이상의 권한이 필요 없다. **패키지 설치나 nginx 설정 변경은 `ubuntu` 로 해야 한다.**

키는 두 기기(Windows · macOS)에 각각 있어야 한다. 저장소에 커밋하거나 채팅에
붙여넣지 말고 1Password · AirDrop · USB 로 옮긴다.

`~/.ssh/config` 에 넣어두면 `ssh blog` 로 끝난다.

```
Host blog
    HostName parkhyo.in
    User ubuntu
    IdentityFile ~/.ssh/blog-prod-key.pem
```

## 구성

| 파일 | 놓일 곳 |
| --- | --- |
| `nginx/parkhyo.in.bootstrap.conf` | 인증서 받기 전 임시 (HTTP 전용) |
| `nginx/parkhyo.in.conf` | 인증서 받은 뒤 교체 (HTTPS · 308 · 캐시) |
| `bin/activate-release` | `/usr/local/bin/` (실행 권한 755) |

## 서버 준비 (Phase 1a)

DNS 는 건드리지 않는다. 이 단계는 인스턴스를 지우면 없던 일이 된다.

### 1. 인스턴스

- Ubuntu LTS · 서울 리전(ap-northeast-2) · 블로그만이면 0.5 GB 로 충분
- **고정 IP 를 붙인다.** 안 붙이면 재시작할 때 IP 가 바뀐다. 붙어 있는 동안 무료
- 방화벽 22 · 80 · 443

### 2. 배포 사용자와 디렉토리

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/parkhyo.in/releases /var/www/certbot
sudo chown -R deploy:deploy /var/www/parkhyo.in

# CI 전용 키를 로컬에서 만들어 공개키만 서버에 넣는다
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy tee /home/deploy/.ssh/authorized_keys < deploy-ci.pub
sudo -u deploy chmod 700 /home/deploy/.ssh
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys

sudo install -m 755 deploy/bin/activate-release /usr/local/bin/activate-release
```

`deploy` 사용자에게 sudo 는 주지 않는다. 하는 일은 파일 받기와 심볼릭 링크 교체뿐이다.

### 3. nginx

```bash
sudo apt install -y nginx
sudo cp deploy/nginx/parkhyo.in.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/parkhyo.in.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**순서가 있다.** 본 설정은 443 블록에서 인증서 파일을 참조하므로,
인증서가 없는 상태로 올리면 `nginx -t` 가 실패하고 nginx 가 뜨지 않는다.
부트스트랩 설정으로 먼저 올려 IP 검증까지 마치고, 인증서를 받은 뒤 교체한다.

### 4. TLS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d parkhyo.in -d www.parkhyo.in
sudo certbot renew --dry-run   # 갱신이 실제로 되는지 한 번은 확인할 것
```

> **DNS 전환 전이면 HTTP-01 검증이 안 된다.** 도메인이 아직 Vercel 을 가리키기 때문이다.
> DNS-01 로 먼저 받아두거나, 전환 직후에 발급한다.
>
> ⚠️ Vercel 이 이미 `Strict-Transport-Security: max-age=63072000` 을 보내고 있어
> 방문자 브라우저에 HSTS 가 캐시되어 있다. **전환 시점에 유효한 인증서가 없으면
> 브라우저가 경고를 건너뛰고 접속 자체를 거부한다.** 인증서를 먼저 확보할 것.

## 보안 점검 (2026-10-02)

봇이 끊임없이 오는 것이 위험한 건지 확인하면서 한 점검이다. **결론은 "시끄럽지만
위험하지 않다" 였고**, 그래도 구멍 셋을 메웠다.

### 재본 것

```
스캐너가 찔러보는 것   /wp.php · /simple.php · /ops.php · /v1/graphql …   404 675건
SSH 로그인 실패        1,914회
```

**둘 다 구조적으로 막혀 있다.**

| 공격 | 왜 안 통하나 |
| --- | --- |
| PHP 파일 탐색 | 이 서버에 PHP 가 없다. 정적 파일만 서빙한다 — DB · 관리자 화면 · 입력 폼이 전부 없다 |
| SSH 무차별 대입 | `passwordauthentication no`. 키가 없으면 횟수는 무의미하다 |
| 생 IP · EC2 호스트명 | `default_server` 가 444 로 끊는다 (2026-10-01) |

나머지도 확인했다.

```
자동 보안 업데이트     active · 밀린 보안 패치 0건
바깥에 열린 포트       22 · 80 · 443 뿐 (53은 localhost 전용)
```

> **정적 사이트의 공격면이 작다는 것이 여기서 이득으로 돌아온다.** 스캐너가
> 찾는 것이 우리에게 하나도 없다. 로그가 시끄러운 것과 위험한 것은 다르다.

### 메운 구멍 셋

**① `/stats` 로그인에 횟수 제한이 없었다.** 비밀번호 변경 엔드포인트는 분당
5회로 막아뒀는데 basic auth 자체는 무제한이었다. `limit_req` 로 분당 60회로
묶었다. 조이면 안 되는 이유는 대시보드 한 번 열 때 3건이 나가기 때문이다.

**② root 로그인을 닫았다.** `PermitRootLogin no` · `MaxAuthTries 3`
([deploy/ssh/99-hardening.conf](ssh/99-hardening.conf)). 키로만 되니 이미
안전했지만 쓰지 않는 문은 닫아두는 쪽이 맞다.

```bash
sudo install -m 644 deploy/ssh/99-hardening.conf /etc/ssh/sshd_config.d/
sudo sshd -t && sudo systemctl reload ssh   # ⚠️ sshd 가 아니라 ssh 다
```

> **sshd 설정을 건드릴 때는 되돌리기를 먼저 예약한다.** 잠기면 복구가 번거롭다.
>
> ```bash
> sudo nohup sh -c 'sleep 300; rm -f /etc/ssh/sshd_config.d/99-hardening.conf; systemctl reload ssh' &
> # 새 연결로 접속 확인 후
> sudo pkill -f "sleep 300"
> ```

**③ fail2ban 을 들였다** ([deploy/fail2ban/jail.d-parkhyo.local](fail2ban/jail.d-parkhyo.local)).
램 34MB 를 쓴다.

```bash
sudo apt install -y fail2ban
sudo install -m 644 deploy/fail2ban/jail.d-parkhyo.local /etc/fail2ban/jail.d/parkhyo.local
sudo systemctl enable --now fail2ban
sudo fail2ban-client status
```

#### fail2ban 에서 걸린 것 둘

**`backend = systemd` 로는 SSH 실패를 하나도 못 본다.** 필터의 기본
`journalmatch` 가 `_SYSTEMD_UNIT=sshd.service` 인데 **이 시스템의 유닛 이름은
`ssh.service`** 다. 실패가 1,914건인데 `Total failed` 가 0 으로 나와서 알았다.
`backend = polling` + `logpath = /var/log/auth.log` 로 바꿨다.

> 같은 이름 문제로 `systemctl reload sshd` 도 "Unit not found" 로 죽는다.
> **이 서버에서 ssh 유닛은 `ssh`다.**

**`nginx-http-auth` 는 켰다가 껐다.** 처음에 `maxretry 5` 가 위험하다고 보고
15 로 늘렸는데 **그래도 주인 IP 를 두 번 차단했다.** 두 번째에는 연결 자체가
끊겨서(`HTTP 000`) 원인을 찾는 데만 한참 걸렸다.

원인은 구조적이다. **이 화면에 로그인하는 사람이 한 명이라 실패가 전부 그
한 명에게 몰린다.** 비밀번호를 잘못 알고 있던 동안의 시도, 설정을 확인하는
호출이 쌓이면 15회도 금방이다.

끈 근거는 **막을 것이 이미 막혀 있다** 는 것이다.

| 수단 | 효과 |
| --- | --- |
| nginx `limit_req` | `/stats` 전체를 분당 60회로 묶는다 |
| 비밀번호 | 23자 낱말 조합 |

분당 60회로 23자를 때려 맞히는 건 계산할 가치가 없다. **이 jail 이 실제로
한 일은 주인을 잠근 것뿐이고 막아준 것은 없다.**

> **다시 켤 조건** — `/stats` 에 로그인하는 사람이 둘 이상이 되거나, 외부에서
> 반복 시도가 들어오는 것을 `error.log` 에서 실제로 확인했을 때.

#### 잠겼을 때 푸는 법

```bash
sudo fail2ban-client status nginx-http-auth      # 차단 목록 확인
sudo fail2ban-client set nginx-http-auth unbanip <IP>
```

증상이 **401 이 아니라 연결 실패(`HTTP 000`)** 로 나타난다는 점을 기억해둘
것. 비밀번호 문제로 보이지 않아서 엉뚱한 곳을 먼저 뒤지게 된다.

#### 과거 기록은 안 센다

fail2ban 은 **새로 들어오는 줄만** 본다. 켠 직후 `Total failed` 가 0 인 것은
정상이다. 동작을 확인하려면 실패를 직접 만들어 보는데, **차단 한계보다 적게**
한다 (자기 IP 를 차단하면 잠긴다).

```bash
ssh -o BatchMode=yes nosuchuser_test@parkhyo.in   # 2회만
sudo fail2ban-client status sshd                   # Total failed 가 늘었나
sudo fail2ban-client set sshd unban --all          # 테스트 기록 정리
```

## 방문 통계 (GoAccess)

Vercel Analytics 를 걷어낸 자리를 nginx 로그 분석으로 대신한다.
클라이언트 JS 를 쓰지 않아 광고 차단기에 막히지 않고, 상주 프로세스가 없어
512 MB 인스턴스에서도 부담이 없다. 대신 크롤러가 같이 잡히므로 필터가 필요하다.

```bash
sudo apt install -y goaccess apache2-utils

sudo install -m 755 deploy/bin/generate-stats /usr/local/bin/generate-stats
sudo mkdir -p /var/www/stats /var/lib/goaccess

# 대시보드 접근용 비밀번호 (사용자 이름은 원하는 대로)
sudo htpasswd -c /etc/nginx/.htpasswd-stats admin
# 비밀번호 변경 서비스를 붙인 뒤로는 소유자가 statspw 다 (아래 참고)
sudo chown statspw:www-data /etc/nginx/.htpasswd-stats
sudo chmod 640 /etc/nginx/.htpasswd-stats

# 첫 리포트 생성
sudo /usr/local/bin/generate-stats
```

nginx 설정을 갱신하고 반영한다 (`/stats/` 블록이 추가돼 있다).

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### 대시보드 로그인

**아이디는 `admin`** 이다. 비밀번호는 `/etc/nginx/.htpasswd-stats` 에 **단방향 해시**로
저장돼 있어서 **꺼내볼 수 없다. 잊었으면 재설정한다.**

**들어갈 수는 있는데 바꾸고 싶은 거라면** `/stats/password/` 에서 하면 된다
(아래 "통계 비밀번호를 브라우저에서 바꾸기"). 아래 명령은 **잠겨서 못 들어갈
때** 쓰는 길이다.

```bash
printf '%s' '새비밀번호' | sudo htpasswd -i -B /etc/nginx/.htpasswd-stats admin
```

- **바꾼 뒤 파일이 실제로 바뀌었는지 확인할 것.** 2026-10-02 에 `htpasswd` 가
  "Updating password for user admin" 을 찍고도 파일이 안 바뀐 일이 있었다.
  그 뒤 알려준 비밀번호로 로그인이 안 됐다

  ```bash
  sudo stat -c "%y" /etc/nginx/.htpasswd-stats      # mtime 이 방금이어야 한다
  sudo cut -d: -f2 /etc/nginx/.htpasswd-stats | cut -c1-10   # 해시가 달라져야 한다
  ```

- **`-c` 를 붙이지 말 것.** 파일을 새로 만드는 옵션이라 기존 사용자가 날아간다
- **`-b` 도 쓰지 말 것.** 비밀번호가 명령줄에 실려 `ps` 출력과 셸 히스토리에
  평문으로 남는다. `-i` 는 표준입력으로 받는다
- `-B` 는 bcrypt. 최초 설정 때 쓴 APR1(MD5)은 요즘 기준으로 약하다 (2026-10-01 에 올렸다)
- nginx 는 요청마다 이 파일을 읽으므로 **리로드가 필요 없다**

아이디를 바꾸려면 새 계정을 먼저 넣고, **로그인되는 것을 확인한 다음** 예전 것을 지운다.
순서를 바꾸면 잠긴다.

```bash
sudo htpasswd -B /etc/nginx/.htpasswd-stats <새아이디>
sudo htpasswd -D /etc/nginx/.htpasswd-stats admin
```

시간마다 갱신되도록 cron 을 건다.

```bash
echo '30 * * * * root /usr/local/bin/generate-stats >/dev/null 2>&1' \
  | sudo tee /etc/cron.d/goaccess-stats
sudo chmod 644 /etc/cron.d/goaccess-stats
```

> **:30 에 도는 이유** — logrotate 가 자정 무렵 로그를 회전시킨다.
> 정각에 겹치면 회전 중인 로그를 읽을 수 있어 30분 비켜 둔다.

확인: `https://parkhyo.in/stats/` — 아이디·비밀번호를 물어본다.

### 화면 구성

| 주소 | 내용 | 만드는 주체 |
| --- | --- | --- |
| `/stats/` | 블로그 톤의 대시보드 | Astro (`src/pages/stats.astro`) |
| `/stats/report.json` | 방문 데이터 | GoAccess, 시간마다 |
| `/stats/bots/report.json` | 크롤러 데이터 | GoAccess, 시간마다 |
| `/stats/raw/` | GoAccess 원본 리포트 (디버깅용) | GoAccess |
| `/stats/bots/` | 크롤러 원본 리포트 | GoAccess |

대시보드 HTML 은 **릴리스에 들어 있고**(정적 빌드), 데이터는 브라우저가
`/stats/report.json` 을 받아 그린다. 통계는 서버에서 시간마다 갱신되므로
빌드 시점에 넣을 수 없다.

**전부 같은 basic auth 아래 있다.** 그래서 헤더 네비게이션에는 넣지 않았다 —
방문자가 링크를 누르면 비밀번호 창이 뜨게 된다. 주소를 직접 치고 들어간다.

`noindex` + `robots.txt` 차단 + sitemap 제외까지 걸어뒀다.

기본 GoAccess 리포트는 패널이 15개쯤 되는데, **보고 나서 할 일이 없는 것**은
숨겼다 — 브라우저 · OS · 방문 시간대 · 접속 IP · 지역 · 검색어 · 정적 파일.

남긴 다섯 가지의 쓰임은 이렇다.

- **VISITORS** 추세. 절대값보다 지난주 대비가 중요하다
- **REQUESTS** 152편 중 실제로 읽히는 글. 뭘 더 쓸지 정하는 근거
- **REFERRING_SITES** 구글 · 네이버 · 직접 유입 비율. SEO 작업의 성적표
- **NOT_FOUND** 깨진 링크. 이전 후유증이 여기 먼저 찍힌다
- **STATUS_CODES** 평소엔 안 봐도 되지만 `5xx` 가 뜨면 즉시 봐야 한다

크롤러를 따로 뺀 이유는, 사람 통계에서는 빼는 게 맞지만
**"이전 후에도 구글봇 · Yeti 가 오고 있는가"** 는 별도로 확인해야 하기 때문이다.
크롤러가 끊기면 색인이 서서히 빠지는데, 검색 순위로 드러날 땐 이미 늦다.

크롤러 리포트는 누적하지 않는다. 파이프로 넘기면 GoAccess 의 증분 추적이
안 먹어 매번 중복 집계된다. 이건 추세가 아니라 생존 확인용이라 최근 이틀이면 된다.

### 비콘 — 대시보드가 보여주는 수치 (2026-10-02~)

**로그로는 사람과 봇이 안 갈린다.** 필터를 두 번 고쳐도 성질이 안 바뀌었다.
로그는 "서버에 도착한 요청" 을 세는데, 봇도 요청을 보내므로 전부 들어오고
사람인지는 **추측해야 한다.** 실측에서 로그 기반 156건 중 자산까지 받은 것
(= 브라우저로 보이는 것)이 39건이었다.

**비콘은 다른 걸 센다 — "페이지를 띄우고 JS 를 돌린 것".** Vercel Analytics 가
쓰던 방식이고, 그래서 그쪽 숫자가 사람에 가까웠다. **우리가 못 했던 게 아니라
다른 걸 재고 있었던 것이다.**

> ⚠️ **처음엔 "봇은 JS 를 안 돌리니 자연히 빠진다" 고 적어뒀는데 틀렸다.**
> 이틀 만에 반례가 나왔다 — 아래 "JS 를 돌리는 봇" 절 참고. 지금은 비콘에
> **글 페이지 조건을 하나 더** 걸어서 센다.

```
브라우저  ──▶  GET /b/posts/foo/  ──▶  nginx 가 204 만 돌려주고
                                        beacon.log 에 한 줄 적는다
```

보내는 것은 경로 하나뿐이다 — 쿠키도 식별자도 없다. 본문이 없는 204 라
전송량이 0 에 가깝다. 스크립트는 [src/layouts/Layout.astro](../src/layouts/Layout.astro)
맨 아래에 있다.

| | 로그 기반 | 비콘 |
| --- | --- | --- |
| 세는 것 | 서버에 도착한 요청 | JS 를 돌린 브라우저가 **글 페이지**를 띄운 것 |
| 봇 | 섞인다 (추측으로 걸러야 함) | 목록만 긁는 것은 빠진다. JS 돌리는 봇이 글을 열면 섞인다 |
| 놓치는 것 | 없음 | JS 끈 사람 · 차단기 쓰는 사람 · **홈이나 목록만 보고 간 사람** |
| 어디서 보나 | `/stats/raw/` | `/stats/` |

**둘을 같이 남긴다.** 두 숫자의 차이가 곧 "봇이 얼마나 오고 있나" 라서 그
자체가 정보다. 비콘만 두면 필터가 샐 때 알아차릴 길이 없어진다.

#### 경로는 쿼리가 아니라 URL 경로에 담는다

처음에 `/b?p=...` 로 했는데 **하나도 기록되지 않았다.** `$arg_p` 는 URL
디코딩이 안 된 날값이라 `%2Fposts%2F…` 로 시작하고, `/` 로 시작하길 기대한
검증에 전부 떨어졌다.

`$uri` 는 nginx 가 디코딩·정규화까지 해준 값이라 그 문제가 없다. 덤으로
경로 탈출도 막힌다 — `/b/../../etc/passwd` 는 정규화되면 `/b/` 로 시작하지
않으므로 기록되지 않는다.

```nginx
map $uri $beacon_path {
    default        "";
    "~^/b(/.*)$"   $1;
}
```

> **`location ^~ /b/` 의 `^~` 가 필요하다.** 없으면 아래 확장자 정규식
> location 이 먼저 걸린다.

#### JS 를 돌리는 봇 — 비콘에 글 페이지 조건을 더했다 (2026-10-04)

비콘을 켠 지 이틀 뒤 대시보드가 **중국 83%** 로 나왔다. 까보니 세션이 전부
이 모양이었다.

```
10:15:15  GET  /tags        301      ← 슬래시 없는 주소로 들어온다
10:15:15  GET  /tags/       200
10:15:15  GET  /fonts/pretendard.css        200
10:15:15  GET  /_astro/ClientRouter….js     200
10:15:15  POST /b/tags/     204             ← 비콘까지 쏜다
10:15:16  woff2 서브셋 13개                 200
          (끝. 다시 안 온다)
```

**자산 18개를 받고 JS 를 실행한다. 헤드리스 브라우저다.** 그래서 "JS 를
돌렸으니 사람" 이 안 통했다.

판정 근거는 행동이었다.

```
슬래시 없는 /tags 요청      242건 · 고유 IP 209개
그중 딱 1번만 온 IP         185개 (89%)
그중 글을 한 편이라도 연 IP    7개 (3%)
9/22 부터 하루 20건 안팎으로 꾸준
```

UA 는 전부 같은 문자열에 Chrome 버전이 **144 · 151 로 고정**돼 있었다
(같은 시각 실제 방문자는 153). IP 는 중국 전신·연통·이동의 **지방별 가정용
대역**에 흩어져 있었다. 크롤러 한 대가 가정용 프록시 풀을 빌려 IP 를 바꿔가며
도는 형태다. **중국 독자가 아니라 중국 가정집 IP 를 빌린 한 대다.**

**조치 — 글 페이지만 센다.**

```nginx
map $beacon_path $beacon_article {
    default                0;
    "~^/posts/[^/]+/$"     1;
    "~^/en/posts/[^/]+/$"  1;
}

map "$log_beacon$beacon_article" $log_beacon_article {
    default  0;
    "11"     1;
}
```

```nginx
access_log /var/log/nginx/beacon.log     beacon if=$log_beacon_article;
access_log /var/log/nginx/beacon-all.log beacon if=$log_beacon;
```

`beacon-all.log` 는 **거르기 전 기준선**이다 (`human-probe.log` 와 같은 역할).
두 로그의 줄 수 차이가 목록 페이지에서 걸러낸 양이다. **필터를 고칠 때는
효과를 잴 수단을 같이 남긴다** — 안 남기면 다음에 또 "숫자가 줄었는데 맞게
줄었나" 를 알 수 없다.

**국가로는 거르지 않는다.** 중국 독자가 실제로 올 수 있다. Accept-Language
때와 같은 이유로, 믿을 건 **행동**이고 믿을 수 없는 건 요청자가 적어 보내는
값(UA · 헤더)과 출신지다.

**404 는 클라이언트에서 끊는다.** 주소 형태만 보면 `/posts/x/` 같은 탐색
요청이 글 페이지와 구별이 안 된다. nginx 는 비콘이 가리키는 경로가 404 인지
알 수 없으므로, 404 페이지가 `<meta name="x-beacon" content="off">` 를 내고
스크립트가 그걸 보면 안 쏜다.

**아직 안 고친 것 — 내비 링크에 슬래시가 없다.** 홈 HTML 에 `href="/tags"`
처럼 들어 있어서 크롤러가 그 형태로 저장해 되쏜다. 실제 방문자도 내비를
누르면 301 을 한 번 거치므로 어차피 고쳐야 한다. `/series` 71건 ·
`/playground` 54건 · `/posts` 48건 · `/portfolio` 28건도 같은 경로다.

#### 로그 위조를 막는다

`$beacon_path` 는 **요청자가 적어 보내는 값**이라 그대로 로그에 들어간다.
nginx 의 기본 escape 가 따옴표와 제어문자를 `\xNN` 으로 바꿔주므로 로그
줄을 위조할 수 없다. 확인해봤다.

```
보낸 것:   /b/a%22%20evil%20%22x
기록된 것: "GET /a\x22 evil \x22x HTTP/1.1"
```

**대신 한글 경로도 `\xED\x86\xB5` 로 escape 된다.** `escape=none` 으로 끄면
읽기 좋아지지만 위조가 다시 열린다. **대시보드 가독성과 로그 위조 방어를
맞바꾸지 않는다.** 글 슬러그는 전부 영문이라 영향은 태그 페이지뿐이다.

#### 반드시 횟수 제한을 건다

비콘은 아무나 부를 수 있다. 안 막으면 **누가 두들겨서 통계를 부풀릴 수 있다.**
빠르게 읽는 사람도 분당 30장을 넘기긴 어렵다.

```nginx
limit_req_zone $binary_remote_addr zone=beacon:1m rate=30r/m;
```

UA 필터와 본인 IP 제외는 로그 쪽과 똑같이 적용한다 — JS 를 실행하는 봇도
있고, 본인 방문은 빼는 게 맞다.

로그 포맷의 메서드 자리에 `"GET"` 을 박아뒀었는데 `sendBeacon` 은 **POST** 로
온다. `$request_method` 로 고쳤다 (2026-10-04). 숫자에는 영향이 없지만 로그가
사실과 달랐다.

#### ClientRouter 때문에 이벤트도 들어야 한다

이 블로그는 뷰 트랜지션을 쓴다. **화면 이동이 전체 새로고침이 아니라서**
인라인 스크립트가 한 번만 돌고 끝난다. `astro:page-load` 를 같이 들어야
이후 이동이 세어진다.

그런데 **ClientRouter 는 첫 로드에서도 그 이벤트를 쏜다.** 즉시 한 번 부르고
이벤트도 들으면 첫 페이지가 두 번 세어지므로, 직전 경로를 기억해 같은 경로를
연달아 보내지 않게 했다.

### 봇을 거르는 방식 — nginx 단계에서 로그를 나눈다

처음에는 전체 로그를 GoAccess 의 `--ignore-crawlers` 로 걸렀는데 **샜다.**
첫날 "실방문 60명" 으로 나온 것의 실체는 이랬다.

```
<작성자 집 IP>   123회   작성자 본인
curl/8.7.1        60회   검증하며 돌린 것
TikTokSpider      27회
Let's Encrypt     10회
Applebot 7 · Amazonbot 6 · Bytespider 6
404: /.env · /.git/HEAD · /hudson   취약점 스캐너
```

`--ignore-crawlers` 는 **알려진 이름 목록** 방식이라 TikTokSpider · Bytespider ·
curl 을 놓친다. 그래서 사후 필터 대신 **nginx 가 기록 단계에서 나누게** 했다.

```
access.log   전체 — 크롤러 리포트 · 디버깅
human.log    사람 요청만 — 방문 통계
```

`map` 네 개로 판정한다 — UA · 경로 · IP · **상태 코드**. 사후 grep 과 달리
**GoAccess 가 파일을 직접 읽으므로 증분 처리(`--persist`)가 그대로 작동한다.**

#### UA 필터만으로는 안 됐다 (2026-09-23)

위 방식으로 3주를 돌린 뒤 대시보드가 **방문자 4,290 · 페이지뷰 18,660** 을
가리켰다. 개인 블로그 숫자로 이상해서 로그를 직접 열었다.

```
하루 776 요청 중 404 가 604 (78%)
그중 234 개가 wp-login · .env · phpmyadmin 같은 취약점 탐색 경로
GCP 대역 IP 두 개가 각각 281 개 경로를 같은 1 초 안에 훑고 감
```

**두 IP 의 UA 가 평범한 크롬이었다.** `Mozilla/5.0 (Windows NT 10.0; Win64; x64)
AppleWebKit/537.36` — 위 문자열 목록에 걸릴 단어가 하나도 없다. **UA 는 요청자가
적어 보내는 값이라 애초에 못 믿는다.** 목록을 아무리 늘려도 같은 일이 반복된다.

그래서 **상태 코드로 거른다.** 진짜 독자는 404 를 거의 안 낸다.

```nginx
map $status $status_human {
    default        0;
    "~^(200|304)$" 1;
}
```

두 IP 만 빼도 **방문당 페이지가 6.2 → 1.7** 로 떨어졌다. 학습 블로그 통상
범위(1.5–2.5)다. 대시보드가 그 벤치마크를 이미 화면에 적고 있었는데도
3주 동안 못 알아봤다.

`301` 은 일부러 뺀다. `/portfolio` → `/portfolio/` 처럼 곧바로 200 이 따라오므로
같이 세면 한 번의 방문이 두 번으로 잡힌다.

**누적 DB 는 고쳐도 안 낫는다.** `--persist` 가 쌓아둔 과거는 필터를 바꿔도
그대로 남는다. 숫자를 처음부터 다시 보려면 옮기고 새로 쌓아야 한다.

```bash
sudo mv /var/lib/goaccess /var/lib/goaccess.polluted-$(date +%Y%m%d)
sudo mkdir -p /var/lib/goaccess
sudo mv /var/log/nginx/human.log /var/log/nginx/human.log.polluted-$(date +%Y%m%d)
sudo nginx -s reopen
sudo /usr/local/bin/generate-stats
```

> `rm` 대신 `mv` 를 쓴다. 판단이 틀렸을 때 되돌릴 수 있어야 한다.

### 통계 비밀번호를 브라우저에서 바꾸기

`/stats/password/` 에서 바꾼다. 아이디는 `admin` 고정이다.

**현재 비밀번호를 다시 묻는다 (2026-10-09~).** 처음엔 "basic auth 를
통과했으니 이미 아는 사람" 이라고 보고 묻지 않았다. **틀렸다.**

basic auth 가 증명하는 건 **브라우저가 비밀번호를 기억하고 있다**는 것이지,
**사람이 이 요청을 보내려 했다**는 게 아니다. 브라우저는 기억한 basic auth 를
다른 사이트에서 시작된 요청에도 붙인다 (쿠키의 SameSite 같은 보호가 없다).
그래서 `/stats` 에 로그인한 브라우저로 남의 페이지를 열면 이렇게 뚫렸다.

```html
<!-- 공격자 페이지. 보내는 본문은 {"password":"attacker-chosen-1","x":"="} -->
<form method="POST" action="https://parkhyo.in/stats/api/password" enctype="text/plain">
  <input name='{"password":"attacker-chosen-1","x":"' value='"}'>
</form>
```

서비스가 Content-Type 을 안 보고 본문을 JSON 으로 읽었기 때문이다. 로컬에서
같은 요청을 보내 **실제로 비밀번호가 바뀌는 것을 확인했다.** 지금은 세 겹이다.

| 겹 | 막는 것 | 어디서 |
| --- | --- | --- |
| Content-Type 이 `application/json` | 남의 사이트의 폼 (이 타입을 못 보낸다) | 서비스 → 415 |
| Origin 이 `https://parkhyo.in` | 남의 사이트의 스크립트 | 서비스 → 403 |
| 현재 비밀번호 (`htpasswd -v`) | 위 둘이 뚫려도 공격자는 이걸 모른다 | 서비스 → 403 |

`/stats/` 전체에는 `frame-ancestors 'none'` 도 붙였다 — 비밀번호 화면을 남의
페이지에 투명하게 끼워 누르게 만드는 것(클릭재킹)을 막는다.

> **현재 비밀번호를 잊으면 화면에서는 못 바꾼다.** 그때는 아래 복구 경로로
> 서버에서 직접 바꾼다. 브라우저가 옛 비밀번호를 기억하고 있어서 `/stats` 는
> 열리는데 정작 비밀번호 글자는 모르는 경우가 이렇다.

**바꾼 뒤에 로그인 창이 다시 뜨는 것은 정상이다.** 브라우저가 옛 비밀번호를
계속 들고 있어서 다음 요청이 401 이 된다. basic auth 에는 로그아웃이 없다.

#### 구조

```
/stats/password/        Astro 가 빌드하는 정적 페이지 (릴리스에 실림)
/stats/api/password     nginx → 유닉스 소켓 → 파이썬 서비스
```

**서비스는 상주하지 않는다.** systemd 소켓 활성화로 요청이 올 때만 뜨고
60초 조용하면 스스로 내려간다. 떠 있을 때 19MB, 쉴 때 0 이다. 비밀번호는
몇 달에 한 번 바꾸는 것이라 램 412MB 짜리에서 상시로 물고 있을 이유가 없다.

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin statspw
sudo chown statspw:www-data /etc/nginx/.htpasswd-stats   # statspw 쓰기 · nginx 읽기
sudo chmod 640 /etc/nginx/.htpasswd-stats
sudo mkdir -p /opt/parkhyo/server
sudo cp server/stats_password_service.py /opt/parkhyo/server/
sudo cp deploy/systemd/parkhyo-stats-password.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now parkhyo-stats-password.socket   # .service 가 아니라 .socket
```

> **`sudo` 규칙을 주지 않는다.** sudoers 는 한 줄 잘못 쓰면 범위가 넓어지는데,
> 파일 소유권을 바꾸면 그 파일 하나로 끝난다.

#### 🔑 잠겼을 때 — 복구 경로

**비밀번호 변경 기능이 생기면서 성질이 하나 바뀌었다.** 전에는 비밀번호가
새도 통계를 읽히는 게 전부였는데, 이제 남이 바꿔서 주인을 잠글 수 있다.
그래서 브라우저와 무관한 경로를 반드시 남겨둔다.

```bash
ssh -i ~/.ssh/blog-prod-key.pem ubuntu@parkhyo.in
printf '%s' '새비밀번호' | sudo htpasswd -i -B /etc/nginx/.htpasswd-stats admin
```

- **`-b` 를 쓰지 말 것.** 비밀번호가 명령줄에 실려 `ps` 출력과 셸 히스토리에
  평문으로 남는다. `-i` 는 표준입력으로 받는다
- **`-c` 를 쓰지 말 것.** 파일을 새로 만드는 옵션이라 기존 사용자가 날아간다
- `-B` 는 bcrypt. 예전 해시는 `$apr1$`(Apache MD5) 였고 2026-10-01 에 올렸다

#### 서버에 Node 가 없다 (2026-10-01에 알게 됨)

이 서비스를 처음에 Node 로 썼다가 `status=203/EXEC` 로 안 떴다. **빌드는 CI
에서 하고 서버는 정적 파일만 서빙해 왔으므로 Node 가 설치된 적이 없다.**
작은 일 하나 때문에 런타임을 더 들이지 않고 파이썬으로 다시 썼다. 파이썬은
이미 `generate-stats` 가 쓰고 있다.

**검색 서비스(`server/search-service.mjs`)도 같은 문제가 있다.** 배포하려면
Node 를 설치하거나 파이썬으로 옮겨야 한다. `docs/search-backlog.md` 참고.

#### 소켓 활성화로 돌릴 때 걸린 것

`PrivateNetwork=true` 를 주면 AF_INET 소켓을 아예 못 만든다. 그런데
`socketserver` 는 `bind_and_activate=False` 여도 **생성자에서 소켓을 먼저
만든다.** `address_family` 를 `AF_UNIX` 로 안 맞추면 그 자리에서 죽는다.

```
OSError: [Errno 97] Address family not supported by protocol
```

#### 상태 코드로도 안 됐다 — 200 으로 긁어가는 쪽 (2026-10-01)

404 봇을 거른 뒤에도 수치가 이상해서 이틀치 365 건을 다시 뜯었다. 이번엔
**정상 페이지를 200 으로 받아가는** 쪽이었다.

```
Accept-Language    zh-CN 123 · 헤더없음 121 · en-US 113 · ko 2
IP 당 1 건짜리      239 / 264 개
자산을 안 받은 IP    220 / 264 개   (CSS·폰트 없이 HTML 만)
```

**한국어 블로그인데 한국어 요청이 이틀에 2 건이었다.** 같은 UA 가 IP 59 개에
흩어져 `/` 한 장씩만 받아가는 모양이었고, 집계된 것의 81% 가 봇이었다.

들어오는 문이 따로 있었다. **레퍼러 1 위가 도메인이 아니라 EC2 기본 호스트명**
이었다 (`ec2-….ap-northeast-2.compute.amazonaws.com` 1,238 건 vs 도메인 685 건).

```
nginx 는 default_server 가 없으면 아무 Host 로 온 요청을 첫 server 블록으로 보낸다
→ 생 IP · EC2 호스트명으로도 사이트가 통째로 서빙되고 있었다
```

그래서 둘을 더했다.

```nginx
# ① 도메인이 아닌 Host 는 안 받는다 — 근본
server { listen 80 default_server; server_name _; return 444; }
server { listen 443 ssl http2 default_server; server_name _; ssl_reject_handshake on; }

# ② Accept-Language 가 없으면 브라우저가 아니다 — 33% 가 걸러진다
map $http_accept_language $lang_human { default 1; "" 0; }
```

**언어 종류로는 안 거른다.** `zh-CN` 독자가 실제로 올 수 있고, 언어로 사람을
가르는 건 필터가 아니다. 헤더가 *아예 없는* 것만 뺀다.

**`human-probe.log` 는 일부러 언어 조건 '전' 으로 남겨둔다** (`$log_probe`).
두 로그의 줄 수 차이가 곧 새 필터가 거른 양이라, 다음에 또 의심될 때 근거가
된다. 필터를 고치면 그 효과를 재는 수단도 같이 남겨야 한다.

**443 default 블록에 `http2` 를 빼면 안 된다.** nginx 1.24 에서 `http2` 는
listen 소켓 단위 설정이라 같은 포트의 다른 블록과 다르면
`protocol options redefined` 경고가 난다.

> **백업을 `sites-enabled/` 안에 두지 말 것.** `include sites-enabled/*` 라
> `.bak` 파일까지 읽혀서 `duplicate "log_format"` 으로 `nginx -t` 가 죽는다.
> 실제로 한 번 걸렸다. `/root/nginx-backups/` 같은 바깥에 둔다.

#### ⚠️ server 블록의 `access_log` 는 상위를 덮어쓴다

같은 날 찾은 별개 버그다. **nginx 는 server 블록에 `access_log` 를 쓰는 순간
http 레벨에서 물려받은 기본 로그를 쓰지 않는다.** 443 블록에 `human.log` 만
적어두면 **필터에 걸러진 HTTPS 요청이 어디에도 안 남는다.**

실제로 `access.log` 467 줄 중 436 줄이 308(포트 80 리다이렉트)이고 200 은
20 줄뿐이었다 — HTTPS 트래픽이 통째로 빠져 있었다. 크롤러 리포트가 제구실을
못 한 이유이고, 나중에 "이 트래픽이 뭐였나" 를 되짚을 수도 없었다.

**443 블록에 두 줄을 다 적어야 한다.**

```nginx
access_log /var/log/nginx/access.log combined;                  # 전체
access_log /var/log/nginx/human.log  combined if=$log_human;    # 사람만
```

#### 필터를 테스트할 때

`curl` 기본 UA 는 자동화 도구 목록에 걸려서 **테스트 자체가 안 된다.**
브라우저 UA 를 씌워야 한다.

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"

curl -s -o /dev/null -A "$UA" "https://parkhyo.in/?probe=ok"        # human.log 에 있어야
curl -s -o /dev/null -A "$UA" "https://parkhyo.in/wp-admin/probe"   # human.log 에 없어야
```

리로드 직후에는 옛 워커가 남은 요청을 처리하므로 **몇 초 기다렸다가** 확인한다.

> 서버 로그 분석의 구조적 한계이기도 하다. Vercel Analytics 는 클라이언트 JS 로
> 셌기 때문에 JS 를 실행하지 않는 봇이 자연히 빠졌다. 광고 차단기에 안 막히는
> 장점의 이면이다.

**본인 IP 제외** — 설정은 저장소에 있지만 주소 목록은 서버에만 둔다
(집 IP 는 개인정보라 공개 저장소에 올리지 않는다).

```bash
# 이 파일이 없으면 nginx 가 뜨지 않는다. 설정을 받기 전에 먼저 만들 것.
sudo tee /etc/nginx/conf.d/stats-exclude-ips.map <<'EOF'
# <IP> 0;   ← 통계에서 제외할 주소
EOF
```

주소를 추가할 때는 같은 파일에 `<제외할 IP> 0;` 형식으로 한 줄씩 넣고
`sudo nginx -t && sudo systemctl reload nginx`. 집 IP 는 바뀌므로 완벽하진 않다.

### 나라별 방문자 (GeoIP)

GoAccess 는 `--enable-geoip=mmdb` 로 빌드돼 있어서(`goaccess --version` 으로 확인)
DB 파일만 있으면 국가를 판별한다. 설치 직후에는 `--ignore-panel=GEO_LOCATION` 으로
꺼둔 상태였다.

```bash
sudo install -m 755 deploy/bin/update-geoip /usr/local/bin/update-geoip
sudo /usr/local/bin/update-geoip          # /var/lib/GeoIP/ 에 약 8MB

# 매달 1일 갱신
echo '17 4 1 * * root /usr/local/bin/update-geoip >/dev/null 2>&1' \
  | sudo tee /etc/cron.d/geoip-update
sudo chmod 644 /etc/cron.d/geoip-update
```

**MaxMind GeoLite2 대신 DB-IP Lite 를 쓴다.** GeoLite2 는 2019 년부터 계정과
라이선스 키를 요구해서, 키가 만료되면 조용히 갱신이 멈춘다. DB-IP 는 계정 없이
직접 받을 수 있어 **서버에 비밀을 하나도 안 둬도 된다.**

**라이선스가 CC BY 4.0 이라 저작자 표시가 필요하다.** `/stats/` 화면 하단에
"IP Geolocation by DB-IP" 를 넣어뒀다 ([src/pages/stats.astro](../src/pages/stats.astro)).
지우지 말 것.

`generate-stats` 는 DB 가 없으면 `--geoip-database` 를 안 붙이고 그냥 넘어간다.
지역 패널만 비고 나머지 통계는 그대로 나온다.

> **국가까지만 본다.** 도시 단위는 개인 블로그 통계에 필요가 없고, 로그에 남는
> IP 로 사람을 좁히는 방향은 피한다. GoAccess 의 JSON 은 대륙이 최상위고 국가가
> `items` 안에 들어 있어서, 대시보드가 `items` 만 펴서 쓴다.

### 알아둘 것

- **`human-probe.log` 는 임시다 (2026-09-23~).** `combined` 뒤에 `Accept-Language` 를
  덧붙여 남긴다. 필터를 통과한 요청 중 진짜 사람이 얼마나 되는지 판정하려는 것이다
  — 브라우저는 이 헤더를 거의 항상 보내고 스크레이퍼는 자주 빼먹는다.
  **판정이 끝나면 `log_format human_probe` 와 해당 `access_log` 한 줄을 지운다.**
- **누적 DB** (`/var/lib/goaccess`) 를 쓰므로 logrotate 가 로그를 지워도 통계는 남는다.
  이걸 안 켜면 Ubuntu 기본 설정(매일 회전 · 14개 보관) 때문에 2주 뒤 과거가 사라진다.
- 정적 파일(`.webp` · `.woff2` 등)은 GoAccess 가 별도 패널로 분리하므로
  페이지뷰가 부풀지 않는다.
- `--ignore-crawlers` 로 알려진 봇은 제외되지만 전부는 아니다.
  숫자가 이상하면 대시보드의 User Agent 패널을 먼저 본다.

## GitHub Secrets

| 이름 | 값 |
| --- | --- |
| `LIGHTSAIL_HOST` | 고정 IP |
| `LIGHTSAIL_SSH_KEY` | `deploy` 사용자 개인키 전체 |
| `LIGHTSAIL_KNOWN_HOSTS` | `ssh-keyscan -H <고정IP>` 출력 |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | (선택) Vercel 에 넣어둔 값 |
| `PUBLIC_NAVER_SITE_VERIFICATION` | (선택) 〃 |

## DNS 전환 전 검증

`--resolve` 로 Host 헤더를 붙이면 DNS 를 안 바꾸고도 실제 응답을 볼 수 있다.

```bash
IP=<고정IP>
curl -sI --resolve parkhyo.in:443:$IP https://parkhyo.in/ | head -3
curl -sI --resolve www.parkhyo.in:443:$IP https://www.parkhyo.in/posts/ | grep -iE '^HTTP|^location'
curl -sI --resolve parkhyo.in:443:$IP https://parkhyo.in/없는주소/ | head -1   # 404 여야 한다
```

## 롤백

```bash
ls -1dt /var/www/parkhyo.in/releases/*/   # 최근 5개가 남아 있다
sudo -u deploy /usr/local/bin/activate-release <이전-릴리스-id>
```

DNS 전환 후 서버 자체에 문제가 생기면 A 레코드를 Vercel 로 되돌린다.
그래서 전환 후 2주는 Vercel 프로젝트를 지우지 않는다.
