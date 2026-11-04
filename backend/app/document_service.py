
from io import BytesIO

import pymupdf
from docx import Document as DocxDocument

def join_pdf_spans(spans: list[dict]) -> str:
    """Join PDF spans while preserving spaces from layout gaps."""

    parts = []

    for index, span in enumerate(spans):
        current_text = span["text"]
        parts.append(current_text)

        if index == len(spans) - 1:
            continue

        next_span = spans[index + 1]

        current_bbox = span["bbox"]
        next_bbox = next_span["bbox"]

        horizontal_gap = next_bbox[0] - current_bbox[2]
        font_size = max(
                        span["font_size"],
                        next_span["font_size"]
                    )

        if (
            horizontal_gap > font_size * 0.25
            and current_text
            and next_span["text"]
            and not current_text[-1].isspace()
            and not next_span["text"][0].isspace()
        ):
            parts.append(" ")

    return "".join(parts).strip()
def extract_pages(file_bytes: bytes, file_type: str) -> list[dict]:
    """Extract text while preserving source-location metadata."""

    pages = []

    
    if file_type == ".pdf":
        with pymupdf.open(stream=file_bytes, filetype="pdf") as pdf:
            if pdf.needs_pass:
                raise ValueError("Password-protected PDFs are not supported.")

            for page_number, page in enumerate(pdf, start=1):
                page_data = page.get_text("dict")
                page_blocks = []

                # Preserve the original readable page text.
                text = page.get_text("text").strip()

                for block in page_data["blocks"]:
                    if "lines" not in block:
                        continue

                    for line in block["lines"]:
                        line_spans = []

                        for span in line["spans"]:
                            span_text = span["text"]

                            if not span_text.strip():
                                continue

                            line_spans.append({
                                "text": span_text,
                                "font_size": span["size"],
                                "font_flags": span["flags"],
                                "font_name": span["font"],
                                "bbox": list(span["bbox"]),
                            })

                        if line_spans:
                            page_blocks.append({
                                "text": join_pdf_spans(line_spans),
                                "spans": line_spans,
                                "bbox": list(line["bbox"]),
                            })

                if text:
                    pages.append({
                        "page_number": page_number,
                        "page_height": page.rect.height,
                        "text": text,
                        "blocks": page_blocks,
                    })

    elif file_type == ".docx":
        doc = DocxDocument(BytesIO(file_bytes))

        for index, paragraph in enumerate(doc.paragraphs, start=1):
            text = paragraph.text.strip()

            if text:
                pages.append({
                    "page_number": None,
                    "location": f"Paragraph {index}",
                    "text": text,
                })

    elif file_type == ".txt":
        text = file_bytes.decode("utf-8-sig").strip()

        if text:
            pages.append({
                "page_number": None,
                "location": "Text file",
                "text": text,
            })

    else:
        raise ValueError("Unsupported file type.")

    if not pages:
        raise ValueError("No readable text found in this document.")

    return pages


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Extract the complete text for compatibility with existing code."""

    pages = extract_pages(file_bytes, file_type)
    return "\n\n".join(item["text"] for item in pages)
