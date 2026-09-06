# Lightsail 배포

Vercel → Lightsail 이전을 위한 서버 설정. 전체 계획과 전환 절차는 이전 런북 참고.

**현재 상태: 준비만 해둔 것. 아직 어디에도 연결되어 있지 않다.**
`.github/workflows/deploy.yml` 은 Secrets 가 없으면 실패하므로, 서버가 준비될 때까지는
그냥 두거나 워크플로를 비활성화해둔다.

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
<작성자 집 IP>  123회   작성자 본인
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

`map` 세 개로 판정한다 — UA 가 봇 · 자동화 도구 · 빈 값이면 제외,
정적 파일과 `/stats/` 자체도 제외. 사후 grep 과 달리 **GoAccess 가 파일을 직접
읽으므로 증분 처리(`--persist`)가 그대로 작동한다.**

> 서버 로그 분석의 구조적 한계이기도 하다. Vercel Analytics 는 클라이언트 JS 로
> 셌기 때문에 JS 를 실행하지 않는 봇이 자연히 빠졌다. 광고 차단기에 안 막히는
> 장점의 이면이다.

**본인 IP 를 빼려면** 서버에서 직접 추가한다 (공개 저장소에 집 IP 를 넣지 말 것).
`map $remote_addr $ip_human { default 1; 1.2.3.4 0; }` 를 추가하고
`$log_human` 판정에 끼워넣는 식이다.

### 알아둘 것

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
