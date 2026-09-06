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
