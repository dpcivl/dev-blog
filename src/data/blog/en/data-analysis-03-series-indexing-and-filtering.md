---
title: "Data Analysis Study #3 — loc includes the end, iloc excludes it"
description: "Week 3, day 2. I went through Series attributes and pulled out values with loc and iloc. I confirmed that slicing doesn't raise an error even when it goes out of range, and that loc and iloc handle the endpoint differently. I also cover conditional filtering and aggregating boolean Series."
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

Week 3, day 2. [Continuing from yesterday](/en/posts/data-analysis-02-pandas-series), I kept looking at Series. Today it's about how to pull out values and how to filter by condition.

## Table of contents

## Commonly used attributes

| Attribute | What it does |
| --- | --- |
| `values` | Outputs the values as a numpy `ndarray` |
| `index` | Outputs the index |
| `dtype` | The data type |
| `name` | The Series' name |
| `size` | How many values there are |
| `shape` | Number of elements and dimensions |
| `ndim` | Dimensions |
| `empty` | Whether it's empty |

Looking at `values`, I realized that the array passed into `pd.Series()` was actually just `values=` with the keyword omitted.

`index` came out differently than I expected. I thought only the index values would show, but `dtype` gets attached to the output too. That's because what's printed is an object, not an array. To use it like an array, you need to pull a function out of that object.

```python
s.index           # Index object
s.index.to_list() # Python list
```

## Pulling values by position vs. by index

- `iloc[n]` — position-based
- `loc['index']` — index-based

Both are objects, not functions. The brackets are overridden so they can be used like an array.

Right now I'm building the Series myself, so the index doesn't confuse me.

## Slicing doesn't raise an error even out of range

You can use regular Python array slicing as-is.

```python
sales.iloc[1:4]

# sales[1:4] also works
# sales.iloc[::-1] also works
```

There was one thing that caught my attention here. **Slicing doesn't raise an error even if it goes out of range.**

```python
# Even if the length is less than 10
sales.iloc[10:20]
```

```txt
Series([], Name: 일별_판매량, dtype: int64)
```

If you try to pull out a value directly with an index larger than the length, it raises an error. But slicing returns an empty Series instead. That means you can end up assuming values exist up to that point and keep working, only to end up doing operations on empty data.

Apparently that's why the first thing you should check when doing data analysis is `shape`.

## loc slicing includes the end

Slicing works even when the index is a string.

```python
sales.loc["화":"목"]
```

```txt
화     95
수    130
목    100
Name: 일별_판매량, dtype: int64
```

It seemed odd that Thursday ("목") was included. With normal Python slicing, the end should be excluded.

That's because `loc`'s default behavior is to include both ends. `iloc`, like normal Python slicing, excludes the end position.

| | Based on | End |
| --- | --- | --- |
| `loc` | index label | included |
| `iloc` | position | excluded |

You can also pass an array into `loc`.

```python
sales.loc[["월", "수", "금"]]
```

```txt
월    120
수    130
금     75
Name: 일별_판매량, dtype: int64
```

The result isn't just the values — it comes back as a Series.

You can also leave one side empty.

```python
sales.loc[:"목"]   # from the beginning through Thursday
sales.loc["수":]   # from Wednesday to the end
```

## Conditional filtering

I tried this with a Series of scores. (The names below are placeholders, not actual values.)

Regular Python array-like data types can't use comparison operators, but Series can.

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

The index and `name` stay the same for this Series object, but only the `dtype` comes out as `bool`.

You can pass this result straight into the brackets.

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

### Not and, but &

I tried finding scores that are at least 80 but under 90, but `and` doesn't work. That's because `and` only operates on boolean types. Between Series, you use bitwise operators instead.

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

In place of `or` you use `|`. Negation is `~`.

```python
scores.loc[(scores >= 80) & (scores < 90)]
scores[~(scores >= 80)]   # only scores under 80
```

You can also pull the condition out into a variable and write `scores.loc[condition]`.

Pulling out only the true values, or only the false ones, like this is called filtering or masking.

### Brackets work too — so why use loc?

Writing `scores[scores >= 80]` directly on the instance also gives you the values. But above, I used `scores.loc[...]` instead.

If you're just reading values, it doesn't matter — you can write it directly on the instance. Still, it's apparently good practice to get used to using `loc`. **It's to remove ambiguity.** Brackets can be read as either position or label depending on the situation, but `loc` nails it down as a label.

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

Looking at it, the result is the same as combining two conditions with `&`. The output being a boolean Series is also the same, so to actually pull out the values you need to wrap it once more, like `scores.loc[scores.between(74, 88)]`.

Whether both ends are included is decided by `inclusive`.

```python
scores.loc[scores.between(74, 88, inclusive="right")]

# only 88 is included, 74 is excluded
# left · right · both · neither
```

You can pass an array into `isin()`.

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

To see which values are `True`, you wrap it once more, just like with `between`.

```python
nums[nums.isin([2, 4, 6])]
```

Only the matching values come out as a Series.

### Strings

Since strings are objects, there's a set of functions under `.str`.

```python
fruits.str.startswith("a")        # boolean Series
fruits.loc[fruits.str.startswith("a")]
```

```txt
0      apple
4    avocado
dtype: str
```

## Aggregating with a boolean Series

Python internally treats boolean values as integers. `True` is 1, `False` is 0. So you can use a mask directly in aggregation.

Say there are 100 students, and a score of 80 or above counts as passing. Then the number of passing students is the sum of the mask.

```python
print(f"Number who passed = {(scores >= 80).sum()}")
# Number who passed = 5

print(f"Pass rate = {(scores >= 80).mean()}")
# Pass rate = 0.7142857142857143

print(f"Did anyone get a perfect score? = {(scores == 100).any()}")
# True

print(f"Did everyone score 60 or above? = {(scores >= 60).all()}")
# True
```

It didn't click at first that `mean()` turns into a ratio, but since it's the average of 1s and 0s, it does work out to a proportion.

## Things to study further

- **When to check `shape`** — Now that I know slicing can silently return an empty Series, I need to figure out at what point in an actual analysis checking `shape` should become a habit. Also whether there's a separate way to check if an intermediate result is empty.
- **Why `loc` includes the end** — I suspect it's because it's a label, not a position, so "the next one" isn't well-defined, but I need to confirm this ([pandas indexing docs](https://pandas.pydata.org/docs/user_guide/indexing.html))
- **Are the parentheses required when using `&`** — What happens if you drop the parentheses in `(scores >= 80) & (scores < 90)`. Seems like an operator precedence issue.
- **`between` vs. `&`** — If the results are the same, is it just a matter of readability, or is there a difference in performance or how missing values are handled?
- **What functions are available under `.str`** — besides `startswith`, things like `contains` and `replace`. Also whether it accepts regular expressions ([pandas string handling](https://pandas.pydata.org/docs/user_guide/text.html))
- **How `sum()` counts missing values** — What happens to the total if `NaN` gets mixed into a mask. [Since I saw in #2 that mismatched indexes produce `NaN`](/en/posts/data-analysis-02-pandas-series), it seems like that could happen in a mask too.