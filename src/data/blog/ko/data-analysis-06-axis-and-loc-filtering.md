---
title: "데이터 분석 공부 #6 — axis=0 을 줬는데 열 합계가 나왔다"
description: "pandas 의 축(axis) 개념부터 시작해서 loc · iloc 인덱싱과 boolean mask 필터링까지 정리했다. axis 번호를 행/열로 외웠다가 결과가 반대로 나와서 한참 헷갈렸다."
pubDatetime: 2026-09-02T09:40:00Z
tags:
  - K-뉴딜아카데미
  - 데이터분석공부
  - pandas
  - python
  - 학습
draft: false
featured: false
---

오늘은 축(axis)부터 살펴봤다. 표를 그대로 가져오면 두 개의 축을 갖는 데이터의 나열이라고 할 수 있다. 연도별 학생 성적이면 연도가 하나, 성적이 하나다.

## Table of contents

## 데이터프레임에 인덱스 넣기

DataFrame 에 딕셔너리로 국어·영어·수학 성적을 넣었다. 이렇게만 하면 어떤 점수인지는 알 수 있지만 누구의 점수인지는 알 수 없다. 그래서 인덱스를 넣어준다.

```python
df = pd.DataFrame({
    "국어": [90, 85, 70],
    "영어": [80, 95, 75],
    "수학": [70, 90, 80]
}, index=["민수", "주성", "철수"])

df
```

pandas 는 데이터프레임에 축이라는 개념을 넣어놓고 우리가 넣은 데이터를 선택할 수 있게 해준다고 생각하면 된다.

- 인덱스 축은 숫자 `0` — `df.index`
- 컬럼 축은 숫자 `1` — `df.columns`

숫자로 구분한다는 건, 나중에 어떤 함수에 축을 숫자로 넘겨줘야 하는 상황이 생기기 때문이다. 행을 축으로 줘야 하면 0, 열을 축으로 줘야 하면 1이다.

`df.axes` 를 출력하면 데이터프레임의 축들을 볼 수 있는데 `df.index` 값과 `df.columns` 값이 순서대로 반환된다. `index` 가 첫 번째라서 `0`, `columns` 가 두 번째라서 `1` 이 되는 것이다.

## axis 번호를 그대로 믿었다가 헷갈렸다

여기까지 정리하고 실제로 `axis` 를 써봤는데 값이 생각과 달랐다.

```python
df.sum(axis=0)
```

```txt
국어    245
영어    250
수학    240
dtype: int64
```

0번으로 축을 줬는데 컬럼을 합한 게 나왔다. 반대로 해보면 이렇다.

```python
df.sum(axis=1)
```

```txt
민수    240
주성    270
철수    225
dtype: int64
```

`axis=0` 은 인덱스 축이니까 인덱스별 합계가 나올 거라고 생각했는데 정반대였다.

이유는 이렇다. **`axis` 는 "무엇을 기준으로 묶을지" 가 아니라 "어느 방향으로 훑을지" 를 말한다.** `axis=0` 이면 행 방향으로 위에서 아래로 훑으면서 계산하기 때문에 그 방향의 데이터가 합쳐져 사라지고, 남는 건 컬럼이다. `axis=1` 이면 열 방향으로 훑으니까 열이 합쳐지고 인덱스가 남는다.

그래서 결과의 길이로 기억하는 게 편하다. `axis=0` 이면 결과가 **컬럼 개수만큼**, `axis=1` 이면 **행 개수만큼** 나온다.

<img src="/assets/mermaid/3a279ef66400f6da.svg" alt="axis 값에 따라 계산 방향과 결과의 길이가 어떻게 달라지는지 비교한 다이어그램" style="max-width:100%;height:auto;" />

실제로 이걸 제일 많이 쓰게 되는 자리는 새 열을 파생시킬 때다.

```python
df["총점"] = df.sum(axis=1)
```

행마다 하나씩 값이 나와야 새 열에 그대로 붙기 때문에 여기서는 `axis=1` 이다.

축이 정말 너무 헷갈리면 `transpose` 로 데이터프레임을 전치해서 쓰는 방법도 있다. 다만 데이터가 무거울 수 있으니 `head(1)` 을 붙여서 방향만 확인하는 식으로 쓰면 가볍다.

```python
df.head(1).T
```

## loc 로 원하는 데이터만 꺼내기

데이터를 보여줄 때는 도메인 지식이 없는 사람에게 보여준다고 생각해야 한다. 그분들에게는 시각화를 해줘야 가독성이 올라간다. 그러려면 표를 만들고 시각화를 하기 위해 필요한 데이터만 꺼낼 수 있어야 한다.

데이터프레임도 시리즈와 마찬가지로 `loc` 로 가져올 수 있고, 라벨을 기준으로 찾는다.

```python
orders.loc["O002"]
```

```txt
order_date      2026-08-02 00:00:00
customer                         서연
region                           부산
product                         모니터
quantity                          1
unit_price                   320000
paid                           True
total_amount                 320000
Name: O002, dtype: object
```

`loc` 에 하나만 넣으면 행 라벨로 해석한다. 그런데 찾은 데이터 중에 고객 이름만 알고 싶을 때가 있다. 그럴 때는 행 라벨 뒤에 열 라벨을 준다.

```python
orders.loc["O002", "customer"]

# 출력: '서연'
```

행렬의 개념으로 위치를 생각하면 좌표평면에서 쓰는 `(x, y)` 가 아니라 `(y, x)` 순서가 된다. 배열은 좌표계가 아니라 표라고 생각하는 게 편하다.

### 여러 개 가져오기

여러 개를 고를 거니까 `loc` 안에 배열을 넣어주면 된다.

```python
orders.loc[
    ["O002", "O004"]
]
```

행 하나만 선택했을 때는 시리즈로 나왔는데 두 개를 선택하니까 데이터프레임으로 나온다. 그런데 하나만 선택하더라도 배열로 감싸서 가져오면 데이터프레임으로 나오게 할 수 있다. 시리즈로 가져오면 1차원, 데이터프레임으로 가져오면 2차원이고 각각 쓰임새가 다르다.

행에도 여러 개가 필요하고 열에도 여러 개가 필요하면 각각 배열로 넣는다.

```python
orders.loc[
    ["O002", "O004"],
    ["order_date", "customer"]
]
```

### 슬라이싱

시리즈에서 슬라이싱이 됐는데 데이터프레임에서도 된다.

```python
orders.loc["O001":"O004"]
```

행에는 당연히 되고 열에도 된다. 그럼 행에는 적용하지 않고 열에만 슬라이싱하거나 열만 골라낼 수는 없을까 싶었는데, 행 자리에 `:` 를 주면 된다.

```python
orders.loc[:, ["customer", "total_amount"]]
```

`:` 는 "행은 전부" 라는 뜻이다. 우리가 원하는 데이터만 잘라내서 볼 때 이게 도움이 된다.

### iloc — 위치 기반

라벨 말고 위치로 인덱싱하는 방법도 있다.

```python
orders.iloc[0]
```

`iloc` 에도 배열을 줄 수 있다.

```python
orders.iloc[
    [0, 2, 4]
]
```

위치 기반 슬라이싱도 된다.

```python
orders.iloc[1:4]
```

다만 이렇게 슬라이싱하는 건 파이썬의 배열 슬라이싱과 똑같이 동작해서 **마지막 인덱스를 포함하지 않는다.** `loc` 는 포함하기 때문에 혼동하면 안 된다. 이건 [지난 글](/posts/data-analysis-03-series-indexing-and-filtering)에서 시리즈를 볼 때 한 번 걸렸던 부분인데 데이터프레임에서도 그대로다.

`loc` 말고 `at` 도 있다. 다만 완전히 같지는 않고 `at` 은 **값 하나만** 꺼내는 용도다. 슬라이싱이나 배열은 못 넣는 대신 그만큼 빠르다.

## 조건으로 필터링하기

이제 필터링이다. 어떤 조건을 만족하는 값을 가진 데이터만 골라내는 것부터 봤다. 필터링할 때는 boolean mask 를 쓴다.

보통 조건은 열을 기준으로 잡는다. 데이터프레임에서 조건을 잡을 열을 하나 골라 시리즈 형태로 뽑고, 이 시리즈에 조건을 걸어 마스킹한다.

```python
condition = orders["quantity"] >= 2

orders[condition]
```

![quantity 가 2 이상인 행만 남은 데이터프레임 출력](/assets/posts/data-analysis-06-axis-and-loc-filtering/01-filtering-quantity.webp)

조건을 만족하는 `True` 만 출력되고 나머지는 제외된다.

부등호뿐만 아니라 `==` 같은 파이썬 비교 연산자가 조건식을 만들 때 그대로 먹힌다. 그리고 필터링한 결과에서 특정 열만 골라 뽑아낼 수도 있다.

```python
filtered = orders[orders["total_amount"] >= 300000]

filtered[
    ["customer", "product", "quantity"]
]
```

![총액 30만 원 이상인 주문에서 고객·상품·수량 열만 남긴 출력](/assets/posts/data-analysis-06-axis-and-loc-filtering/02-filtering-selected-columns.webp)

조건을 두 개 이상 쓰고 싶으면 시리즈에서 했던 것처럼 `&` 나 `|` 를 쓴다.

```python
orders[
    quantity_condition & total_condition
][["product", "quantity"]]
```

이런 식으로 조건을 만족하는 데이터를 가져오고 필요한 열만 추려서 보이게 할 수 있다.

이런 결과가 5년치, 10년치 누적 데이터를 기반으로 나올 수 있다면 고객 맞춤형 마케팅도 가능해진다. 그런데 여기서 중요한 게 도메인 지식이다. 도메인 지식이 없으면 데이터를 본다고 해도 인사이트를 얻을 수 없다. 왜 환적이 오래 걸리는지, 해양물류에서 어떤 데이터를 눈여겨봐야 하는지는 도메인을 알아야 보인다.

## 데이터 탐색 순서

강의 마지막에 데이터프레임을 처음 받았을 때 훑는 순서를 정리해줬다.

<img src="/assets/mermaid/bac79fcbaee78a67.svg" alt="데이터프레임을 처음 받았을 때 확인하는 9단계 탐색 순서" style="max-width:100%;height:auto;" />

**1. 데이터가 정상적으로 불러와졌는지 확인**

```python
df.head()
```

**2. 데이터의 크기(모양) 확인**

```python
df.shape
```

**3. 컬럼과 인덱스 확인**

```python
print(df.columns.to_list())
```

```python
print(df.index.to_list())
# print(df.index)   # 인덱스가 없는 RangeIndex 인 경우
```

**4. 데이터 타입 확인**

```python
print(df.dtypes)
```

**5. 전체 구조 확인**

```python
print(df.info())
```

**6. 결측값 확인**

각각의 열에 대해 결측값이 몇 개인지를 셀 수 있어야 한다.

```python
df.isna().sum()
```

여기서도 `axis` 가 그대로 적용된다. `sum()` 에 아무것도 안 주면 기본이 `axis=0` 이라 컬럼별 결측값 개수가 나온다.

**7. 기술통계 확인 (수치형 데이터 분포)**

기술통계는 수치형 데이터에만 의미가 있다.

```python
df[select_cols].describe()
# 바로 df.describe() 를 할 수도 있지만
# 범주형 데이터를 빼고 진행하는 것이 좋다.
```

**8. 범주형 데이터 확인**

범주형 데이터는 뭐가 들어있느냐가 중요하다. 범주형이라고 해놓고 100개가 있으면 범주라는 게 의미가 없다.

```python
df["species"].unique()
# 범주형 데이터 중에 고유값만 출력
```

개수로 보고 싶으면 `nunique()` 를 쓴다. 그리고 마지막으로 각각의 범주가 얼마나 있는지 확인한다.

```python
df["species"].value_counts()

# df["species"].value_counts().sort_index() 를 하면
# 정렬까지 해준다.
```

**9. 샘플링**

앞에서 `head()` 를 하긴 했지만 간단하게 샘플링을 해준다. `head()` 는 앞쪽만 보여주니까 뒤쪽이나 중간에 이상한 값이 있으면 안 걸린다.

```python
df.sample(n=5, random_state=42)
```

## 정리

- `axis` 는 "묶는 기준" 이 아니라 "훑는 방향" 이다. 결과의 길이로 기억하는 게 덜 헷갈린다
- `loc` 는 라벨, `iloc` 는 위치. 슬라이싱할 때 `loc` 는 끝을 포함하고 `iloc` 는 포함하지 않는다
- 행은 두고 열만 고르고 싶으면 행 자리에 `:` 를 준다
- 필터링은 조건식으로 boolean mask 를 만들어 데이터프레임에 씌우는 것

## 더 공부해볼 것

- **`at` · `iat` 와 `loc` · `iloc` 의 차이** — 메모할 때는 `at` 이 `loc` 와 기능이 같다고 적었는데, 확인해보니 `at` 은 단일 값 접근 전용이었다. 언제 속도 차이가 실제로 유의미해지는지 보고 싶다. → [pandas: Fast scalar value getting and setting](https://pandas.pydata.org/docs/user_guide/indexing.html#fast-scalar-value-getting-and-setting)
- **`SettingWithCopyWarning`** — 필터링한 결과에 값을 대입하면 나오는 경고다. 필터링 결과가 원본의 복사본인지 뷰인지에 따라 달라진다는데 아직 정확히 모르겠다. → [Returning a view versus a copy](https://pandas.pydata.org/docs/user_guide/indexing.html#returning-a-view-versus-a-copy)
- **`query()` 메서드** — 조건이 여러 개일 때 `df[cond1 & cond2]` 대신 문자열로 쓸 수 있다고 한다. 가독성이 얼마나 나아지는지 비교해보고 싶다. → [DataFrame.query](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.query.html)
- **`describe(include="all")`** — 범주형까지 포함해서 기술통계를 내는 옵션. 8번 단계를 한 번에 대체할 수 있는지 궁금하다. → [DataFrame.describe](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.describe.html)
- **numpy 의 axis** — pandas 의 `axis` 는 결국 numpy 에서 온 개념이다. 3차원 이상이 되면 축이 어떻게 되는지 보면 지금 헷갈린 부분이 정리될 것 같다. → [NumPy: axes](https://numpy.org/doc/stable/user/absolute_beginners.html#array-fundamentals)
