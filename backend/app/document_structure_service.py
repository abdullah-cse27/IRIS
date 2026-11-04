def classify_pdf_line(line: dict) -> str:
    """Classify a PDF visual line using its layout metadata."""

    text = line.get("text", "").strip()

    if not text:
        return "other"

    spans = line.get("spans", [])

    # Detect bullet/list items.
    bullet_symbols = ("\u2022", "\u25AA", "\u25E6", "\u2023", "\u2043")

    if text.startswith(bullet_symbols):
        return "list_item"

    # Detect figure and table captions.
    caption_prefixes = (
        "figure ",
        "table ",
        "fig. ",
    )
    # Table of Contents is a document section, not a caption.
    if text.lower() in ("table of contents", "contents"):
        return "heading"
    if text.lower().startswith(caption_prefixes):
        return "caption"

    if spans:
        avg_font_size = sum(
            span.get("font_size", 0)
            for span in spans
        ) / len(spans)

        is_bold = any(
            span.get("font_flags", 0) & 16
            for span in spans
        )

        # Detect large and bold headings.
        if avg_font_size >= 14 and is_bold:
            return "heading"

        # Detect monospaced/code-like lines.
        mono_span_count = sum(
            1
            for span in spans
            if span.get("font_flags", 0) & 8
        )

        if mono_span_count / len(spans) >= 0.7:
            return "code_block"

        # Detect short italic subheadings, not long quotations.
        # Detect quotation attribution lines.
        if text.startswith(("—", "–")):
            return "paragraph"
        # Quotation attribution continuation.
        if text.lower().startswith(("at ", "creator of ", "founder of ")):
            return "paragraph"
        # Detect short italic subheadings.
        is_italic = all(
            span.get("font_flags", 0) & 2
            for span in spans
        )

        if is_italic and len(text.split()) <= 8:
            return "subheading"

    return "paragraph"
def group_paragraph_lines(lines: list[dict]) -> list[dict]:
    """Group consecutive visual lines into logical paragraphs."""

    grouped = []
    current_lines = []

    # Detect whether this page is a Table of Contents page.
    is_toc_page = any(
        line.get("text", "").strip().lower() in (
            "table of contents",
            "contents",
        )
        for line in lines
    )

    # Keep TOC entries as separate visual blocks.
    if is_toc_page:
        return [
            [line]
            for line in lines
            if line.get("text", "").strip()
        ]

    for line in lines:
        block_type = classify_pdf_line(line)
        text = line.get("text", "").strip()

        # Group large, visually overlapping cover-title lines.
        if block_type == "heading" and grouped:
            previous_group = grouped[-1]

            if classify_pdf_line(previous_group[0]) == "heading":
                previous = previous_group[-1]

                previous_size = max(
                    (s.get("font_size", 0) for s in previous.get("spans", [])),
                    default=0,
                )

                current_size = max(
                    (s.get("font_size", 0) for s in line.get("spans", [])),
                    default=0,
                )

                previous_bbox = previous.get("bbox", [])
                current_bbox = line.get("bbox", [])

                if (
                    previous_size >= 40
                    and current_size >= 40
                    and previous_bbox
                    and current_bbox
                    and abs(previous_bbox[0] - current_bbox[0]) <= 8
                    and current_bbox[1] <= previous_bbox[3] + 8
                ):
                    previous_group.append(line)
                    continue

        # Append caption continuation lines.
        if block_type == "subheading" and grouped:
            previous_group = grouped[-1]

            if classify_pdf_line(previous_group[0]) == "caption":
                previous_group.append(line)
                continue

        # Append quotation attribution continuation lines.
        if block_type == "subheading" and grouped:
            previous_group = grouped[-1]
            previous_text = previous_group[0].get("text", "").strip()

            if previous_text.startswith(("—", "–")):
                previous_line = previous_group[-1]
                previous_bbox = previous_line.get("bbox", [])
                current_bbox = line.get("bbox", [])

                if (
                    previous_bbox
                    and current_bbox
                    and current_bbox[1] - previous_bbox[1] <= 18
                    and abs(current_bbox[0] - previous_bbox[0]) <= 40
                ):
                    previous_group.append(line)
                    continue

        # Group consecutive code lines.
        if block_type == "code_block" and grouped:
            previous_group = grouped[-1]

            if classify_pdf_line(previous_group[0]) == "code_block":
                previous_y = previous_group[-1]["bbox"][1]
                current_y = line["bbox"][1]

                if current_y - previous_y <= 25:
                    previous_group.append(line)
                    continue

        if block_type != "paragraph":
            if current_lines:
                grouped.append(current_lines)
                current_lines = []

            grouped.append([line])
            continue

        if not current_lines:
            current_lines.append(line)
            continue

        previous = current_lines[-1]

        vertical_distance = (
            line["bbox"][1] - previous["bbox"][1]
        )

        if vertical_distance <= 15:
            current_lines.append(line)
        else:
            grouped.append(current_lines)
            current_lines = [line]

    if current_lines:
        grouped.append(current_lines)

    return grouped


def build_document_blocks(pages: list[dict]) -> list[dict]:
    """
    Convert extracted pages into normalized logical document blocks.
    """

    blocks = []

    for page in pages:
        page_number = page.get("page_number")

        # PDF: group visual lines into logical blocks.
        if page.get("blocks"):
            groups = group_paragraph_lines(page["blocks"])

            for group in groups:
                if not group:
                    continue

                # Skip page footer region.
                page_height = page.get("page_height")
                first_bbox = group[0].get("bbox")

                if (
                    page_height is not None
                    and first_bbox
                    and first_bbox[1] >= page_height - 65
                ):
                    continue

                first_line_text = group[0].get("text", "").strip()

                is_toc_page = any(
                    line.get("text", "").strip().lower() in (
                        "table of contents",
                        "contents",
                    )
                    for line in page["blocks"]
                )

                if is_toc_page and first_line_text.lower() not in (
                    "table of contents",
                    "contents",
                ):
                    block_type = "toc_entry"
                else:
                    block_type = classify_pdf_line(group[0])

                text = " ".join(
                    line.get("text", "").strip()
                    for line in group
                    if line.get("text", "").strip()
                )

                if not text:
                    continue

                # Preserve original visual-line information.
                source_lines = [
                    {
                        "text": line.get("text", ""),
                        "bbox": line.get("bbox"),
                        "spans": line.get("spans", []),
                    }
                    for line in group
                ]

                all_spans = [
                    span
                    for line in group
                    for span in line.get("spans", [])
                ]

                bboxes = [
                    line["bbox"]
                    for line in group
                    if line.get("bbox")
                ]

                bbox = None

                if bboxes:
                    bbox = [
                        min(b[0] for b in bboxes),
                        min(b[1] for b in bboxes),
                        max(b[2] for b in bboxes),
                        max(b[3] for b in bboxes),
                    ]

                metadata = {
                    "bbox": bbox,
                    "spans": all_spans,
                    "source_lines": source_lines,
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
