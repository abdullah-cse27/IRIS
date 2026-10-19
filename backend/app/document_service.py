
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
                text = page.get_text().strip()

                if text:
                    pages.append({
                        "page_number": page_number,
                        "text": text,
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
