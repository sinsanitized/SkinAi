# SkinAI

SkinAI is a structured AI inference pipeline for skincare analysis that takes a user-submitted face photo, extracts observable skin signals, retrieves related context, and returns schema-validated skincare recommendations with safety-aware controls.

This project is not a thin wrapper around a chat model. It is a multi-stage AI pipeline designed to make image-driven recommendations more consistent, auditable, and product-ready.

## Problem

Most AI skincare demos follow the same pattern:

- send an image to an LLM
- ask for advice in plain English
- render whatever text comes back

That approach is easy to build, but hard to trust:

- outputs are inconsistent
- recommendations are difficult to validate
- user preferences are easy for the model to ignore
- safety constraints are hard to enforce
- retrieval and product context are usually missing

## Solution

SkinAI treats skincare analysis like a structured AI system instead of a one-shot prompt.

It combines:

- image preprocessing for stable model inputs
- image-to-text embeddings for retrieval
- optional Pinecone-backed context injection
- structured prompt construction with explicit safety and preference controls
- strict JSON parsing
- output normalization and validation
- fallback behavior when the model is incomplete or non-compliant

The result is a system that is easier to reason about, easier to extend, and much more portfolio-ready than a naive “call GPT and return text” prototype.

## Key Features

- Photo-based skin analysis focused on observable traits rather than diagnosis
- Structured JSON output for predictable rendering and downstream validation
- Support for user controls such as `goals`, `age`, `valueFocus`, `fragranceFree`, `pregnancySafe`, and `sensitiveMode`
- Retrieval-augmented generation (RAG) using embeddings + Pinecone context search
- Safety-aware compliance layer for pregnancy-safe and fragrance-free modes
- Output normalization to preserve a stable response shape when the model is imperfect
- Human-readable explanation layer for skin type, product benefits, and product stacking
- Monorepo layout with shared types between frontend and backend

## Product Outcome

Given a face photo, SkinAI returns:

- estimated skin type with confidence
- visible skin concerns with supporting evidence
- ingredient recommendations with cautions
- product picks aligned to observed issues and user preferences
- a practical AM/PM/weekly routine
- conflict warnings for ingredient combinations
- a plain-language explanation of why the plan makes sense

## 🧴 Example User Outcome

### Input

User uploads a photo showing:

- active acne around the chin and cheeks
- visible redness after breakouts
- early dehydration from overuse of harsh actives

User preferences:

- `goals`: "reduce acne marks and calm redness"
- `age`: `29`
- `valueFocus`: `best_value`
- `fragranceFree`: `true`
- `pregnancySafe`: `false`
- `sensitiveMode`: `true`

### Structured JSON Output

```json
{
  "skinType": {
    "type": "Combination / Acne-prone",
    "confidence": 0.86
  },
  "explanation": {
    "skinTypeExplanation": "Your skin shows oilier congestion in the central face with more reactive areas around the cheeks, which is consistent with a combination acne-prone pattern.",
    "productBenefits": [
      "The routine emphasizes barrier-friendly anti-inflammatory ingredients so redness and post-acne marks improve without pushing the skin too hard.",
      "The selected products focus on high-value actives and lower-irritation textures, which fits both sensitive mode and a best-value preference."
    ],
    "layeringGuide": [
      "Use cleanser first, then watery layers, then treatment serum, then moisturizer.",
      "Keep active treatments before moisturizer unless a product specifically instructs otherwise.",
      "In the morning, sunscreen should always be the final layer."
    ]
  },
  "concerns": [
    {
      "name": "Post-inflammatory erythema (PIE)",
      "severity": "Moderate",
      "confidence": 0.78,
      "evidence": "Red post-breakout marks visible across the cheeks."
    },
    {
      "name": "Barrier impairment",
      "severity": "Mild",
      "confidence": 0.65,
      "evidence": "Diffuse redness and dryness suggest the barrier may be stressed."
    }
  ],
  "ingredients": [
    {
      "ingredient": "Azelaic acid",
      "reason": "Supports redness reduction and post-breakout mark improvement while remaining relatively gentle.",
      "cautions": [
        "Start slowly if skin feels tight or reactive."
      ]
    },
    {
      "ingredient": "Ceramides",
      "reason": "Help restore barrier function and reduce irritation from overactive routines.",
      "cautions": []
    }
  ],
  "products": [
    {
      "name": "SoonJung 2x Barrier Intensive Cream",
      "brand": "Etude",
      "category": "Moisturizer",
      "why": "Supports barrier repair and reduces irritation load.",
      "howToUse": "Use after treatment steps, especially on barrier nights.",
      "cautions": [
        "Reduce frequency of actives if burning develops."
      ],
      "tags": [
        "barrier",
        "fragrance-free"
      ]
    }
  ],
  "routine": {
    "AM": [
      "Cleanser - daily - use a gentle wash if skin feels oily on waking",
      "Serum - every other morning - use azelaic acid if skin is calm",
      "Moisturizer - daily - use a thin layer if skin feels balanced",
      "Sunscreen - daily - final morning step"
    ],
    "PM": [
      "Cleanser - daily - remove sunscreen and surface oil",
      "Treatment serum - 2x-week to start - skip if stinging",
      "Moisturizer - daily - barrier-support final step"
    ],
    "weekly": [
      "Daily base (AM): cleanse, azelaic acid when tolerated, moisturize, sunscreen",
      "Daily base (PM): cleanse, treatment only on scheduled nights, moisturize",
      "Active cycle (Mon–Sun): Mon treatment | Tue barrier | Wed barrier | Thu treatment | Fri barrier | Sat barrier | Sun barrier",
      "Ramp-up (4 weeks): Weeks 1–2 once weekly; Weeks 3–4 twice weekly if calm; Maintenance based on tolerance",
      "Rules: pause actives and return to cleanser + moisturizer only if irritation rises"
    ]
  },
  "conflicts": [],
  "disclaimers": [
    "Fragrance-free mode was applied.",
    "This routine is educational and not medical advice."
  ],
  "timestamp": "2026-03-22T14:00:00.000Z"
}
```

### Human-Readable Outcome

The user receives more than a generic paragraph. They get:

- a condition classification: combination / acne-prone skin
- severity signals: moderate post-breakout redness, mild barrier stress
- a practical AM/PM routine they can follow immediately
- targeted ingredients like azelaic acid and ceramides
- a confidence score indicating how strongly the model supports the classification
- a plain-language explanation of why each recommendation was chosen

That is the product value: a user can go from “my skin looks irritated and breakout-prone” to “here is a structured routine, here is why it fits my skin, and here is how to use it.”

## Architecture Overview

SkinAI is built as a monorepo with a React frontend, Express API, and shared TypeScript contracts.

### Monorepo Structure

```text
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── config
│   │   │   ├── controllers
│   │   │   ├── middleware
│   │   │   ├── models
│   │   │   ├── routes
│   │   │   ├── services
│   │   │   └── utils
│   └── web
│       └── src
│           ├── components
│           ├── pages
│           ├── services
│           └── styles
└── packages
    ├── shared-types
    └── utils
```

### Logical Backend Modules

Even though the backend is intentionally compact, it already separates the AI system into clear responsibilities:

- `controllers/skin.controller.ts`
  Handles request orchestration and API response lifecycle
- `services/imageProcessing.service.ts`
  Normalizes uploaded images before they reach the model
- `services/openai.service.ts`
  Owns prompt construction, model calls, parsing, compliance checks, and fallback logic
- `services/pinecone.service.ts`
  Handles retrieval and vector persistence
- `middleware/imageUploadValidation.ts`
  Rejects invalid uploads before model work begins
- `models/SkinAnalysisLog.model.ts`
  Stores analysis metadata for observability and auditability
- `packages/shared-types`
  Defines the output contract shared between frontend and backend

## System Architecture

### End-to-End Flow

```text
User Input
   |
   v
Frontend Form + Photo Upload
   |
   v
API Validation
   |
   v
Image Preprocessing
   |
   v
Vision Description -> Embedding Generation
   |
   v
Vector Retrieval (Pinecone, optional)
   |
   v
Prompt Construction
   |
   v
LLM Structured Generation
   |
   v
JSON Parsing + Validation + Preference Compliance
   |
   v
Sanitization / Fallback Handling
   |
   v
Structured Output + UI Rendering
```

## 🚫 Not Just Another GPT Wrapper

Typical AI demos stop at:

- upload input
- send it to an LLM
- render raw text

That approach is fast to build, but weak as a system:

- outputs are unstructured
- malformed responses break the UI
- hallucinations are harder to detect
- user safety controls are easy to ignore
- there is no consistent contract between backend and frontend

SkinAI is explicitly engineered to avoid that pattern.

This system:

- uses retrieval-augmented generation (RAG) to ground recommendations in retrieved context
- enforces a schema-validated JSON contract instead of returning arbitrary prose
- validates outputs before sending them to the frontend
- normalizes missing fields into a stable structure
- sanitizes unsafe or preference-violating content instead of trusting the model blindly

The result is a production-minded AI system, not a generic GPT wrapper with a skincare prompt.

### Why Each Step Exists

#### 1. User Input

Inputs include:

- face image
- free-text goals
- age
- value preference
- fragrance-free mode
- pregnancy-safe mode
- sensitive mode

Why it exists:

- captures product-level preferences without forcing the model to infer everything from the image
- gives the system controllable levers for personalization

#### 2. Image Preprocessing

The backend resizes and normalizes the uploaded image before inference.

Why it exists:

- reduces variation from extreme image sizes
- avoids unnecessary token and bandwidth cost
- creates more consistent model inputs

#### 3. Embeddings

The system first asks the model to describe visible skin features, then embeds that description.

Why it exists:

- converts image observations into a searchable semantic representation
- supports retrieval without indexing raw image pixels
- makes RAG feasible for a multimodal application

#### 4. Retrieval

The embedding is used to fetch similar prior context from Pinecone.

Why it exists:

- grounds generation in related analysis history
- reduces purely-from-scratch recommendation behavior
- helps the model stay closer to existing product and concern patterns

#### 5. Prompt Construction

The prompt blends:

- observed image context
- user controls
- retrieval context
- strict output requirements
- safety requirements

Why it exists:

- creates deterministic expectations for the model
- makes product behavior explainable
- encodes business logic and safety rules close to the inference layer

#### 6. LLM Generation

OpenAI generates a strict JSON response that includes skin assessment, routine, product picks, warnings, and explanation text.

Why it exists:

- enables rich reasoning over image + preferences + retrieved context
- preserves flexibility without losing schema structure

#### 7. Validation

The system parses JSON, checks structure, enforces user preference compliance, and normalizes missing fields.

Why it exists:

- reduces malformed output risk
- prevents invalid responses from propagating to the UI
- keeps the frontend predictable

#### 8. Safe Fallback Behavior

If the model output is imperfect but still usable, the backend sanitizes and annotates it instead of failing the request.

Why it exists:

- improves reliability under real-world model variance
- prevents avoidable 500s
- reduces user-facing failure without silently ignoring constraints

## Structured Output Schema

The backend returns a typed `SkinAnalysisResponse` defined in `packages/shared-types`.

### JSON Shape

```jsonc
{
  "skinType": {
    "type": "Combination / Acne-prone", // model-selected skin type enum
    "confidence": 0.86 // heuristic confidence score from model output
  },
  "explanation": {
    "skinTypeExplanation": "Your skin shows both oilier T-zone behavior and breakout-prone areas, which points to a combination acne-prone profile.",
    "productBenefits": [
      "The cleanser and moisturizer pair are meant to reduce barrier stress while keeping congestion under control.",
      "The serum and sunscreen choices target post-acne marks and reduce further irritation-driven darkening."
    ],
    "layeringGuide": [
      "Apply cleanser first, then any watery layers, then treatment serum, then moisturizer.",
      "Use thinner textures before thicker creams to reduce pilling and help active layers absorb evenly.",
      "Finish every AM routine with sunscreen as the last step."
    ]
  },
  "concerns": [
    {
      "name": "Post-inflammatory hyperpigmentation (PIH)",
      "severity": "Moderate",
      "confidence": 0.79,
      "evidence": "Visible post-acne marks concentrated on the cheeks and jawline."
    }
  ],
  "ingredients": [
    {
      "ingredient": "Azelaic acid",
      "reason": "Useful for redness, acne, and post-acne marks with relatively good tolerability.",
      "cautions": ["Start slowly if skin is reactive."]
    }
  ],
  "products": [
    {
      "name": "Relief Sun",
      "brand": "Beauty of Joseon",
      "category": "Sunscreen",
      "why": "Supports daily UV protection while staying cosmetically wearable.",
      "howToUse": "Use as the last AM step.",
      "cautions": ["Reapply when outdoors."],
      "tags": ["daily", "barrier-friendly"]
    }
  ],
  "routine": {
    "AM": [
      "Cleanser - daily - use a gentle wash if skin feels oily on waking",
      "Sunscreen - daily - final morning step"
    ],
    "PM": [
      "Cleanser - daily - remove sunscreen and debris",
      "Treatment serum - 2x-week to start - skip if stinging"
    ],
    "weekly": [
      "Daily base (AM): cleanse, moisturize if needed, sunscreen",
      "Daily base (PM): cleanse, treat if scheduled, moisturize",
      "Active cycle (Mon–Sun): Mon treatment | Tue barrier | Wed treatment | Thu barrier | Fri treatment | Sat barrier | Sun barrier",
      "Ramp-up (4 weeks): Weeks 1–2 once or twice weekly; Weeks 3–4 increase if tolerated; Maintenance as tolerated",
      "Rules: stop and simplify if irritation builds"
    ]
  },
  "conflicts": [
    {
      "ingredients": ["Retinoid", "AHA"],
      "warning": "Avoid combining on the same night unless tolerance is already established."
    }
  ],
  "disclaimers": [
    "This is not medical advice."
  ],
  "timestamp": "2026-03-22T14:00:00.000Z"
}
```

### Field Intent

- `skinType`
  High-level classification used to guide routine intensity and product balance
- `explanation`
  Human-readable reasoning layer for trust, education, and product comprehension
- `concerns`
  Observable issues with evidence to reduce hand-wavy recommendations
- `ingredients`
  Mechanism-level recommendations rather than only product names
- `products`
  Actionable product slots tied to real usage instructions
- `routine`
  Ordered application steps plus weekly cadence
- `conflicts`
  Explicit risk communication for ingredient stacking
- `disclaimers`
  Safety and fallback transparency
- `timestamp`
  Basic auditability and freshness marker

## Trust & Reliability Layer

SkinAI includes several reliability controls intended to reduce hallucinations and unstable UX:

### Confidence Signaling

The response includes a `skinType.confidence` score so the UI can communicate uncertainty instead of presenting every classification as equally certain.

This is not a calibrated medical probability. It is an inference confidence signal intended to:

- communicate ambiguity to the user
- discourage over-trust in weak image conditions
- support future reliability improvements such as heuristic or benchmark-based calibration

### 1. Prompt Constraining

The prompt enforces:

- exact JSON output
- known skin type enums
- product slot coverage
- weekly plan structure
- preference-specific constraints

### 2. Output Parsing

The backend extracts and parses JSON from the model response instead of trusting arbitrary text.

### 3. Schema Normalization

If optional sections are missing, the API fills them with stable defaults so the frontend never needs to guess.

### 4. Preference Compliance

The system checks generated output against critical user preferences such as:

- pregnancy-safe mode
- fragrance-free mode
- allowed `valueFocus` enum
- valid age range

### 5. Safe Fallback

When the model returns something imperfect:

- the API sanitizes non-compliant content where possible
- adds disclaimers for transparency
- returns a stable result instead of failing outright

### 6. Retrieval Grounding

Pinecone context injection reduces fully ungrounded generation and helps align recommendations to prior analysis patterns.

### Hallucination Reduction Strategy

SkinAI reduces hallucination risk through multiple layers rather than relying on prompt phrasing alone:

- retrieved context narrows the model’s search space
- structured output requirements prevent rambling free text
- preference compliance checks catch obvious unsafe content
- normalization and fallback handling avoid brittle UI behavior

This does not eliminate hallucinations entirely, but it significantly improves reliability compared with a raw chat response.

### Non-Medical Scope

SkinAI is not a diagnostic or medical system. It focuses on visible skincare-related observations and routine suggestions, and it should not be treated as a substitute for clinical evaluation.

## Example Input / Output

### Sample Input

```json
{
  "image": "face-photo.jpg",
  "goals": "reduce acne marks and calm redness",
  "age": 29,
  "valueFocus": "best_value",
  "fragranceFree": true,
  "pregnancySafe": false,
  "sensitiveMode": true
}
```

### Sample Structured Output

```json
{
  "skinType": {
    "type": "Combination / Acne-prone",
    "confidence": 0.86
  },
  "explanation": {
    "skinTypeExplanation": "Your skin shows oilier congestion in the central face with more reactive areas around the cheeks, which is consistent with a combination acne-prone pattern.",
    "productBenefits": [
      "The routine emphasizes barrier-friendly anti-inflammatory ingredients so redness and post-acne marks improve without pushing the skin too hard.",
      "The selected products focus on high-value actives and lower-irritation textures, which fits both sensitive mode and a best-value preference."
    ],
    "layeringGuide": [
      "Use cleanser first, then watery layers, then treatment serum, then moisturizer.",
      "Keep active treatments before moisturizer unless a product specifically instructs otherwise.",
      "In the morning, sunscreen should always be the final layer."
    ]
  },
  "concerns": [
    {
      "name": "Post-inflammatory erythema (PIE)",
      "severity": "Moderate",
      "confidence": 0.78,
      "evidence": "Red post-breakout marks visible across the cheeks."
    }
  ],
  "ingredients": [
    {
      "ingredient": "Azelaic acid",
      "reason": "Supports redness reduction and post-breakout mark improvement while remaining relatively gentle.",
      "cautions": [
        "Start slowly if skin feels tight or reactive."
      ]
    }
  ],
  "products": [
    {
      "name": "SoonJung 2x Barrier Intensive Cream",
      "brand": "Etude",
      "category": "Moisturizer",
      "why": "Supports barrier repair and reduces irritation load.",
      "howToUse": "Use after treatment steps, especially on barrier nights.",
      "cautions": [
        "Reduce frequency of actives if burning develops."
      ],
      "tags": [
        "barrier",
        "fragrance-free"
      ]
    }
  ],
  "routine": {
    "AM": [
      "Cleanser - daily - use a gentle wash if skin feels oily on waking",
      "Serum - every other morning - use azelaic acid if skin is calm",
      "Moisturizer - daily - use a thin layer if skin feels balanced",
      "Sunscreen - daily - final morning step"
    ],
    "PM": [
      "Cleanser - daily - remove sunscreen and surface oil",
      "Treatment serum - 2x-week to start - skip if stinging",
      "Moisturizer - daily - barrier-support final step"
    ],
    "weekly": [
      "Daily base (AM): cleanse, azelaic acid when tolerated, moisturize, sunscreen",
      "Daily base (PM): cleanse, treatment only on scheduled nights, moisturize",
      "Active cycle (Mon–Sun): Mon treatment | Tue barrier | Wed barrier | Thu treatment | Fri barrier | Sat barrier | Sun barrier",
      "Ramp-up (4 weeks): Weeks 1–2 once weekly; Weeks 3–4 twice weekly if calm; Maintenance based on tolerance",
      "Rules: pause actives and return to cleanser + moisturizer only if irritation rises"
    ]
  },
  "conflicts": [],
  "disclaimers": [
    "Fragrance-free mode was applied.",
    "This routine is educational and not medical advice."
  ],
  "timestamp": "2026-03-22T14:00:00.000Z"
}
```

### Human-Readable Interpretation

This user likely has combination, breakout-prone skin with redness and post-inflammatory marks. The system recommends a lower-irritation routine built around barrier support and azelaic acid, keeps the weekly schedule conservative because `sensitiveMode` is enabled, and filters recommendations through a best-value preference instead of defaulting to the cheapest products.

## How It Works

### AI Pipeline

1. User uploads a face photo and selects optional preferences.
2. Backend validates the upload and preprocesses the image.
3. The system generates a structured visual description of the skin.
4. That description is embedded into a vector.
5. Pinecone retrieval returns related prior analysis context when available.
6. Prompt construction merges image findings, retrieval context, and user preferences.
7. OpenAI returns structured JSON.
8. Backend parses, validates, normalizes, and sanitizes the result.
9. Frontend renders both structured output and a human explanation layer.

## 🧠 Design Decisions

### Why RAG Instead of Fine-Tuning?

- easier to iterate on than a custom fine-tuned model
- allows lightweight grounding using retrieved prior analyses
- keeps the system adaptable as product catalog or skincare logic changes

System design tradeoff:

- RAG adds retrieval latency and infrastructure complexity
- fine-tuning could reduce prompt size, but would be slower to iterate on and harder to keep aligned with changing product logic

For this product stage, retrieval provides a better reliability-to-complexity tradeoff.

### Why Structured Output?

- frontend rendering becomes deterministic
- validation becomes possible
- recommendations can be audited
- reviewers can inspect concrete system contracts

System design tradeoff:

- structured output is more constraining than free-form text
- the prompt must work harder to keep responses rich and natural

That tradeoff is worthwhile because production systems need contracts, not just eloquent responses.

### Why a Validation Layer?

- LLMs are probabilistic
- model output can be malformed or incomplete
- user safety preferences should not rely on prompt obedience alone

System design tradeoff:

- validation logic adds implementation complexity
- some imperfect outputs need normalization or sanitization

That complexity is deliberate. It is what turns an interesting demo into a more reliable AI product.

### Why Fallback Instead of Hard Failure?

- a partially sanitized result is often better UX than a 500
- reliability matters more than perfect prose
- portfolio projects look stronger when failure handling is explicit

### Latency vs Reliability

The system makes explicit tradeoffs between speed and robustness:

- image preprocessing adds work, but improves model input consistency
- retrieval adds cost, but improves grounding
- schema validation adds engineering complexity, but prevents malformed output from leaking into the UI
- fallback handling favors returning a safe, structured response over failing the request

This is the core design philosophy of the project: controlled reliability over naive speed.

## Tech Stack

### Frontend

- React 19
- Vite / Rolldown-Vite
- TypeScript
- React Router

### Backend

- Node.js
- Express
- TypeScript
- OpenAI API
- Sharp for image preprocessing
- Multer for multipart uploads

### Retrieval / Data

- Pinecone for vector search
- MongoDB / Mongoose for optional analysis logging

### Shared Contracts

- workspace-based monorepo
- shared TypeScript schema in `packages/shared-types`

## Running Locally

### Prerequisites

- Node.js 18+
- npm 9+
- OpenAI API key
- optional MongoDB instance
- optional Pinecone index + API key

### Install

```bash
npm install
```

### Environment

Create `apps/api/.env`:

```bash
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your_key_here

# Optional
MONGODB_URI=mongodb://localhost:27017/skinai
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=skinai
USE_PINECONE=true
SKIP_DB=true
```

The API loads `apps/api/.env` first and falls back to the repo-root `.env` if present.

### Start the System

```bash
npm run dev
```

Endpoints:

- frontend: `http://localhost:5173`
- API: `http://localhost:3000`

### Validation / Build

```bash
npm run type-check
npm run build
npm test
```

## API

### `GET /api/health`

Returns service health information.

### `POST /api/skin/analyze`

Multipart form-data:

- `image` required
- `goals` optional
- `age` optional
- `valueFocus` optional
- `fragranceFree` optional
- `pregnancySafe` optional
- `sensitiveMode` optional

## Future Improvements

- stronger product catalog grounding with normalized brand / ingredient metadata
- evaluation harness for prompt quality and safety regression testing
- richer confidence scoring backed by calibration heuristics
- explainable retrieval traces in the API response
- product availability / pricing integration for real value-aware ranking
- clinician review mode or escalation path for higher-risk visual patterns
- anonymized offline benchmark set for pipeline evaluation

## Portfolio Value

SkinAI demonstrates:

- multimodal prompt engineering
- retrieval-augmented generation
- structured output contracts
- post-generation validation and compliance handling
- product-oriented safety and reliability design
- full-stack implementation with shared schemas

This is the kind of project that signals AI systems thinking, not just familiarity with model APIs.
