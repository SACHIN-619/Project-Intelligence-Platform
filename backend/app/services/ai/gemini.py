"""
app/services/ai/gemini.py
===========================
3-Layer AI Provider with automatic silent fallback.

Layer 1 → Google Gemini Flash/Pro   (primary — best quality)
Layer 2 → Groq LLaMA-3.3-70B       (fallback — fast, free)
Layer 3 → Graceful degradation      (never crashes pipeline)

Every caller uses the same public API:
  gemini.generate(prompt)
  gemini.generate_json(prompt)
  gemini.explain_risks(...)
  gemini.answer_rag_query(...)
  gemini.generate_report_narrative(...)

Which layer responded is logged but invisible to callers.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)

# ── Model lists ────────────────────────────────────────────────────────────────
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
]

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]


def _is_quota_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(x in msg for x in ["429", "resource_exhausted", "quota", "rate_limit"])


def _clean_json_text(text: str) -> str:
    """Strip markdown fences from model JSON output."""
    return text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()


class GeminiClient:
    """
    3-layer AI client.

    Layer 1: Gemini (primary)
    Layer 2: Groq   (fallback when Gemini quota hit or unavailable)
    Layer 3: Template strings / graceful degradation (never crashes)
    """

    MAX_CONTEXT_CHARS = 12_000

    def __init__(self):
        self._gemini_available = False
        self._groq_client = None
        self._gemini_model_name = None
        self._init_gemini()
        self._init_groq()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _init_gemini(self):
        if not settings.gemini_api_key:
            logger.warning("[AI] No GEMINI_API_KEY — Layer 1 disabled")
            return
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            self._genai = genai
            self._gemini_available = True
            logger.info("[AI] Gemini Layer 1 ready")
        except Exception as e:
            logger.warning(f"[AI] Gemini init failed: {e}")

    def _init_groq(self):
        groq_key = getattr(settings, "groq_api_key", None)
        if not groq_key:
            logger.info("[AI] No GROQ_API_KEY — Layer 2 disabled (optional)")
            return
        try:
            from groq import Groq
            self._groq_client = Groq(api_key=groq_key)
            logger.info("[AI] Groq Layer 2 ready")
        except ImportError:
            logger.warning("[AI] groq package not installed. Run: pip install groq")
        except Exception as e:
            logger.warning(f"[AI] Groq init failed: {e}")

    @property
    def is_available(self) -> bool:
        return self._gemini_available or self._groq_client is not None

    # ── Layer 1: Gemini ───────────────────────────────────────────────────────

    def _gemini_generate(self, prompt: str, temperature: float = 0.2) -> Optional[str]:
        if not self._gemini_available:
            return None
        for model_name in GEMINI_MODELS:
            try:
                model = self._genai.GenerativeModel(
                    model_name=model_name,
                    generation_config={
                        "max_output_tokens": settings.gemini_max_tokens,
                        "temperature": temperature,
                    },
                )
                response = model.generate_content(prompt)
                text = response.text
                if text:
                    logger.info(f"[AI] Layer 1 Gemini ✓ ({model_name})")
                    return text
            except Exception as e:
                logger.warning(f"[AI] Gemini {model_name} failed: {e}")
                if _is_quota_error(e):
                    logger.warning("[AI] Gemini quota hit → trying Layer 2 Groq")
                    break
        return None

    def _gemini_generate_json(self, prompt: str) -> Optional[Dict]:
        if not self._gemini_available:
            return None
        for model_name in GEMINI_MODELS:
            try:
                model = self._genai.GenerativeModel(
                    model_name=model_name,
                    generation_config={
                        "max_output_tokens": settings.gemini_max_tokens,
                        "temperature": 0.1,
                        "response_mime_type": "application/json",
                    },
                )
                response = model.generate_content(prompt)
                parsed = json.loads(_clean_json_text(response.text))
                logger.info(f"[AI] Layer 1 Gemini JSON ✓ ({model_name})")
                return parsed
            except json.JSONDecodeError:
                logger.warning(f"[AI] Gemini {model_name} returned invalid JSON")
            except Exception as e:
                logger.warning(f"[AI] Gemini {model_name} failed: {e}")
                if _is_quota_error(e):
                    break
        return None

    # ── Layer 2: Groq ─────────────────────────────────────────────────────────

    def _groq_generate(self, prompt: str, temperature: float = 0.4) -> Optional[str]:
        if not self._groq_client:
            return None
        for model_name in GROQ_MODELS:
            try:
                completion = self._groq_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=2048,
                )
                text = completion.choices[0].message.content
                if text:
                    logger.info(f"[AI] Layer 2 Groq text ✓ ({model_name})")
                    return text
            except Exception as e:
                logger.warning(f"[AI] Groq {model_name} failed: {e}")
                if "429" in str(e):
                    break
        return None

    def _groq_generate_json(self, prompt: str) -> Optional[Dict]:
        if not self._groq_client:
            return None
        for model_name in GROQ_MODELS:
            try:
                completion = self._groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a project intelligence AI for EPC construction. "
                                "Always respond with ONLY valid JSON. No markdown, no extra text."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                    response_format={"type": "json_object"},
                )
                raw = completion.choices[0].message.content
                parsed = json.loads(_clean_json_text(raw))
                logger.info(f"[AI] Layer 2 Groq JSON ✓ ({model_name})")
                return parsed
            except json.JSONDecodeError:
                logger.warning(f"[AI] Groq {model_name} returned invalid JSON")
            except Exception as e:
                logger.warning(f"[AI] Groq {model_name} failed: {e}")
                if "429" in str(e):
                    break
        return None

    # ── Public API ────────────────────────────────────────────────────────────

    def generate(self, prompt: str, fallback: str = "") -> str:
        """
        Generate text with 3-layer fallback.
        Layer 1 → Gemini. Layer 2 → Groq. Layer 3 → fallback string.
        """
        result = self._gemini_generate(prompt)
        if result:
            return result

        result = self._groq_generate(prompt)
        if result:
            return result

        # Layer 3 — graceful degradation
        logger.error("[AI] All providers failed for text generation")
        return fallback or (
            "AI explanation temporarily unavailable. "
            "Schedule and risk data remain accurate. "
            "Please retry in 30 seconds."
        )

    def generate_json(self, prompt: str, fallback: Dict = None) -> Dict:
        """
        Generate JSON with 3-layer fallback.
        Layer 1 → Gemini (response_mime_type=json). Layer 2 → Groq (json_object).
        Layer 3 → fallback dict.
        """
        # Try Gemini JSON mode
        result = self._gemini_generate_json(prompt)
        if result:
            return result

        # Try Groq JSON mode
        result = self._groq_generate_json(prompt)
        if result:
            return result

        # Try Gemini/Groq text + parse
        json_prompt = prompt + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        text_result = self._gemini_generate(json_prompt) or self._groq_generate(json_prompt)
        if text_result:
            try:
                return json.loads(_clean_json_text(text_result))
            except json.JSONDecodeError:
                pass

        logger.error("[AI] All providers failed for JSON generation")
        return fallback or {}

    def _compress_context(self, text: str) -> str:
        if len(text) <= self.MAX_CONTEXT_CHARS:
            return text
        half = self.MAX_CONTEXT_CHARS
        head = text[:int(half * 0.6)]
        tail = text[-int(half * 0.4):]
        return head + "\n\n[... context compressed ...]\n\n" + tail

    # ── Domain methods (same API as before, now with 3-layer under the hood) ──

    def explain_risks(
        self,
        project_name: str,
        delay_days: int,
        risk_items: List[Dict],
        confidence: float,
    ) -> str:
        risk_text = "\n".join(
            f"- {r.get('task_name','Unknown')}: {r.get('severity','?')} risk, "
            f"{r.get('impact_days',0)} day impact. {r.get('explanation','')}"
            for r in risk_items[:5]
        )
        prompt = f"""You are an expert EPC project risk analyst.

Project: {project_name}
Current predicted delay: {delay_days} days
Analysis confidence: {confidence:.0%}

Top risks identified:
{risk_text}

Write a concise 2-3 paragraph executive summary explaining:
1. The root cause of the delay
2. Which risks need immediate attention
3. Overall project health

Be direct, use plain English. Do not mention "AI" or "model".
Do not add bullet points — use flowing prose."""

        fallback = (
            f"Project '{project_name}' is currently predicted to run {delay_days} day(s) late "
            f"with {confidence:.0%} confidence. {len(risk_items)} risk(s) identified requiring attention. "
            "Please review the risk list for details and initiate recovery planning."
        )
        return self.generate(self._compress_context(prompt), fallback)

    def explain_recovery(
        self,
        action_type: str,
        task_name: str,
        days_saved: int,
        confidence: float,
        evidence: List[str],
    ) -> str:
        ev_text = "\n".join(f"- {e}" for e in evidence[:3]) if evidence else "- Project schedule data"
        prompt = f"""You are an EPC project recovery advisor.

Recommended action: {action_type.replace('_', ' ').title()}
Target task: {task_name}
Estimated days recovered: {days_saved}
Confidence: {confidence:.0%}

Evidence used:
{ev_text}

Explain this recovery recommendation in 2 sentences:
1. Why this action is recommended
2. What the expected outcome is

Be concise and specific."""

        return self.generate(
            prompt,
            f"Applying '{action_type}' to '{task_name}' is expected to recover "
            f"{days_saved} day(s) based on schedule analysis."
        )

    def answer_rag_query(
        self,
        question: str,
        retrieved_chunks: List[Dict],
        project_context: Dict,
        confidence: float,
    ) -> Dict[str, Any]:
        if not retrieved_chunks:
            return {
                "answer": "No relevant documents found for this query. Please upload relevant project files.",
                "confidence": 0.1,
                "evidence": [],
                "assumptions": ["No document context available"],
            }

        chunks_text = "\n\n".join(
            f"[Source: {c.get('source_file','unknown')}, page {c.get('page_number',0)}]\n{c.get('content','')[:600]}"
            for c in retrieved_chunks[:5]
        )

        project_summary = (
            f"Project: {project_context.get('name','Unknown')}, "
            f"Delay: {project_context.get('delay_days',0)} days, "
            f"Confidence: {project_context.get('confidence',0):.0%}"
        )

        prompt = f"""You are a project intelligence assistant for EPC data centre construction.

{project_summary}

Question: {question}

Retrieved project documents:
{self._compress_context(chunks_text)}

Answer the question based ONLY on the provided documents.
If documents don't contain enough information, say so clearly.

Respond with JSON in this exact format:
{{
  "answer": "Your answer here",
  "evidence_used": ["source1: key fact", "source2: key fact"],
  "assumptions": ["any assumption made"],
  "missing_data": ["data that would improve this answer"]
}}"""

        result = self.generate_json(
            prompt,
            fallback={
                "answer": "Unable to generate answer — please check document uploads.",
                "evidence_used": [],
                "assumptions": [],
                "missing_data": ["Complete project documents"],
            }
        )
        return result

    def generate_report_narrative(
        self,
        project_data: Dict,
        risks: List[Dict],
        scenarios: List[Dict],
    ) -> str:
        prompt = f"""Write a professional project status report narrative (3-4 paragraphs).

Project: {project_data.get('name')}
Completion: {project_data.get('completion_pct')}%
Predicted delay: {project_data.get('delay_days')} days
Risk level: {project_data.get('risk_level')}
Confidence: {project_data.get('confidence', 0):.0%}

Top 3 risks: {json.dumps(risks[:3], indent=2)}
Recovery scenarios evaluated: {len(scenarios)}

Write as an executive project update. Professional tone.
Do not include headings or bullet points. Plain paragraphs only."""

        fallback = (
            f"The project is currently at {project_data.get('completion_pct', 0)}% completion "
            f"with a predicted delay of {project_data.get('delay_days', 0)} days. "
            f"{len(risks)} risk(s) have been identified and {len(scenarios)} recovery scenario(s) evaluated."
        )
        return self.generate(prompt, fallback)


# Singleton — import this everywhere
gemini = GeminiClient()