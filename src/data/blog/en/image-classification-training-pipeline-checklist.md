---
title: "Image Classification Training Pipeline — An 11-Step Checklist"
description: "I abstracted the training flow I learned yesterday through the NDT hands-on exercise into a step-by-step checklist applicable to any image classification problem. Along with small questions like why normalization is needed."
pubDatetime: 2026-05-21T01:30:00Z
tags:
  - 머신러닝
  - 딥러닝
  - pytorch
  - 워크플로우
  - 학습
draft: false
featured: false
---

After finishing the [NDT defect classification exercise](./ndt-defect-classification-pytorch-resnet18) yesterday, I distilled the same flow into a domain-agnostic checklist. Next time I start a different image classification task, I can follow this without missing a step.

## Table of contents

## The 11-Step Checklist

```
1.  환경 설정 (GPU, 시드 고정, 라이브러리)
2.  데이터셋 로딩 + 검수 (클래스별 개수 확인)
3.  EDA — 샘플 이미지 시각화
4.  전처리 정의 (리사이즈, 정규화, 증강)
5.  데이터 분할 (학습 / 검증 / 테스트)
6.  모델 준비 (구조 정의, 전이학습이면 가중치 로드)
7.  학습 설정 (손실 함수, 옵티마이저, 학습률)
8.  학습 + 매 에폭 검증 → 학습 곡선 확인
9.  테스트 평가 (정확도, Confusion Matrix, precision/recall)
10. Grad-CAM 으로 판단 근거 시각적 검증
11. 저장 + 추론 속도·모델 크기 측정 → 필요 시 양자화
```

## Key Points for Each Step

### 1. Environment Setup

- **Check GPU availability** (`torch.cuda.is_available()`)
- **Fix the seed** — for `random`, `numpy`, and `torch` all. This is essential for reproducibility.
- Organize library imports

### 2. Dataset Loading + Inspection

**Always print out the count per class** to confirm the data loaded correctly. Class imbalance has a decisive effect on how you interpret training results. Labeling mistakes are also often caught at this stage.

### 3. EDA — Look With Your Own Eyes First

```
- 각 클래스의 샘플 이미지를 그리드로 시각화
- 사람 눈에도 클래스가 구분되는가?
- 잘못 라벨링된 이미지는 없는가?
- 데이터 파이프라인이 정상 동작하는가?
```

If a human can't tell the classes apart, the model probably can't either. Doing EDA before training saves time by letting you gauge this possibility upfront.

### 4. Defining Preprocessing — Resize / Normalize / Augment

- **Resize**: Match the model's input size (ResNet-family models typically use 224×224).
- **Normalize**: Rescale pixel values into a distribution that's easier for the model to learn from. (Explained separately below.)
- **Augment**: Rotation, flipping, slight brightness variation, etc. **Apply only to the training set**, not to validation/test.

#### Why Is Normalization Necessary?

One-line summary: **It's the process of rescaling pixel value ranges into a form that's easier for the model to learn.**

Raw pixels are integers in the 0–255 range. Feeding them in as-is causes problems:

- Values are skewed to one side instead of centered near 0 → **gradient descent converges slower and less stably**.
- If channel statistics differ, training becomes unstable even for the same model.

Normalizing values to cluster **near 0 lets gradient descent converge faster and more stably**. When using an ImageNet-pretrained model, the standard practice is to normalize using the mean and standard deviation the model was originally trained with (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`).

### 5. Data Splitting

Train / validation / test ratios are typically 7:1:2 or 8:1:1. Using a **stratified split** that preserves class ratios prevents the split itself from becoming imbalanced.

### 6. Preparing the Model

- Define the model architecture (write it yourself or use a standard architecture)
- **For transfer learning, load pretrained weights** + replace only the final classifier layer to match your class count

### 7. Training Configuration

- **Loss function**: CrossEntropyLoss is typical for multi-class classification.
- **Optimizer**: Choose among SGD / Adam / AdamW.
- **Learning rate**: Too high causes divergence; too low causes slow convergence. Using a scheduler (StepLR, CosineAnnealing, etc.) makes training more stable.

### 8. Training + Per-Epoch Validation

**Evaluate on the validation set every epoch during training** and plot the learning curves.

```
- Train과 Val이 함께 내려가면: 학습 잘 되는 중
- Train만 내려가고 Val은 올라가면: 과적합 시작 — early stopping 검토
- 둘 다 정체되면: 학습률 조정 또는 모델 변경 필요
```

### 9. Test Evaluation

- **Accuracy** is just a starting point.
- Use a **confusion matrix** to see which classes get confused with which.
- **Precision / Recall / F1** — essential when there's class imbalance or when FN/FP asymmetry matters in the domain.

Which metric matters more depends on the domain. If missing a defect (FN) is critical, as in NDT, focus on recall; if false positives (FP) hurt user experience, as in ad classification, focus on precision.

### 10. Visual Verification With Grad-CAM

Check with a heatmap whether **the model actually looked at the location of the defect/object when making its decision**. Even with high accuracy, if the model activates on background or edges, it may have "gotten it right by accident." For real-world deployment, verifying **the reliability of the model's basis for judgment** matters beyond simple accuracy.

### 11. Saving + Performance Measurement → Quantization If Needed

- Save the model file (`.pt` or `.pth`)
- **Inference speed** (average ms per single image, FPS)
- **Model size** (MB)
- For embedded/mobile deployment targets, convert to INT8/FP16 via **quantization** — this significantly improves size and speed but may cause accuracy loss. Treat this as an additional step.

## Summary

These 11 steps stay largely the same whether the domain is NDT, medical imaging, or general classification. **What changes is the data characteristics in steps 1–3, and the domain-specific key metrics in step 9.** Everything else can effectively be templated.

## Things to Study Further

### 1. Types of Normalization / Standardization

- Simple [0,1] scaling vs. Z-score standardization vs. using ImageNet statistics — when to use each
- The differences between Batch Normalization, Layer Normalization, and Instance Normalization
- Reference: [PyTorch Normalization docs](https://pytorch.org/docs/stable/nn.html#normalization-layers)

### 2. Characteristics of Different Optimizers

- SGD + momentum: simple and stable, known to be a good choice for large datasets
- Adam / AdamW: fast convergence, less sensitive to hyperparameters — though there's empirical evidence that SGD wins on generalization performance
- When to choose which, and how to tune the learning rate alongside it

### 3. Learning Rate Scheduling

- StepLR (decay at fixed intervals)
- CosineAnnealing (decay following a cosine curve)
- ReduceLROnPlateau (automatic decay when a validation metric plateaus)
- Combining with a warmup phase

### 4. Cross-Validation

- Using k-fold CV instead of a simple split to improve evaluation robustness when data is scarce
- The need for stratified k-fold

### 5. Quantization — What I Postponed From Yesterday's NDT Post

- PTQ (Post-Training Quantization) vs. QAT (Quantization-Aware Training)
- How much accuracy drops after INT8 quantization, and which models lose more or less
- The flow of exporting to ONNX to deploy on mobile/edge devices

## Reflection

Doing the same task twice taught me something: **the first time was "a record of working immersed in the domain," but the second pass of organizing it is an abstraction one level up from that.** Only after passing through the domain-specific details once did the universal flow become visible.

Next time I start a new image classification task, I plan to keep this checklist by my side. And by separately collecting how each step diverges depending on the domain, I think I can build a more generalized sense of the machine learning workflow.