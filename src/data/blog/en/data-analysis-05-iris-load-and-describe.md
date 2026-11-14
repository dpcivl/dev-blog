---
title: "Data Analysis Study #5 — pandas read_csv took the first row as column names"
description: "I started actual analysis with the Iris dataset. As soon as I read the csv, the column names were broken, and I had to fix it with skiprows and header. I cover what to look at in descriptive statistics, and why you copy the original before attaching derived variables."
pubDatetime: 2026-09-01T09:40:00Z
tags:
  - K-뉴딜아카데미
  - 데이터분석공부
  - pandas
  - python
  - 학습
draft: false
featured: false
---

I moved on to actual analysis with the Iris dataset. The instructor shared the csv that's available from scikit-learn, so I used that. Thanks to the Rainbow CSV extension I'd already installed, it was easy to read since the columns were color-coded.

## Table of contents

## Reading the csv

Normally in Python, to read a file you'd use `open`, plus `os` or `pathlib`. pandas has `read_csv`, so none of that is needed.

I keep the file location in a variable and pull it out when needed. A variable you create once and never change is called a constant-like variable, and it's usually written in uppercase. I gave the path as a relative path.

```python
df = pd.read_csv(IRIS_CSV_PATH)
```

![read_csv result. The first row was taken as column names, so the header shows 150 · 4 · setosa · versicolor · virginica](/assets/posts/data-analysis-05-iris-load-and-describe/01-read-csv-header-taken.webp)

It did load as a DataFrame, but the table looks off.

## The first row was taken as column names

As I learned in [#4](/en/posts/data-analysis-04-dataframe-basics), I checked `shape` first. The first line of the csv had been taken as column names. Sitting in the header position were `150`, `4`, `setosa`, `versicolor`, `virginica`.

So I made it skip the first line.

```python
df = pd.read_csv(
    IRIS_CSV_PATH,
    skiprows=1,
)
```

But csv still kept trying to treat the first line as a title. This time, the first row of actual data became the column names. You need to set `header` to `None`.

```python
df = pd.read_csv(
    IRIS_CSV_PATH,
    skiprows=1,
    header=None,
)
```

![Result after setting header=None. Column names became numbers 0 through 4, and all 150 rows remained](/assets/posts/data-analysis-05-iris-load-and-describe/02-header-none.webp)

This way, all 150 rows come in without loss. But since there are no column names, you have to give them yourself. The Iris dataset has sepal length and width, petal length and width, and species. Since these values won't change during analysis, I made them a constant-like variable.

```python
IRIS_COLUMNS = [
    "sepal_length", "sepal_width",              # sepal length, width
    "petal_length", "petal_width", "species",   # petal length, width
]

df = pd.read_csv(
    IRIS_CSV_PATH,
    skiprows=1,
    header=None,
    names=IRIS_COLUMNS,
)
```

![Result after giving column names. Shows sepal_length · sepal_width · petal_length · petal_width · species, 150 rows by 5 columns](/assets/posts/data-analysis-05-iris-load-and-describe/03-named-columns.webp)

Now I can call `info()` and `describe()`.

> You can also pull the data directly from scikit-learn instead of getting a csv. After `from sklearn.datasets import load_iris`, call `load_iris()` and put that data into a DataFrame.

## Checking for missing values separately

Even if `df.info()` shows no missing values, it's good to confirm for certain.

```python
df.isna()         # whether each cell is missing
df.isna().sum()   # how many missing values per attribute
```

Adding `sum()` gives you a direct count of missing values per attribute.

Even with `df.sample(n=5)` for random sampling, the sample can be skewed, so you shouldn't judge based on the sample alone.

## describe() even shows species

![describe result. The species column also has descriptive statistics calculated, like mean · std · 25%](/assets/posts/data-analysis-05-iris-load-and-describe/04-describe-includes-species.webp)

`species` shows a mean and standard deviation too. Species is categorical, so descriptive statistics aren't meaningful for it, yet they still get calculated. This is because the values are stored as the numbers `0` · `1` · `2`, so pandas treats them as numeric.

This is the same story as [the identifier trap I learned in #1](/en/posts/data-analysis-01-data-information-insight). Looking like a number doesn't mean it's a quantity.

## What to look at in descriptive statistics

| What | Why | Metrics |
| --- | --- | --- |
| Central tendency | Where the data clusters | mean · median · mode |
| Dispersion | How spread out the data is | variance · standard deviation · quartile |
| Shape of distribution | What shape the data takes | skewness · kurtosis |

- **Mean**: the sum of all values divided by the count
- **Median**: the value exactly in the middle when sorted by size
- **Mode**: the value that appears most frequently
- **Variance**: the average of the squared deviations from the mean
- **Standard deviation**: the positive square root of the variance
- **Quartile**: the value at a position dividing the whole into four parts
- **Skewness**: how much the distribution leans to one side
- **Kurtosis**: how sharp or pointed the distribution is

Looking at these lets you spot outliers.

To see the median of a single column, pull that column out as a Series and call `median()`.

```python
df["sepal_width"].median()
```

```txt
np.float64(3.0)
```

It comes out as `np.float64`, not Python's `float`. I'm told this is for precision.

## Derived variables — keep the original, copy first

I made a derived variable to make the categorical data readable. First, I mapped species numbers to iris names in a dictionary.

The important part is **leaving the original untouched and attaching the derived variable to a copy**. Use `df.copy()`.

There are two kinds of copying.

- Shallow copy — copies only the address (a reference)
- Deep copy — copies the data as well

`df.copy()` creates something entirely new.

Series has `map()`. If you pass in a mapping dictionary, it replaces each value with the string for the corresponding key.

![map result. The 0 · 1 · 2 values in the species column become names like setosa · virginica](/assets/posts/data-analysis-05-iris-load-and-describe/05-map-series.webp)

Putting this into a new column gives a DataFrame with a derived variable attached.

```python
species_df['species_code'] = df['species'].map(species_map)
```

![Result with a derived variable attached. A species_code column was added after the existing 5 columns, making it 150 rows by 6 columns](/assets/posts/data-analysis-05-iris-load-and-describe/06-derived-column.webp)

When computing totals or averages, you can add columns to the DataFrame like this and use them. Now that I know how to attach derived variables, what I've learned so far is enough to start doing analysis.

## Counting by category

To see how many of each category there are, use `value_counts()`.

```python
species_df['species'].value_counts()
```

```txt
species
0    50
1    50
2    50
Name: count, dtype: int64
```

If you want percentages, set `normalize=True`.

```python
species_df['species'].value_counts(normalize=True)
```

## What's still unresolved — "unknown"

If missing values are stored as the string `"unknown"`, they look like missing values to us, but not to the program. Running `isna()` returns `False` for all of them.

I checked this much but didn't get to resolve it.

## Things to study further

- **Handling missing values disguised as strings** — how to turn values that only look missing to a human — like `"unknown"` · `"N/A"` · empty strings — into actually missing values. This is a real-world case of [what I learned in #1 about inconsistent missing-value markers](/en/posts/data-analysis-01-data-information-insight). I heard `read_csv` has an `na_values` argument.
- **Why it comes out as `np.float64`** — I heard it's for precision, but I need to check what actually differs from Python's `float`. This seems to lead into the relationship between numpy types and Python types.
- **How to display a column that's categorical but stored as numbers** — to keep `species` from being included in `describe()`, it seems I'll need to change its dtype. I heard pandas has a `category` dtype ([pandas categorical](https://pandas.pydata.org/docs/user_guide/categorical.html)).
- **How to actually read skewness and kurtosis** — I learned the names and definitions, but I don't know what value counts as "skewed."
- **The relationship between `skiprows` and `header`** — I should write up why I had to give both. Why, with only `skiprows`, does the next line become a header again? ([pandas `read_csv`](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html))
- **Cases where shallow copy causes problems** — I was taught to use `df.copy()`, but I want to reproduce for myself what actually goes wrong if you don't.