"""Generate the five requested PDFs from the repository's Markdown source docs."""

from __future__ import annotations

import re
import textwrap
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

ROOT = Path(__file__).resolve().parents[1]
INK = "#142a3a"
BLUE = "#245d7a"
PALE = "#e9f1f5"
GREEN = "#dcefe9"
GOLD = "#fff0d7"
MUTED = "#526371"


def render_markdown(source: Path, target: Path) -> None:
    """Lay out Markdown paragraphs and tables into paginated A4 PDFs."""
    text = source.read_text(encoding="utf-8")
    blocks = []
    in_fence = False
    for raw in text.splitlines():
        line = raw.rstrip()
        line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
        line = line.replace("**", "").replace("`", "")
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if not line:
            blocks.append(("space", ""))
            continue
        if line.startswith("|---") or line.startswith("| ---"):
            continue
        if line.startswith("# "):
            blocks.append(("title", line[2:]))
        elif line.startswith("## "):
            blocks.append(("heading", line[3:]))
        elif line.startswith("### "):
            blocks.append(("subheading", line[4:]))
        elif line.startswith("| "):
            cells = [re.sub(r"\*\*|`", "", item.strip()) for item in line.strip("| ").split("|")]
            blocks.append(("table", "   •   ".join(cells)))
        elif line.startswith("- ") or re.match(r"\d+\. ", line):
            blocks.append(("bullet", re.sub(r"^(- |\d+\. )", "", line)))
        else:
            if blocks and blocks[-1][0] in {"body", "code"}:
                kind, previous = blocks[-1]
                blocks[-1] = (kind, previous + " " + line)
            else:
                blocks.append(("code" if in_fence else "body", line))

    pages = []
    fig = None
    ax = None
    y = 0

    def new_page():
        nonlocal fig, ax, y
        fig, ax = plt.subplots(figsize=(8.27, 11.69))
        fig.subplots_adjust(left=0.105, right=0.92, top=0.91, bottom=0.09)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis("off")
        ax.plot([0, 1], [1.045, 1.045], transform=ax.transAxes, color=BLUE, lw=2.0, clip_on=False)
        ax.text(0, 1.065, "AI-POWERED SUPPLY CHAIN DISRUPTION ASSISTANT", transform=ax.transAxes,
                fontsize=7, color=MUTED, fontweight="bold", va="bottom")
        y = 0.99

    def finish_page():
        nonlocal fig
        if fig is not None:
            ax.text(1, -0.055, f"{len(pages) + 1}", transform=ax.transAxes, ha="right", color=MUTED, fontsize=8)
            pages.append(fig)
            fig = None

    new_page()
    for kind, content in blocks:
        if kind == "space":
            y -= 0.014
            continue
        if kind == "title":
            fontsize, color, weight, wrap_width = 23, INK, "bold", 55
        elif kind == "heading":
            fontsize, color, weight, wrap_width = 14, BLUE, "bold", 78
        elif kind == "subheading":
            fontsize, color, weight, wrap_width = 11, INK, "bold", 92
        elif kind == "table":
            fontsize, color, weight, wrap_width = 7.1, INK, "normal", 128
        elif kind == "code":
            fontsize, color, weight, wrap_width = 7.6, MUTED, "normal", 120
        else:
            fontsize, color, weight, wrap_width = 9.3, INK, "normal", 108
        lines = textwrap.wrap(content, width=wrap_width, break_long_words=True, break_on_hyphens=False) or [""]
        line_step = fontsize / 720
        block_height = line_step * len(lines) + (0.023 if kind in {"title", "heading", "subheading"} else 0.012)
        if y - block_height < 0.01:
            finish_page()
            new_page()
        if kind == "table":
            ax.add_patch(FancyBboxPatch((0, y - block_height + 0.002), 1, block_height,
                                        boxstyle="round,pad=0.006,rounding_size=0.008", transform=ax.transAxes,
                                        facecolor=PALE, edgecolor="#d3dfe5", linewidth=0.45))
        if kind == "bullet":
            lines = textwrap.wrap(content, width=103, subsequent_indent="  ")
            fontsize, line_step = 9.1, 9.1 / 720
            ax.text(0.012, y, "•", transform=ax.transAxes, fontsize=fontsize, color=BLUE, va="top")
        for index, line in enumerate(lines):
            x = 0.03 if kind == "bullet" else 0.008
            ax.text(x, y - index * line_step, line, transform=ax.transAxes, fontsize=fontsize,
                    color=color, fontweight=weight, va="top", family="DejaVu Sans")
        y -= block_height
    finish_page()
    target.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(target) as pdf:
        for page in pages:
            pdf.savefig(page, bbox_inches="tight")
            plt.close(page)


def architecture_pdf(target: Path) -> None:
    fig, ax = plt.subplots(figsize=(11.7, 8.3))
    fig.patch.set_facecolor("#f8fafb")
    ax.set_facecolor("#f8fafb")
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8.4)
    ax.axis("off")
    ax.text(0.55, 7.96, "AI-Powered Supply Chain Disruption Assistant", fontsize=22, color=INK,
            fontweight="bold", va="center")
    ax.text(0.55, 7.55, "Actual local data, indexing, API and client flow", fontsize=10.5, color=MUTED)

    def box(x, y, w, h, title, detail, color=PALE, title_size=10.2, detail_size=8.1):
        patch = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.08,rounding_size=0.12",
                               facecolor=color, edgecolor="#aabac4", linewidth=1.1)
        ax.add_patch(patch)
        ax.text(x + w / 2, y + h * 0.67, title, ha="center", va="center", color=INK,
                fontsize=title_size, fontweight="bold", wrap=True)
        ax.text(x + w / 2, y + h * 0.30, detail, ha="center", va="center", color=MUTED,
                fontsize=detail_size, wrap=True)

    def arrow(start, end, label=None, color=BLUE, rad=0.0):
        ax.add_patch(FancyArrowPatch(start, end, arrowstyle="-|>", mutation_scale=13,
                                     color=color, linewidth=1.5, connectionstyle=f"arc3,rad={rad}"))
        if label:
            ax.text((start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.08, label,
                    ha="center", va="bottom", color=MUTED, fontsize=7.5,
                    bbox={"facecolor": "#f8fafb", "edgecolor": "none", "pad": 1.2})

    ax.text(0.65, 7.02, "OFFLINE PREPARATION", fontsize=8, fontweight="bold", color=BLUE)
    box(0.55, 5.75, 2.25, 0.85, "CSV dataset", "100,000 rows · 15 fields")
    box(3.35, 5.75, 2.4, 0.85, "Inspect + ingest", "clean, validate, dedupe")
    box(6.35, 5.75, 2.3, 0.85, "MySQL", "structured case records", GREEN)
    box(9.25, 6.15, 2.25, 0.85, "ChromaDB", "cosine vector index", GOLD)
    box(9.25, 5.05, 2.25, 0.85, "BM25 index", "keyword ranking", GOLD)
    arrow((2.8, 6.18), (3.35, 6.18))
    arrow((5.75, 6.18), (6.35, 6.18))
    arrow((8.65, 6.32), (9.25, 6.55), "one case per document")
    arrow((8.65, 6.04), (9.25, 5.48), "tokenized case text")

    ax.text(0.65, 4.48, "LOCAL REQUEST FLOW", fontsize=8, fontweight="bold", color=BLUE)
    box(0.55, 3.28, 2.25, 0.9, "User", "operations analyst", color="#ffffff")
    box(3.35, 3.28, 2.4, 0.9, "Streamlit / React", "two clients, one API", color=PALE)
    box(6.35, 3.28, 2.3, 0.9, "FastAPI", "validation + persistence", GREEN)
    box(9.25, 3.28, 2.25, 0.9, "LangGraph workflow", "named sequential nodes", PALE)
    arrow((2.8, 3.73), (3.35, 3.73))
    arrow((5.75, 3.73), (6.35, 3.73), "HTTP JSON")
    arrow((8.65, 3.73), (9.25, 3.73))

    box(0.55, 1.7, 2.25, 0.95, "Hybrid retrieval", "Chroma + BM25 · top K", GOLD)
    box(3.35, 1.7, 2.4, 0.95, "MySQL evidence", "metadata filters + outcomes", GREEN)
    box(6.35, 1.7, 2.3, 0.95, "Saved models", "4 scikit-learn predictions", PALE)
    box(9.25, 1.7, 2.25, 0.95, "Optional LLM", "grounded JSON or demo fallback", GOLD)
    arrow((10.35, 3.28), (1.68, 2.65), "query / filters", rad=-0.20)
    arrow((2.8, 2.17), (3.35, 2.17), "case IDs")
    arrow((5.75, 2.17), (6.35, 2.17), "features")
    arrow((8.65, 2.17), (9.25, 2.17), "context")
    arrow((10.35, 2.65), (10.35, 3.28), "validate and respond")
    ax.text(0.65, 0.78, "Outputs: classification · impact estimates · response comparison · recovery context · recommendation · evidence · human-review flag",
            color=INK, fontsize=9.2, fontweight="bold")
    ax.text(0.65, 0.43, "Runtime indexes and models are built explicitly by scripts; API startup does not rebuild them. LLM_PROVIDER=demo requires no external LLM.",
            color=MUTED, fontsize=8.3)
    target.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(target, format="pdf", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    docs = [
        (ROOT / "docs" / "Design_Document.md", ROOT / "design" / "Design_Document.pdf"),
        (ROOT / "docs" / "API_Documentation.md", ROOT / "docs" / "API_Documentation.pdf"),
        (ROOT / "docs" / "Dataset_Details.md", ROOT / "docs" / "Dataset_Details.pdf"),
        (ROOT / "docs" / "Evaluation_Report.md", ROOT / "docs" / "Evaluation_Report.pdf"),
    ]
    for source, target in docs:
        render_markdown(source, target)
        print(f"Created {target.relative_to(ROOT)}")
    architecture_pdf(ROOT / "architecture" / "Architecture_Diagram.pdf")
    print("Created architecture/Architecture_Diagram.pdf")


if __name__ == "__main__":
    main()
