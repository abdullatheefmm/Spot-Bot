"""
Simulated Vector Database for Retrieval-Augmented Generation (RAG).
In a production system, this would be a ChromaDB or Pinecone instance loaded with
PDFs of the IPC-A-610 manufacturing standards, and queried using embeddings.
For demonstration, we use a dictionary-based retriever.
"""

IPC_KNOWLEDGE_BASE = {
    "Thermal Damage": "IPC-A-610 Section 10.6.4: Heat damage (charring, blistering) of the printed board is a Defect for Class 1, 2, and 3 products. Burned components or substrate indicate excessive thermal profile or power dissipation issues.",
    "Short": "IPC-A-610 Section 5.2.7.2: Solder bridging across inadvertently connected conductors is a Defect for Class 1, 2, and 3. This often results from excessive solder volume, poor stencil registration, or reflow profile errors.",
    "Open": "IPC-A-610 Section 5.2.1: Incomplete solder connection, fractured solder joint, or lifted pad resulting in an open circuit is a Defect for Class 1, 2, and 3.",
    "Missing": "IPC-A-610 Section 8.3.1.1: Component missing from its intended location is a Defect for Classes 1, 2, and 3. Commonly caused by pick-and-place errors or poor solder paste tackiness.",
    "Misalignment": "IPC-A-610 Section 8.3.2.1: Component lateral overhang indicating misalignment greater than 50% of the termination width is a Defect for Class 3 high-reliability products.",
    "Solder Bridge": "IPC-A-610 Section 5.2.7.2: Solder bridging across non-common conductors is a Defect. Bridging can cause immediate electrical failure and must be reworked."
}

def retrieve_ipc_context(defect_types):
    """
    Retrieval step of the NLP RAG pipeline.
    Given a list of defect types (e.g., ['Short', 'Thermal Damage']),
    retrieves the exact engineering standard text to inject into the LLM prompt.
    """
    context_blocks = set()
    unique_types = set([str(d).lower() for d in defect_types])
    
    for dtype in unique_types:
        for key, text in IPC_KNOWLEDGE_BASE.items():
            if key.lower() in dtype:
                context_blocks.add(text)
                
    if not context_blocks:
        return "No specific IPC standard context retrieved. Apply general IPC-A-610 Class 2 guidelines."
        
    return "\n\n".join(context_blocks)
