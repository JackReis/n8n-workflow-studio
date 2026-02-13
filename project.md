Süper. O zaman bu projeyi **GLM-5 + Claude Code**’a “tek seferde doğru kod ürettirecek” şekilde **net bir ürün spes’i** olarak kilitleyelim. Aşağıdaki dokümanı **aynen kopyalayıp** Claude Code’a task olarak verebilirsin.

---

# Portfolio Projesi: Multi-LLM n8n Workflow JSON Studio (Next.js Full-Stack)

## 0) Amaç

**n8n workflow JSON** üreten / onaran / doğrulayan bir “studio”:

1. **Upload JSON → Validate → Repair Loop → Export (import-ready)**
2. **Prompt → Workflow JSON Generate → Validate → Repair → Export**

Multi-provider LLM desteği:

* **z.ai (GLM-5 / GLM-4.7)**
* **OpenAI**
* **Gemini**
* **OpenRouter**
* **Groq**
* (opsiyonel) Anthropic / Mistral vs. eklenebilir adapter mimarisi

Bu proje:

* **Portfolyoda gösterişli UI**
* Gerçek hayatta **senin günlük işlerinde kullanılabilir**
* Çalışırsa: **Vercel + domain + ücretli ürün** (BYOK: bring-your-own-key)

---

## 1) Kritik Kısıtlar (Sert Kurallar)

* Şu çalışan portlara **dokunma**:

  * `http://localhost:8501/`
  * `http://127.0.0.1:8000/v1/telemet`
* Proje **port taraması yapmayacak**, açık portlara bakmayacak.
* Local dev için sabit portlar:

  * **Web UI / Next dev:** `3011`
  * (Gerekirse ayrı servis yok; Next API route kullanacağız. Ayrı backend açılırsa `3012`)

---

## 2) Ürün Modları

### Mod A — “JSON Repair”

Kullanıcı:

* workflow JSON yükler (drag & drop)
  Sistem:
* JSON parse → **Validation (multi-stage)** → error list
* “Fix” tıkla → LLM “repair loop” → tekrar validate
  Çıktı:
* **n8n import-ready JSON**
* “Before/After diff”
* “Download JSON”

### Mod B — “Prompt → Workflow Generate”

Kullanıcı:

* Doğal dille workflow tarif eder (örn “RSS→LLM structured output→WP REST post”)
  Sistem:
* LLM “generate workflow JSON”
* validate + repair loop
  Çıktı:
* import-ready JSON

---

## 3) Validation (Gerçekten İşe Yarayan Katmanlar)

### Stage 1 — JSON & Basic Shape

* JSON parse
* root tip kontrolü (object)
* `nodes` array var mı?
* `connections` object var mı?

### Stage 2 — “n8n Structural Rules” (heuristic + schema)

* Her node için:

  * `id`/`name`/`type` var mı?
  * `typeVersion` sayı mı?
  * `position: [number, number]` var mı?
  * `parameters` object mi?
* `connections` içindeki bağlantılar:

  * hedef node name/id eşleşiyor mu?
  * “main” bağlantı dizileri düzgün mü?

> Not: n8n’in tüm internal spec’ini birebir ezberlemek yerine “importu patlatan” hataları yakalayacağız (pratik).

### Stage 3 — Semantic Validation (Opsiyonel ama güçlü)

* Node type registry (mini katalog):

  * bilinen node type’lar için minimum param kontrolleri
  * örn HTTP Request node: url boş mu?
* Expression kontrolleri:

  * `{{$json...}}` gibi ifadelerde “undefined path” riskleri için uyarı
* “Continue on fail” / error handling alanları öneri olarak (auto-fix değil uyarı)

### Stage 4 — Optional “Real Import Smoke Test” (Pro mod)

En sağlam doğrulama:

* Docker’da **ephemeral n8n** container ayağa kaldır
* workflow JSON’u n8n import endpoint’ine gönder
* import başarılı mı? hata mesajı al
* sonra container kapat

> Bu mod localde çalışır. Vercel’de zor/masraflı; ama “Local Pro Mode” olarak sunulabilir.

---

## 4) Repair Loop Algoritması (Kilidin Burada)

**Amaç:** LLM sadece “yeniden yazma” yapmasın; **hata mesajına göre cerrahi düzeltme** yapsın.

* Input:

  * `original_workflow_json`
  * `validation_errors[]` (net ve maddeli)
* Output:

  * “tam workflow” veya “JSON Patch” (tercihen patch)

**Loop:**

* max 3–5 deneme
* her denemeden sonra validate
* hala hata varsa: bir sonraki denemeye **yalnızca** kalan hataları gönder

**LLM Prompt Sabit Kurallar:**

* “Asla açıklama yazma, sadece JSON döndür”
* “Mevcut node isimlerini keyfi değiştirme”
* “Yeni node ekleme ancak zorunluysa”
* “Output strict JSON” (provider destekliyorsa structured output)

---

## 5) Multi-Provider LLM Adapter Tasarımı

### Tek tip arayüz:

`POST /api/llm/generate`
Body:

* provider: `"zai" | "openai" | "gemini" | "openrouter" | "groq"`
* model: string
* mode: `"generate_workflow" | "repair_workflow"`
* input: prompt + payload
* response_format: `"json"` (strict)
* max_tokens, temperature

Backend:

* Provider adapter seçer
* ilgili API formatına çevirir
* **strict JSON** alır
* parse eder
* döndürür

### Structured Output stratejisi (fallback’li)

1. Provider “json schema” destekliyorsa → schema ile zorla
2. Desteklemiyorsa → “strict JSON only” + parse + re-ask on parse error
3. Yine bozulursa → “repair JSON” çağrısı

---

## 6) Güvenlik / Ürünleşme Mantığı (BYOK)

* Kullanıcı API key girer.
* Key **server’da kalıcı saklanmaz**.
* Key loglanmaz, telemetry’ye yazılmaz.
* UI tarafında key:

  * session memory / local storage (kullanıcı isterse “remember”)
  * “clear keys” butonu
* Vercel deploy: server route key’i request ile alır (proxy) ama **persist yok**.

---

## 7) UI/UX (Portfolyo Gösterişli)

**Layout önerisi:**

* Sol sidebar:

  * Provider seç
  * Model seç (dropdown)
  * JSON mode: Generate / Repair
  * token/temperature
* Ana alan tablar:

  1. **Repair JSON**

     * Upload panel + Monaco JSON Editor
     * Validate button
     * Error list (click → JSON’da highlight)
     * “Fix with LLM” button
     * Diff Viewer (before/after)
  2. **Prompt → Generate**

     * Prompt editor
     * “Generate Workflow”
     * same validation + repair UI
  3. **History**

     * son 20 işlem (local)
     * “restore”
  4. **Settings**

     * keys
     * model presets
     * export/import settings

UI bileşen:

* Tailwind + shadcn/ui
* Monaco Editor + Diff editor

---

## 8) Tech Stack (Öneri)

* **Next.js (App Router) + TypeScript**
* Tailwind + shadcn/ui
* Zod (input validation)
* Ajv (JSON schema validation)
* Monaco Editor (JSON)
* diff viewer (monaco diff veya react-diff-viewer)
* Zustand (UI state) veya React Query (API state)

---

## 9) Repo Yapısı (Net)

```
/app
  /repair
  /generate
  /history
  /settings
  /api
    /llm/generate
    /validate
    /repair
/components
/lib
  /providers
    zai.ts
    openai.ts
    gemini.ts
    openrouter.ts
    groq.ts
  /validation
    stages.ts
    rules.ts
  /repair
    loop.ts
    prompts.ts
  /n8n
    schema-lite.json
    samples/
/docs
  ARCHITECTURE.md
  PROVIDERS.md
  SECURITY.md
  DEPLOY_VERCEL.md
```

---

## 10) Done Definition (Kabul Kriterleri)

* Kullanıcı bozuk n8n JSON yükleyince:

  * hataları listeliyor
  * “Fix” sonrası **import edilebilir** JSON veriyor (en azından structural)
* Prompt ile üretilen workflow JSON:

  * validate + repair sonrası export edilebilir
* Multi-provider:

  * En az **z.ai + OpenAI + Gemini + OpenRouter + Groq** çalışıyor
* Portlar:

  * default `3011`
  * 8501 ve 8000/telemet **asla** kullanılmıyor
* Keys:

  * persist yok (default)
  * log yok
* Dokümantasyon:

  * local run
  * provider ekleme
  * validation/repair mantığı

---

# Claude Code / GLM-5 için “Build Task” (Kopyala-Yapıştır)

Aşağıdaki metni Claude Code’a “tek task” olarak ver:

```md
# TASK: Build Multi-LLM n8n Workflow JSON Studio (Next.js Full-Stack)

You are building a production-ready Next.js (TypeScript) full-stack app with a clean UI to:
1) Upload an n8n workflow JSON → validate it → auto-repair it via LLM loop → export import-ready JSON.
2) Prompt → generate an n8n workflow JSON → validate → auto-repair → export.

Hard constraints:
- Do NOT use ports 8501 or 8000 (telemetry). Default dev port must be 3011.
- Do NOT do any port scanning.
- Do NOT persist API keys on the server. Never log secrets.
- Provide a provider+model selector. Support at least: z.ai, OpenAI, Gemini, OpenRouter, Groq.
- Use Next.js App Router and API route handlers as backend.

Core modules:
- /lib/providers/* adapters with a unified interface.
- /lib/validation multi-stage validator (JSON parse, structure rules, connection rules).
- /lib/repair repair loop (max 5 tries): send validation errors + previous JSON to LLM and request corrected strict JSON.
- UI: Tailwind + shadcn/ui, Monaco Editor for JSON, diff viewer, error list with highlighting.

Deliverables:
- Working app with routes: /repair, /generate, /history, /settings.
- API routes: POST /api/validate, POST /api/repair, POST /api/llm/generate.
- Docs: ARCHITECTURE.md, PROVIDERS.md, SECURITY.md, DEPLOY_VERCEL.md
- Provide sample broken workflow JSONs and ensure repair passes validator.

Implementation notes:
- Validation should focus on common n8n import-breaking issues: missing nodes array, invalid connections, missing node type/name/position, etc.
- Repair must be conservative: do not rename nodes arbitrarily; do not change semantics unless required to fix structure.
- Prefer structured JSON response modes when available; otherwise implement strict-json parsing + retry.

Start by scaffolding the Next.js project, then implement provider adapters, then validator, then repair loop, then UI.
```

---

## Yarın için “senin aksiyon planın”

1. Bu spec’i repo içine `docs/SPEC.md` diye koy.
2. Claude Code / GLM-5’e üstteki TASK’ı ver.
3. İlk sprint hedefi:

   * provider adapters (en az z.ai + openai)
   * validator stage 1–2
   * repair loop + UI’de upload/validate/fix/export

---

İstersen bir sonraki mesajda ben sana bu ürünün **ilk MVP scope’unu** daha da sıkıştırıp (3 günde bitecek şekilde) “Sprint-0 / Sprint-1 / Sprint-2” diye parçalayıp vereyim; böylece Claude Code’a parça parça task atarsın ve kalite kontrol daha kolay olur.
