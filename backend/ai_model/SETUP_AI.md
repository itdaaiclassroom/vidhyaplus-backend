# VidhyaPlus AI Setup Guide

This project uses an AI backend for chapter segmentation, quiz generation, and recommendations. To get the best performance, it is recommended to use **Ollama** with the **Llama 3** model.

## 1. Prerequisites

### Python Environment
Ensure you have Python 3.9+ installed. From the `backend/ai_model` directory, run:
```bash
pip install -r requirements.txt
```
*(If `requirements.txt` is missing, install: `fastapi uvicorn pypdf transformers sentence-transformers duckduckgo-search requests`)*

### API Keys
Create a `.env` file in `backend/ai_model/` with:
```env
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## 2. Setting Up Ollama (Recommended for High Quality)

Ollama allows you to run powerful models like Llama 3 locally on your device.

1.  **Download & Install**: Get Ollama from [ollama.com](https://ollama.com).
2.  **Download Llama 3**: After installing, run this in your terminal:
    ```bash
    ollama run llama3
    ```
3.  **Start the Server**: Keep the Ollama application running in the background.

## 3. Running the AI Server

Once the prerequisites are met, you can start the AI backend from the root project folder using:
```bash
npm run ai
```
The server will start on `http://localhost:8001`.

## 4. How it works
- **Ollama Mode**: If Ollama is detected running, the system uses **Llama 3** for high-quality segmentation and quizzes.
- **Fallback Mode**: If Ollama is not found, the system uses **distilgpt2** (a tiny model that downloads automatically). This is useful for testing but less accurate.

## 5. Troubleshooting
- **Missing PDF text**: Ensure the uploaded textbook PDF is not an image-only scan. If it is, AI extraction might fail.
- **Port Conflict**: If port 8001 is busy, you may need to kill the existing process or change the port in `api.py`.
