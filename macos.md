# macOS Configuration Guide for NyayaZephyr

When running this repository's backend Re-Ranker (`Sentence-BERT / all-MiniLM-L6-v2`) on macOS—specifically Apple Silicon (M1/M2/M3)—you might encounter an abrupt stall in the terminal without a stack trace, looking exactly like this:

```text
[mutex.cc : 452] RAW: Lock blocking 0xac139c018   @
```
or an immediate `zsh: segmentation fault python ...`.

## What Causes the Deadlock?

This is a notorious, OS-level collision between **Hugging Face's Rust tokenizers** and **Apple's Accelerate framework** for matrix multiplication. 

When you initialize a PyTorch/SentenceTransformer model and spawn multi-threaded requests (like FastAPI web workers or `scikit-learn` testing suites), macOS natively uses the `fork()` lifecycle strategy. Because the Tokenizer contains internal C++/Rust multithreading locks, `fork()` accidentally duplicates those internal locks in a locked state—instantly permanently freezing your machine's worker threads when it tries to calculate Vector Embeddings for the Re-Ranker.

## How to Solve it on macOS

To run the Legal Researcher pipeline, you must disable tokenizer parallelism and explicitly limit OpenMP multi-threading to prevent the Accelerate collision.

In your terminal, immediately before starting `api.py` or `evaluate_ndcg.py`, run:

```bash
export TOKENIZERS_PARALLELISM=false
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
```

If you are writing scripts, you can inline these defenses at the very top of your execution file *before* importing `torch` or `sentence-transformers`:

```python
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["OMP_NUM_THREADS"] = "1"
import torch
```

## Why isn't this an issue on Windows / Linux?

We have thoroughly verified the logic. **This deadlock is structurally impossible on standard Windows deployments and Linux AWS/Azure servers.**

*   **Windows:** Windows OS natively lacks the Unx `fork()` system interface entirely. Instead, Python on Windows is forced to use the `'spawn'` method for multiprocessing. `spawn()` initializes a completely fresh memory space without carrying over dirty multi-thread locks, naturally dodging the entire tokenizer deadlock issue. Additionally, Windows relies on Intel MKL rather than Apple `Accelerate`.
*   **Linux Servers (Ubuntu/Debian):** While Linux also has `fork()`, general Linux distributions rely on `glibc` or `OpenBLAS` instead of Apple's proprietary framework, which handles the multithreading handoffs safely.
*   **System Architecture in Code:** `api.py` was structurally modified to hold the `SentenceTransformer` as a Lazy Singleton Pattern. The model avoids initializing memory during the general Uvicorn worker boot phase and only calculates the vectors precisely as an API endpoint is hit, guaranteeing standard CPU NumPy dot-calculations carry the cosine similarity securely against your server bounds. 

*(Run the system tests via `python test_system.py` directly to confirm proper matrix execution.)*