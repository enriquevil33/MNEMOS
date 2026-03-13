import logging
import json
from typing import List, Dict, Optional
from app.services.rag import RAGService
from app.services.llm_client import get_llm_client
from app.models.document import Document
from app.models.chunk import Chunk

logger = logging.getLogger(__name__)


class VideoMixScriptGenerator:
    """
    Generates video mix scripts using LLM with self-reflection.
    Acts as content curator, not technical video editor.
    """

    def __init__(self, db_session):
        self.db = db_session
        self.rag = RAGService(db_session)
        self.llm = get_llm_client()

    def generate_script(
        self,
        user_prompt: str,
        document_ids: List[str],
        max_duration: Optional[int] = None,
        iterations: int = 3
    ) -> Dict:
        """
        Generate video script with multi-turn self-reflection.

        Args:
            user_prompt: User's description of desired video
            document_ids: List of document UUIDs to search
            max_duration: Maximum duration in seconds (None = no limit)
            iterations: Number of reflection iterations (default 3)

        Returns:
            {
                "segments": [...],
                "total_duration": float,
                "llm_reasoning": str,
                "reflection_history": [...]
            }
        """
        logger.info(f"Generating video script: '{user_prompt[:100]}...' (max_duration={max_duration}s)")

        # Phase 1: Retrieve relevant chunks using RAG
        relevant_chunks = self._retrieve_relevant_chunks(user_prompt, document_ids)

        if not relevant_chunks:
            logger.warning("No relevant chunks found for video mix")
            return {
                "segments": [],
                "total_duration": 0,
                "llm_reasoning": "No relevant video/audio content found in selected documents",
                "reflection_history": [],
                "segment_count": 0
            }

        # Phase 2: Initial script generation
        script = self._generate_initial_script(user_prompt, relevant_chunks, max_duration)

        reflection_history = []

        # Phase 3: Self-reflection iterations
        for i in range(iterations - 1):
            logger.info(f"Reflection iteration {i+1}/{iterations-1}")
            reflection = self._reflect_on_script(user_prompt, script, max_duration)
            reflection_history.append(reflection)

            if reflection.get('needs_improvement', False):
                script = self._improve_script(script, reflection, relevant_chunks, max_duration)
            else:
                logger.info(f"Script converged after {i+1} iterations (score: {reflection.get('score', 'N/A')}/10)")
                break

        # Phase 4: Final validation and formatting
        final_script = self._validate_and_format_script(script, max_duration)
        final_script['reflection_history'] = reflection_history

        return final_script

    def _retrieve_relevant_chunks(self, query: str, document_ids: List[str]) -> List[Dict]:
        """
        Use RAG to find relevant video/audio chunks.
        Only returns chunks that have timestamps.
        """
        # Filter for video/youtube/audio documents only
        from uuid import UUID

        video_docs = self.db.query(Document).filter(
            Document.id.in_([UUID(doc_id) for doc_id in document_ids]),
            Document.file_type.in_(['video', 'youtube', 'audio'])
        ).all()

        video_doc_ids = [str(d.id) for d in video_docs]

        if not video_doc_ids:
            logger.warning("No video/audio documents in selection")
            return []

        logger.info(f"Searching for chunks in {len(video_doc_ids)} documents: {video_doc_ids[:3]}...")

        # Retrieve chunks using RAG (top_k=30 for more options)
        chunks = self.rag.search_similar_chunks(
            query=query,
            document_ids=video_doc_ids,
            top_k=30
        )

        logger.info(f"RAG returned {len(chunks)} chunks")
        if chunks:
            logger.info(f"First chunk document_id: {chunks[0].document_id}, chunk_id: {chunks[0].id}")

        # Filter chunks with timestamps
        valid_chunks = []
        for chunk in chunks:
            if chunk.start_time is not None and chunk.end_time is not None:
                valid_chunks.append({
                    'chunk_id': str(chunk.id),
                    'document_id': str(chunk.document_id),
                    'document_title': chunk.document.original_filename if chunk.document else 'Unknown',
                    'content': chunk.content,
                    'start_time': chunk.start_time,
                    'end_time': chunk.end_time,
                    'duration': chunk.end_time - chunk.start_time
                })

        logger.info(f"Found {len(valid_chunks)} valid timestamped chunks")
        return valid_chunks

    def _generate_initial_script(
        self,
        user_prompt: str,
        chunks: List[Dict],
        max_duration: Optional[int]
    ) -> Dict:
        """Generate initial script using LLM."""

        system_prompt = """You are a video content curator. Your role is to select and arrange video segments to create a cohesive narrative.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. You can ONLY use chunk_id and document_id values from the "Available video segments" list provided
2. You CANNOT create new segment IDs or modify existing ones
3. You CANNOT invent fictional content or placeholders
4. Each segment MUST reference an actual chunk from the available list
5. Focus on content flow, narrative coherence, and educational value
6. Avoid redundancy - don't select overlapping content
7. Consider pacing - mix longer explanations with shorter points

Output your response as a JSON object with this exact structure:
{
    "segments": [
        {
            "chunk_id": "uuid",
            "document_id": "uuid",
            "start_time": 120.5,
            "end_time": 145.2,
            "title": "Brief descriptive title",
            "description": "Why this segment was chosen",
            "order": 0
        }
    ],
    "reasoning": "Explain your selection and arrangement strategy"
}"""

        # Build context with available chunks
        chunks_context = "Available video segments:\n\n"
        for i, chunk in enumerate(chunks[:30], 1):  # Limit context
            chunks_context += f"""Segment {i}:
- ID: {chunk['chunk_id']}
- Document: {chunk['document_title']}
- Time: {chunk['start_time']:.1f}s - {chunk['end_time']:.1f}s (duration: {chunk['duration']:.1f}s)
- Content: {chunk['content'][:300]}...

"""

        duration_constraint = ""
        if max_duration:
            duration_constraint = f"\n\nIMPORTANT: Total video duration must not exceed {max_duration} seconds."

        user_message = f"""Create a video about: "{user_prompt}"

{chunks_context}

Select and arrange the best segments to fulfill the user's request.{duration_constraint}

Provide your response in the specified JSON format."""

        # Define JSON schema for structured output
        json_schema = {
            "name": "video_script",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "segments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "chunk_id": {"type": "string"},
                                "document_id": {"type": "string"},
                                "start_time": {"type": "number"},
                                "end_time": {"type": "number"},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "order": {"type": "integer"}
                            },
                            "required": ["chunk_id", "document_id", "start_time", "end_time", "title", "description", "order"],
                            "additionalProperties": False
                        }
                    },
                    "reasoning": {"type": "string"}
                },
                "required": ["segments", "reasoning"],
                "additionalProperties": False
            }
        }

        try:
            response = self.llm.chat(
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                json_schema=json_schema
            )

            script = json.loads(response)
            script['llm_reasoning'] = script.pop('reasoning', '')

            # Calculate total duration
            total_duration = sum(
                seg['end_time'] - seg['start_time']
                for seg in script['segments']
            )
            script['total_duration'] = total_duration

            logger.info(f"Initial script generated: {len(script['segments'])} segments, {total_duration:.1f}s total")
            return script

        except Exception as e:
            logger.error(f"Error generating initial script: {e}")
            return {"segments": [], "total_duration": 0, "llm_reasoning": f"Error: {e}"}

    def _reflect_on_script(
        self,
        user_prompt: str,
        script: Dict,
        max_duration: Optional[int]
    ) -> Dict:
        """Ask LLM to reflect on the current script and suggest improvements."""

        system_prompt = """You are a video content curator reviewing your own work.
Critically evaluate the script and identify potential improvements:
- Is the narrative flow logical?
- Are there redundant segments?
- Is the pacing appropriate?
- Does it fully address the user's request?
- Is the duration constraint met?

Output JSON:
{
    "needs_improvement": true/false,
    "issues": ["issue 1", "issue 2"],
    "suggestions": ["suggestion 1", "suggestion 2"],
    "score": 0-10
}"""

        duration_info = ""
        if max_duration:
            current = script.get('total_duration', 0)
            duration_info = f"\nDuration: {current:.1f}s / {max_duration}s max"
            if current > max_duration:
                duration_info += " (EXCEEDS LIMIT!)"

        user_message = f"""Review this video script:

User Request: "{user_prompt}"

Current Script:
- {len(script.get('segments', []))} segments
- Total duration: {script.get('total_duration', 0):.1f}s{duration_info}

Segments:
{json.dumps(script.get('segments', []), indent=2)}

Reasoning: {script.get('llm_reasoning', 'N/A')}

Provide your reflection in JSON format."""

        try:
            response = self.llm.chat(
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )

            reflection = json.loads(response)
            logger.info(f"Reflection score: {reflection.get('score', 'N/A')}/10")
            return reflection

        except Exception as e:
            logger.error(f"Error in reflection: {e}")
            return {"needs_improvement": False, "issues": [], "suggestions": [], "score": 7}

    def _improve_script(
        self,
        script: Dict,
        reflection: Dict,
        available_chunks: List[Dict],
        max_duration: Optional[int]
    ) -> Dict:
        """Improve script based on reflection feedback."""

        system_prompt = """You are improving a video script based on feedback.
Apply the suggested improvements while maintaining narrative coherence.

CRITICAL CONSTRAINT:
- You can ONLY use chunk_id and document_id from the "Available segments" list below
- You CANNOT create new IDs, placeholders, or fictional segments
- Every segment MUST reference an actual chunk from the available list
- If you need content that doesn't exist in the available segments, skip it

Output the improved script in the same JSON format as before:
{
    "segments": [...],
    "reasoning": "..."
}"""

        duration_constraint = ""
        if max_duration:
            duration_constraint = f"\n\nREMINDER: Total duration must not exceed {max_duration} seconds."

        user_message = f"""Improve this video script based on the feedback:

Current Script:
{json.dumps(script, indent=2)}

Feedback:
- Issues: {json.dumps(reflection.get('issues', []))}
- Suggestions: {json.dumps(reflection.get('suggestions', []))}{duration_constraint}

Available segments (ONLY use chunk_id and document_id from this list):
{json.dumps(available_chunks, indent=2)}

IMPORTANT: You must ONLY use chunk_id and document_id combinations that exist in the "Available segments" list above. Do NOT create new IDs or placeholders.

Provide the improved script in JSON format."""

        try:
            response = self.llm.chat(
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )

            improved = json.loads(response)
            improved['llm_reasoning'] = improved.pop('reasoning', script.get('llm_reasoning', ''))

            # Recalculate duration
            total_duration = sum(
                seg['end_time'] - seg['start_time']
                for seg in improved['segments']
            )
            improved['total_duration'] = total_duration

            logger.info(f"Script improved: {len(improved['segments'])} segments, {total_duration:.1f}s")
            return improved

        except Exception as e:
            logger.error(f"Error improving script: {e}")
            return script  # Return original if improvement fails

    def _validate_and_format_script(self, script: Dict, max_duration: Optional[int]) -> Dict:
        """Final validation and formatting."""

        segments = script.get('segments', [])

        # Validate that all chunk_ids and document_ids are valid UUIDs
        from uuid import UUID
        valid_segments = []
        for seg in segments:
            try:
                # Try to parse as UUID to ensure they're valid
                UUID(seg.get('chunk_id', ''))
                UUID(seg.get('document_id', ''))
                valid_segments.append(seg)
            except (ValueError, AttributeError):
                logger.warning(f"Skipping invalid segment with bad UUID: chunk_id={seg.get('chunk_id')}, document_id={seg.get('document_id')}, title={seg.get('title')}")

        segments = valid_segments

        # Sort by order
        segments.sort(key=lambda s: s.get('order', 0))

        # Enforce duration limit if specified
        if max_duration:
            total = 0
            valid_segments = []
            for seg in segments:
                seg_duration = seg['end_time'] - seg['start_time']
                if total + seg_duration <= max_duration:
                    valid_segments.append(seg)
                    total += seg_duration
                else:
                    logger.warning(f"Segment {seg.get('title')} excluded due to duration limit")
                    break

            segments = valid_segments
            script['total_duration'] = total
        else:
            # Recalculate total
            script['total_duration'] = sum(
                seg['end_time'] - seg['start_time']
                for seg in segments
            )

        script['segments'] = segments
        script['segment_count'] = len(segments)

        logger.info(f"Final script: {len(segments)} segments, {script['total_duration']:.1f}s total")
        return script
