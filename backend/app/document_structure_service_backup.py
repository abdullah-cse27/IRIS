def classify_pdf_line(line: dict) -> str:
    """Classify a PDF visual line using its layout metadata."""

    text = line.get("text", "").strip()

    if not text:
        return "other"

    # Detect bullet/list items.
    bullet_symbols = ("\u2022", "\u25AA", "\u25E6", "\u2023", "\u2043")

    if text.startswith(bullet_symbols):
        return "list_item"
        # Detect large and bold headings.
    spans = line.get("spans", [])

    if spans:
        avg_font_size = sum(
            span.get("font_size", 0)
            for span in spans
        ) / len(spans)

        is_bold = any(
            span.get("font_flags", 0) & 16
            for span in spans
        )

        if avg_font_size >= 14 and is_bold:
            return "heading"
    # Detect monospaced/code-like lines.
    spans = line.get("spans", [])

    if spans:
        mono_span_count = sum(
            1
            for span in spans
            if span.get("font_flags", 0) & 8
        )

        if mono_span_count / len(spans) >= 0.7:
            return "code_block"

    return "paragraph"
def build_document_blocks(pages: list[dict]) -> list[dict]:
    """
    Convert extracted pages into normalized document blocks.
    """

    blocks = []

    for page in pages:
        page_number = page.get("page_number")

        # PDF: use layout-aware visual lines.
        if page.get("blocks"):
            for line in page["blocks"]:
                text = line.get("text", "").strip()

                if not text:
                    continue

                block_type = classify_pdf_line(line)

                metadata = {
                    "bbox": line.get("bbox"),
                    "spans": line.get("spans", []),
                }

                blocks.append({
                    "block_index": len(blocks),
                    "block_type": block_type,
                    "text": text,
                    "page_number": page_number,
                    "parent_id": None,
                    "metadata_json": metadata,
                })

        # DOCX and TXT: preserve existing paragraph behavior.
        else:
            text = page.get("text", "")

            if not isinstance(text, str) or not text.strip():
                continue

            paragraphs = [
                paragraph.strip()
                for paragraph in text.split("\n")
                if paragraph.strip()
            ]

            for paragraph in paragraphs:
                blocks.append({
                    "block_index": len(blocks),
                    "block_type": "paragraph",
                    "text": paragraph,
                    "page_number": page_number,
                    "parent_id": None,
                    "metadata_json": {},
                })

    return blocks