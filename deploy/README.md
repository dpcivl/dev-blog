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
sudo chown root:www-data /etc/nginx/.htpasswd-stats
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

```bash
sudo htpasswd -B /etc/nginx/.htpasswd-stats admin
```

- **`-c` 를 붙이지 말 것.** 파일을 새로 만드는 옵션이라 기존 사용자가 날아간다
- `-B` 는 bcrypt. 최초 설정 때 쓴 APR1(MD5)은 요즘 기준으로 약하니 바꾸는 김에 올린다
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
