---
title: "데이터 분석 공부 #3 — loc 는 끝을 포함하고 iloc 는 제외한다"
description: "3주 2일차. Series 의 속성들을 훑고 loc 와 iloc 로 값을 꺼내봤다. 슬라이싱이 범위를 넘어도 오류가 안 난다는 것, 그리고 loc 와 iloc 의 끝 처리가 다르다는 것을 확인했다. 조건 필터링과 불리언 Series 집계까지 정리한다."
pubDatetime: 2026-09-01T03:50:00Z
tags:
  - K-뉴딜아카데미
  - 데이터분석공부
  - pandas
  - python
  - 학습
draft: false
featured: false
---

3주 2일차. [어제에 이어](/posts/data-analysis-02-pandas-series) Series 를 계속 봤다. 오늘은 값을 꺼내는 방법과 조건으로 거르는 방법이다.

## Table of contents

## 자주 쓰는 속성

| 속성 | 하는 일 |
| --- | --- |
| `values` | numpy 의 `ndarray` 형식으로 값을 출력 |
| `index` | 인덱스를 출력 |
| `dtype` | 자료형 |
| `name` | Series 의 이름 |
| `size` | 값이 몇 개인지 |
| `shape` | 원소 개수와 차원 |
| `ndim` | 차원 |
| `empty` | 비어 있는지 |

`values` 를 보니 `pd.Series()` 에 넣는 배열이 사실 `values=` 가 생략된 것이었다.

`index` 는 예상과 다르게 나왔다. 인덱스 값만 나올 줄 알았는데 `dtype` 까지 붙어서 출력된다. 배열이 아니라 객체가 출력됐기 때문이다. 배열처럼 쓰려면 그 객체 안의 함수를 꺼내야 한다.

```python
s.index           # Index 객체
s.index.to_list() # 파이썬 리스트
```

## 위치로 꺼내기, 인덱스로 꺼내기

- `iloc[n]` — 위치 기반
- `loc['인덱스']` — 인덱스 기반

둘 다 함수가 아니라 객체다. 대괄호가 오버라이드되어 있어서 배열처럼 쓸 수 있다.

지금은 Series 를 직접 만들어서 쓰고 있으니 인덱스가 헷갈리지 않는다.

## 슬라이싱은 범위를 넘어도 오류가 안 난다

파이썬 배열의 슬라이싱을 그대로 쓸 수 있다.

```python
sales.iloc[1:4]

# sales[1:4] 도 먹힌다
# sales.iloc[::-1] 도 된다
```

여기서 하나 걸리는 게 있었다. **슬라이싱은 범위를 넘어가도 오류가 안 난다.**

```python
# 길이가 10보다 작아도
sales.iloc[10:20]
```

```txt
Series([], Name: 일별_판매량, dtype: int64)
```

값을 직접 꺼낼 때는 길이보다 큰 인덱스를 주면 오류가 난다. 그런데 슬라이싱은 빈 Series 를 돌려준다. 그러면 거기까지 값이 있다고 착각한 채로 계속 작업하게 되고, 빈 값과 연산을 하게 된다.

그래서 데이터 분석을 할 때 가장 먼저 봐야 하는 게 `shape` 라고 한다.

## loc 슬라이싱은 끝을 포함한다

인덱스가 문자열이어도 슬라이싱이 된다.

```python
sales.loc["화":"목"]
```

```txt
화     95
수    130
목    100
Name: 일별_판매량, dtype: int64
```

목요일까지 나오는 게 이상했다. 파이썬 슬라이싱이면 끝은 빠져야 한다.

`loc` 의 기본 동작이 양끝을 다 포함하는 것이기 때문이다. `iloc` 는 파이썬 슬라이싱처럼 끝 위치를 제외한다.

| | 기준 | 끝 |
| --- | --- | --- |
| `loc` | 인덱스 라벨 | 포함 |
| `iloc` | 위치 | 제외 |

`loc` 에는 배열도 넣을 수 있다.

```python
sales.loc[["월", "수", "금"]]
```

```txt
월    120
수    130
금     75
Name: 일별_판매량, dtype: int64
```

결과는 값만 나오는 게 아니라 Series 로 나온다.

한쪽을 비워두는 것도 된다.

```python
sales.loc[:"목"]   # 처음부터 목요일까지
sales.loc["수":]   # 수요일부터 끝까지
```

## 조건 필터링

점수 Series 를 만들어서 해봤다. (아래 이름은 실제 값 대신 넣은 것이다.)

파이썬 배열형 자료는 비교 연산자를 쓸 수 없는데 Series 는 된다.

```python
scores >= 80
```

```txt
학생A     True
학생B     True
학생C    False
학생D    False
학생E     True
학생F     True
학생G     True
Name: 중간고사_점수, dtype: bool
```

인덱스와 `name` 은 그대로인 Series 객체인데 `dtype` 만 `bool` 로 나온다.

이 결과를 그대로 대괄호에 넣을 수 있다.

```python
scores[scores >= 80]
```

```txt
학생A     88
학생B     95
학생E    100
학생F     99
학생G     80
Name: 중간고사_점수, dtype: int64
```

### and 가 아니라 &

80 점 이상이면서 90 점 미만인 것을 찾으려는데 `and` 가 안 된다. `and` 는 논리 자료형만 연산할 수 있기 때문이다. Series 끼리는 비트 연산자를 쓴다.

```python
(scores >= 80) & (scores < 90)
```

```txt
학생A     True
학생B    False
학생C    False
학생D    False
학생E    False
학생F    False
학생G     True
Name: 중간고사_점수, dtype: bool
```

`or` 자리에는 `|` 를 쓴다. 부정은 `~` 다.

```python
scores.loc[(scores >= 80) & (scores < 90)]
scores[~(scores >= 80)]   # 80 점 미만만
```

조건을 변수로 빼서 `scores.loc[condition]` 처럼 써도 된다.

이렇게 참인 것만 뽑거나 거짓인 것만 뽑는 걸 필터링 또는 마스킹이라고 한다.

### 대괄호로도 되는데 왜 loc 를 쓰나

`scores[scores >= 80]` 처럼 인스턴스에 바로 넣어도 값이 나온다. 그런데 위에서는 `scores.loc[...]` 을 썼다.

조회만 할 거면 그냥 인스턴스에 써도 상관없다. 그래도 `loc` 를 쓰는 습관을 들이는 게 좋다고 한다. **애매함을 없애기 위해서다.** 대괄호는 상황에 따라 위치로도 읽히고 라벨로도 읽히지만, `loc` 는 라벨이라고 못을 박는다.

### between, isin

```python
scores.between(74, 88)
```

```txt
학생A     True
학생B    False
학생C    False
학생D     True
학생E    False
학생F    False
학생G     True
Name: 중간고사_점수, dtype: bool
```

쓰고 보니 `&` 로 두 조건을 묶은 것과 결과가 같다. 출력이 불리언 Series 라는 것도 같아서, 값을 꺼내려면 `scores.loc[scores.between(74, 88)]` 처럼 한 번 더 감싸야 한다.

양끝을 포함할지는 `inclusive` 로 정한다.

```python
scores.loc[scores.between(74, 88, inclusive="right")]

# 88 만 포함, 74 는 제외
# left · right · both · neither
```

`isin()` 에는 배열을 넣을 수 있다.

```python
nums = pd.Series([1, 3, 5, 7, 9])
nums.isin([2, 4, 6])
```

```txt
0    False
1    False
2    False
3    False
4    False
dtype: bool
```

어떤 값이 `True` 인지 보려면 `between` 때와 마찬가지로 한 번 감싼다.

```python
nums[nums.isin([2, 4, 6])]
```

해당하는 값만 Series 로 나온다.

### 문자열

문자열은 객체라서 `.str` 아래에 함수들이 있다.

```python
fruits.str.startswith("a")        # 불리언 Series
fruits.loc[fruits.str.startswith("a")]
```

```txt
0      apple
4    avocado
dtype: str
```

## 불리언 Series 로 집계하기

파이썬은 논리 자료형을 내부적으로 정수로 취급한다. `True` 가 1, `False` 가 0 이다. 그래서 마스크를 그대로 집계에 쓸 수 있다.

학생이 100 명 있고 80 점 이상이 합격이라고 하면, 합격자 수는 마스크의 합이다.

```python
print(f"합격자 수 = {(scores >= 80).sum()}")
# 합격자 수 = 5

print(f"합격률 = {(scores >= 80).mean()}")
# 합격률 = 0.7142857142857143

print(f"한 명이라도 만점이 있는가? = {(scores == 100).any()}")
# True

print(f"전원이 60점 이상이니? = {(scores >= 60).all()}")
# True
```

`mean()` 이 비율이 되는 게 처음엔 안 와닿았는데, 1 과 0 의 평균이니 비율이 맞다.

## 더 공부해볼 것

- **`shape` 를 언제 확인하는가** — 슬라이싱이 조용히 빈 Series 를 돌려준다는 걸 알았으니, 실제 분석에서 어느 시점에 `shape` 를 찍어보는 게 습관이 되어야 하는지. 중간 결과가 비었는지 검사하는 방법이 따로 있는지도
- **`loc` 가 끝을 포함하는 이유** — 위치가 아니라 라벨이라서 "그다음"이 정의되지 않기 때문인 것 같은데 확인이 필요하다 ([pandas indexing 문서](https://pandas.pydata.org/docs/user_guide/indexing.html))
- **`&` 를 쓸 때 괄호가 꼭 필요한가** — `(scores >= 80) & (scores < 90)` 에서 괄호를 뺐을 때 어떻게 되는지. 연산자 우선순위 문제로 보인다
- **`between` 과 `&` 중 무엇을 쓰나** — 결과가 같으면 가독성 문제인지, 아니면 성능이나 결측 처리에서 차이가 있는지
- **`.str` 에 어떤 함수들이 있는가** — `startswith` 말고 `contains` · `replace` 같은 것들. 정규식을 받는지도 ([pandas 문자열 처리](https://pandas.pydata.org/docs/user_guide/text.html))
- **`sum()` 이 결측을 어떻게 세는가** — 마스크에 `NaN` 이 섞이면 합계가 어떻게 되는지. [#2 에서 인덱스가 안 맞으면 `NaN` 이 생기는 걸 봤으니](/posts/data-analysis-02-pandas-series) 마스크에도 생길 수 있을 것 같다
