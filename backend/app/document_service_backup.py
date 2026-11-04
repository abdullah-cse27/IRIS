
from io import BytesIO

import pymupdf
from docx import Document as DocxDocument


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
                page_text_parts = []

                for block in page_data["blocks"]:
                    if "lines" not in block:
                        continue

                    for line in block["lines"]:
                        for span in line["spans"]:
                            span_text = span["text"].strip()

                            if not span_text:
                                continue

                            page_text_parts.append(span_text)

                            page_blocks.append({
                                "text": span_text,
                                "font_size": span["size"],
                                "font_flags": span["flags"],
                                "font_name": span["font"],
                                "bbox": list(span["bbox"]),
                            })

                text = "\n".join(page_text_parts).strip()

                if text:
                    pages.append({
                        "page_number": page_number,
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
