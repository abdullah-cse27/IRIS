
import math
from app.text_utils import tokenize_text

def tokenize(docs):
    """Tokenize documents using the shared text utility."""
    return [tokenize_text(doc) for doc in docs]


def get_tf(tokenized_docs, query_tokens):
    """Calculate query-term frequency for each document."""
    tf_scores = []

    for doc in tokenized_docs:
        tf_dict = {}

        for term in query_tokens:
            tf_dict[term] = doc.count(term)

        tf_scores.append(tf_dict)

    return tf_scores


def get_df(tokenized_docs):
    """Count the number of documents containing each term."""
    df_dict = {}

    for doc in tokenized_docs:
        for term in set(doc):
            df_dict[term] = df_dict.get(term, 0) + 1

    return df_dict


def get_idf(tokenized_docs, df_dict, epsilon=0.25):
    """Calculate BM25 IDF with negative-IDF replacement."""
    N = len(tokenized_docs)

    if N == 0 or not df_dict:
        return {}

    idf_dict = {}

    for term, df in df_dict.items():
        idf_dict[term] = (
            math.log(N - df + 0.5)
            - math.log(df + 0.5)
        )

    average_idf = sum(idf_dict.values()) / len(idf_dict)

    # Keep replacement non-negative even when average IDF is negative.
    eps = epsilon * max(average_idf, 0.0)

    for term in idf_dict:
        if idf_dict[term] < 0:
            idf_dict[term] = eps

    return idf_dict


def get_tf_normalized(tf, doc_len, avgdl, k1=1.5, b=0.75):
    """Calculate length-normalized term frequency."""
    if tf <= 0 or avgdl <= 0:
        return 0.0

    numerator = tf * (k1 + 1)

    denominator = tf + k1 * (
        1 - b + b * (doc_len / avgdl)
    )

    if denominator == 0:
        return 0.0

    return numerator / denominator


def bm25(docs, query_tokens, k1=1.5, b=0.75):
    """Return a BM25 score for each document."""
    if not docs:
        return []

    if k1 < 0:
        raise ValueError("k1 must be non-negative.")

    if not 0 <= b <= 1:
        raise ValueError("b must be between 0 and 1.")

    tokenized_docs = tokenize(docs)

    # Reuse the same tokenizer for query terms.
    query_text = " ".join(query_tokens)
    normalized_query = tokenize([query_text])[0]

    # Repeated terms should not be counted multiple times.
    query_terms = list(dict.fromkeys(normalized_query))

    if not query_terms:
        return [0.0] * len(docs)

    doc_lengths = [len(doc) for doc in tokenized_docs]
    avgdl = sum(doc_lengths) / len(doc_lengths)

    if avgdl == 0:
        return [0.0] * len(docs)

    tf_scores = get_tf(tokenized_docs, query_terms)
    df_dict = get_df(tokenized_docs)
    idf_dict = get_idf(tokenized_docs, df_dict)

    scores = []

    for i, doc in enumerate(tokenized_docs):
        score = 0.0

        for term in query_terms:
            tf = tf_scores[i].get(term, 0)

            if tf == 0:
                continue

            normalized_tf = get_tf_normalized(
                tf,
                doc_lengths[i],
                avgdl,
                k1,
                b,
            )

            score += idf_dict.get(term, 0.0) * normalized_tf

        scores.append(score)

    return scores


def rank_documents(docs, query, top_k=5, k1=1.5, b=0.75):
    """Rank documents by BM25 score, highest score first."""
    if top_k <= 0:
        raise ValueError("top_k must be greater than zero.")

    if not query or not query.strip():
        return []

    scores = bm25(
        docs,
        [query],
        k1=k1,
        b=b,
    )

    ranked = [
        {
            "index": index,
            "text": docs[index],
            "score": score,
        }
        for index, score in enumerate(scores)
        if score > 0
    ]

    ranked.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    return ranked[:top_k]
