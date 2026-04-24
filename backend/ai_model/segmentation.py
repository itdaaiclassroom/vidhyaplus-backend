import os
import re
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from pypdf import PdfReader

router = APIRouter(tags=["segmentation"])

class SegmentRequest(BaseModel):
    pdf_path: str
    subject: str = "Subject"
    grade: int = 10

class TopicSegment(BaseModel):
    name: str
    summary: str
    order_num: int

@router.post("/segment_chapter")
def segment_chapter(req: SegmentRequest):
    """
    Extracts text from a chapter PDF and uses AI to segment it into logical topics.
    """
    if not os.path.exists(req.pdf_path):
        raise HTTPException(status_code=404, detail=f"PDF not found at {req.pdf_path}")

    try:
        reader = PdfReader(req.pdf_path)
        text = ""
        for page in reader.pages[:10]: # Limit to first 10 pages for segmentation
            text += page.extract_text() or ""
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        # In a real scenario, we'd use a large LLM like GPT-4 or Claude.
        # For this local demo, we'll use a rule-based approach or a simple prompt to distilgpt2
        # if the model is loaded. 
        
        # For now, let's use a prompt-based approach if LLM is available.
        from chatbot import llm, llm_task, call_ollama
        
        prompt = f"""Extract logical topic titles and a one-sentence summary for each from this chapter text (Grade {req.grade} {req.subject}).
Format: Topic: [Title] | Summary: [One sentence]

Text:
{text[:3000]}

Topics:"""

        # Try Ollama (Llama 3) first
        ollama_raw = call_ollama(prompt)
        raw = ollama_raw if ollama_raw else ""
        
        if not raw and llm and llm_task == "text-generation":
            res = llm(prompt, max_new_tokens=200, temperature=0.3, do_sample=True)
            raw = res[0].get("generated_text") if res else ""
            
        if raw:
            # Simple parser for the AI output
            topics = []
            order = 1
            # Clean up the raw text if it contains the prompt
            if "Topics:" in raw:
                raw = raw.split("Topics:")[-1]
            
            for line in raw.split("\n"):
                line = line.strip()
                if "Topic:" in line and "Summary:" in line:
                    try:
                        parts = line.split("|")
                        title = parts[0].replace("Topic:", "").strip()
                        summary = parts[1].replace("Summary:", "").strip()
                        if title:
                            topics.append(TopicSegment(name=title, summary=summary, order_num=order))
                            order += 1
                    except:
                        continue
            
            if topics:
                return {"topics": topics}

        # Fallback: Rule-based segmentation if LLM fails or doesn't return good results
        lines = text.split("\n")
        topics = []
        order = 1
        for line in lines:
            line = line.strip()
            # Simple heuristic: bold or short lines might be headers
            if 5 < len(line) < 50 and re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z]+)*$", line):
                topics.append(TopicSegment(name=line, summary=f"Detailed study of {line}.", order_num=order))
                order += 1
                if order > 8: break # Limit
        
        if not topics:
            # Absolute fallback
            topics = [
                TopicSegment(name="Introduction", summary="Overview of the chapter concepts.", order_num=1),
                TopicSegment(name="Core Concepts", summary="Deep dive into the primary subjects.", order_num=2),
                TopicSegment(name="Conclusion & Summary", summary="Recap of the key learnings.", order_num=3)
            ]
            
        return {"topics": topics}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

@router.post("/generate_ppt")
def generate_ppt(topic_name: str, subject: str = "Subject"):
    """
    Placeholder for an external PPT generation service.
    """
    # In a real implementation, this would call an API like Gamma or Canva
    # or use a library to generate a PPT file and upload it to R2.
    
    # Returning a dummy URL for now as requested.
    dummy_url = f"https://example.com/generated_ppt/{topic_name.lower().replace(' ', '_')}.pptx"
    return {
        "ok": True,
        "topic_name": topic_name,
        "ppt_url": dummy_url,
        "message": "PPT generated via external service (simulated)"
    }
