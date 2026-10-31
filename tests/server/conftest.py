"""server/ 를 import 경로에 넣는다.

`server/scratch_service.py` 는 패키지가 아니라 systemd 가 직접 띄우는 단일
파일이라 설치 과정이 없다. 테스트에서 쓰려면 경로를 직접 더해야 한다.

모듈 수준에서 하는 일이 환경변수 읽기와 상수 정의뿐이라(소켓을 열지 않는다)
import 만으로는 서버가 뜨지 않는다. `main()` 은 `__main__` 가드 안에 있다.
"""

import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER))
