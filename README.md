# SkinAI

SkinAI is a structured AI system that transforms unstructured skin inputs into reliable, actionable skincare routines using retrieval-augmented generation and schema-validated outputs.

It is built to demonstrate production-minded AI engineering, not just model API usage:

- structured AI pipeline
- retrieval-augmented generation
- prompt construction with controlled inputs
- schema-validated outputs
- safe fallback behavior
- observability around retrieval, validation, and fallback triggers

## What It Does

Given a face photo and optional user preferences, SkinAI returns:

- estimated skin type with confidence
- visible skin concerns and evidence
- recommended ingredients
- product suggestions
- AM / PM / weekly routine guidance
- conflict warnings
- plain-language explanation of why the routine makes sense

It is explicitly non-diagnostic and intended for skincare guidance, not medical advice.

## 🧴 Example User Outcome

### Input

User concern:

- acne + redness with some dehydration from overuse of harsh actives

User preferences:

```json
{
  "goals": "reduce acne marks and calm redness",
  "age": 29,
  "valueFocus": "best_value",
  "fragranceFree": true,
  "pregnancySafe": false,
  "sensitiveMode": true
}
```

### Structured JSON Output

```json
{
  "skinType": {
    "type": "Combination / Acne-prone",
    "confidence": 0.82
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
      "confidence": 0.64,
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

### Human-Readable Explanation

This user gets more than a generic paragraph. They get:

- a condition classification: combination / acne-prone skin
- severity signals: moderate post-breakout redness and mild barrier stress
- a practical AM / PM routine
- ingredient-level guidance such as azelaic acid and ceramides
- a confidence signal via `skinType.confidence`
- explanation of what the routine is doing and how to layer it

The value is immediate: the system turns an unstructured skin concern into an actionable, reviewable plan.

## 🚫 Not Just Another GPT Wrapper

Typical AI apps:

- send raw input to an LLM
- return unstructured text
- trust the model to behave
- break when the response format drifts

SkinAI takes a different approach:

- uses retrieval-augmented generation (RAG) for grounded responses
- enforces structured JSON schema validation before returning data
- validates outputs with `safeParse(...)` instead of trusting raw model output
- normalizes partial responses into a stable shape
- applies safe fallback behavior when the model pipeline is unreliable

This is a structured AI pipeline with reliability controls, not a prompt-wrapped chatbot.

## 🧠 System Architecture

```text
User Input
  ↓
Preprocessing
  ↓
Embedding + Retrieval
  ↓
Context Injection
  ↓
Prompt Construction
  ↓
LLM
  ↓
Schema Validation
  ↓
Structured Output
```

### Why Each Step Exists

#### 1. User Input

The frontend collects:

- face photo
- goals
- age
- value focus
- fragrance-free mode
- pregnancy-safe mode
- sensitive mode

Why:

- these inputs steer the recommendations when they do not conflict with visible findings
- safety toggles are explicit rather than inferred

#### 2. Preprocessing

Images are resized and normalized before inference.

Why:

- stabilizes inputs
- reduces unnecessary bandwidth and token waste
- gives the model more consistent image payloads

#### 3. Embedding + Retrieval

The system first generates a skin-focused description of the image, then embeds that description for retrieval.

Why:

- image observations become searchable
- prior context can be injected into the prompt
- the generation step is less likely to start from zero-context reasoning

#### 4. Context Injection

Retrieved summaries are inserted as optional weak priors.

Why:

- improves grounding without making retrieval mandatory
- if retrieval is empty or low quality, the system falls back to the base prompt

#### 5. Prompt Construction

Prompt construction combines:

- visible image findings
- user preferences
- safety rules
- retrieval context
- exact output shape

Why:

- gives the model a controlled inference contract
- makes product behavior inspectable

#### 6. LLM

The OpenAI model generates a structured response containing skin classification, concerns, ingredients, products, routine, and explanation.

Why:

- the LLM handles multimodal reasoning while the surrounding pipeline controls the output contract

#### 7. Schema Validation

Responses are parsed, normalized, then validated with a strict runtime schema.

Why:

- malformed outputs are caught before they reach the UI
- partial model responses do not silently become frontend bugs

#### 8. Structured Output

The frontend renders typed data instead of raw text blobs.

Why:

- stable rendering
- clearer debugging
- easier extension into analytics, testing, or downstream services

## 🔍 Retrieval Strategy

SkinAI uses retrieval-augmented generation through vector search in Pinecone.

### Strategy

- the image is first converted into a structured visual description
- that description is embedded using an OpenAI embedding model
- Pinecone retrieval searches for the most similar prior summaries
- only relevant summaries are injected into the prompt

### Retrieval Details

- embedding source:
  image → skin-focused description → embedding vector
- similarity method:
  cosine similarity via Pinecone index metric
- top-k retrieval:
  configured in `PINECONE_CONFIG.topK`
- current implementation:
  filters out low-score or empty summaries before prompt injection

### Why This Matters

Retrieval is not used for novelty. It is used to reduce drift and ground the generation step in prior structured context.

If retrieval is empty or weak:

- the system logs that RAG context was unavailable
- the base prompt still runs safely

## Structured Output Schema

The system returns a typed `SkinAnalysisResponse` and validates it at runtime before returning it to the frontend.

### Example Shape

```jsonc
{
  "skinType": {
    "type": "Combination / Acne-prone",
    "confidence": 0.82
  },
  "explanation": {
    "skinTypeExplanation": "...",
    "productBenefits": ["..."],
    "layeringGuide": ["..."]
  },
  "concerns": [
    {
      "name": "Post-inflammatory erythema (PIE)",
      "severity": "Moderate",
      "confidence": 0.78,
      "evidence": "..."
    }
  ],
  "ingredients": [
    {
      "ingredient": "Azelaic acid",
      "reason": "...",
      "cautions": ["..."]
    }
  ],
  "products": [
    {
      "name": "...",
      "brand": "...",
      "category": "Serum",
      "why": "...",
      "howToUse": "...",
      "cautions": ["..."],
      "tags": ["..."]
    }
  ],
  "routine": {
    "AM": ["..."],
    "PM": ["..."],
    "weekly": ["..."]
  },
  "conflicts": [
    {
      "ingredients": ["...", "..."],
      "warning": "..."
    }
  ],
  "disclaimers": ["..."],
  "timestamp": "2026-03-22T14:00:00.000Z"
}
```

### Runtime Validation

The API enforces runtime schema validation with Zod:

```ts
const result = skinAnalysisResponseSchema.safeParse(modelOutput);

if (!result.success) {
  // return safe fallback response
}
```

This prevents malformed raw model output from being treated as trustworthy application data.

## 🛡️ Trust & Reliability

SkinAI includes multiple reliability layers:

### Confidence Signal

The current confidence signal is exposed as `skinType.confidence`.

This is heuristic model confidence, not a calibrated medical probability. It exists to:

- communicate uncertainty
- avoid falsely authoritative UX
- create room for future calibration work

### How Hallucinations Are Reduced

Hallucination reduction is handled systemically:

- retrieval grounds generation in prior context
- prompt constraints force deterministic structure
- schema validation rejects malformed outputs
- preference compliance checks catch obvious unsafe content
- fallback behavior prevents brittle failures

### Safe Fallback Behavior

The system never relies on a happy path only.

Handled explicitly:

- retrieval returns empty or irrelevant results
  - proceed with base prompt only
- model returns malformed JSON
  - retry once with stricter JSON-only instruction
- schema validation fails
  - return a safe structured fallback response
- preference compliance fails
  - sanitize where possible and annotate with disclaimers
- unexpected runtime errors in generation
  - return a low-confidence fallback analysis instead of crashing the AI stage

### Safe Default Response

If the model cannot produce a reliable analysis, the backend can return a structured fallback instead of failing the request:

```json
{
  "skinType": {
    "type": "Sensitive-leaning",
    "confidence": 0.35
  },
  "explanation": {
    "skinTypeExplanation": "The system could not confidently generate a full analysis, so this fallback response prioritizes a simple, lower-risk routine.",
    "productBenefits": [
      "The fallback plan focuses on gentle cleansing, moisturizer, and sunscreen to reduce the chance of over-treatment.",
      "The fallback avoids making aggressive claims about specific visible concerns."
    ],
    "layeringGuide": [
      "Use cleanser first, then treatment only if specifically tolerated, then moisturizer.",
      "Keep the routine simple until a higher-confidence analysis is available.",
      "Finish every morning with sunscreen as the final layer."
    ]
  },
  "concerns": [],
  "ingredients": [],
  "products": [],
  "routine": {
    "AM": ["gentle cleanser", "moisturizer", "SPF"],
    "PM": ["gentle cleanser", "moisturizer"],
    "weekly": ["keep the routine simple until a stronger analysis is available"]
  },
  "conflicts": [],
  "disclaimers": [
    "Unable to confidently analyze input.",
    "This is not medical advice."
  ],
  "timestamp": "2026-03-22T14:00:00.000Z"
}
```

### Non-Medical Scope

SkinAI is not a medical diagnostic system. It only reasons about visible skincare-relevant traits and returns skincare guidance, not clinical diagnosis.

## 🧠 Design Decisions

### Why RAG Instead of Fine-Tuning?

RAG is a better fit here because:

- retrieval is easier to iterate on than a custom fine-tune
- context can evolve without retraining a model
- recommendations stay connected to a retrieval corpus rather than a frozen tuning snapshot

Tradeoff:

- retrieval adds latency and infrastructure complexity
- but improves grounding and product extensibility

### Why Structured Outputs Instead of Free Text?

Structured outputs make the system:

- renderable
- testable
- auditable
- safer to validate

Tradeoff:

- the prompt must be more constrained
- but the result is significantly more production-ready

### Why Validation Exists

LLMs are probabilistic. The validation layer exists because:

- raw model output is not a contract
- formatting drift can break the UI
- safety preferences should not rely on prompt obedience alone

Tradeoff:

- validation adds engineering work
- but converts a demo into a system

### Latency vs Reliability

This project deliberately accepts some latency to improve reliability:

- preprocessing stabilizes images
- retrieval improves grounding
- validation prevents malformed outputs
- fallback handling avoids brittle request failures

The system also avoids unnecessary retries:

- quality misses do not trigger extra generation calls
- only malformed JSON gets a repair retry

That keeps reliability high without letting token cost scale unnecessarily.

## ⚡ How to Run

### Install

```bash
npm install
```

### Start

```bash
npm run dev
```

Endpoints:

- frontend: `http://localhost:5173`
- API: `http://localhost:3000`

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

### Example Request

```bash
curl -X POST http://localhost:3000/api/skin/analyze \
  -F "image=@./example-face.jpg" \
  -F "goals=reduce acne marks and calm redness" \
  -F "age=29" \
  -F "valueFocus=best_value" \
  -F "fragranceFree=true" \
  -F "pregnancySafe=false" \
  -F "sensitiveMode=true"
```

### Example Response

```json
{
  "success": true,
  "data": {
    "skinType": {
      "type": "Combination / Acne-prone",
      "confidence": 0.82
    },
    "explanation": {
      "skinTypeExplanation": "...",
      "productBenefits": ["..."],
      "layeringGuide": ["..."]
    },
    "concerns": [],
    "ingredients": [],
    "products": [],
    "routine": {
      "AM": ["..."],
      "PM": ["..."],
      "weekly": ["..."]
    },
    "conflicts": [],
    "disclaimers": [
      "This routine is educational and not medical advice."
    ],
    "timestamp": "2026-03-22T14:00:00.000Z"
  }
}
```

## Observability

The API emits lightweight logs for operational clarity:

- retrieved chunk count
- prompt preview (truncated)
- schema validation success / failure
- fallback triggers

This keeps the system debuggable without introducing heavy observability tooling.

## Folder Structure

```text
apps/api/src
├── config
├── controllers
├── middleware
├── models
├── routes
├── services
├── utils
└── validation

apps/web/src
├── components
├── pages
├── services
└── styles

packages/shared-types
packages/utils
```

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
- Sharp
- Multer
- Zod

### Retrieval / Data

- Pinecone
- MongoDB / Mongoose

## Why This Repo Stands Out

This repository demonstrates:

- structured AI pipeline design
- schema-validated outputs
- retrieval-augmented generation
- safety-aware fallback handling
- product-oriented explanation design
- clear separation between inference, retrieval, validation, and UI rendering

It is designed to read like a production-minded AI system, not a one-prompt demo.
