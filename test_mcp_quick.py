"""
MNEMOS MCP Quick Test Script
Run this to verify basic MCP functionality before testing with Claude Desktop

Usage:
    docker cp test_mcp_quick.py dev-mcp-1:/app/
    docker compose exec mcp python /app/test_mcp_quick.py
"""
import sys
sys.path.insert(0, '/app')

from app.mcp_server.server import (
    list_documents,
    get_system_stats,
    list_collections,
    search_concepts,
    list_concepts,
    get_active_settings,
    get_system_prompts,
    get_user_memories,
    _validate_uuid
)

def print_section(title):
    """Print section header"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

def test_helper_functions():
    """Test helper utilities"""
    print_section("Testing Helper Functions")

    # Test UUID validation
    print("1. UUID Validation:")
    valid = _validate_uuid("550e8400-e29b-41d4-a716-446655440000", "test")
    invalid = _validate_uuid("not-a-uuid", "test")

    if valid is None and invalid is not None:
        print("   ✅ UUID validation works correctly")
    else:
        print("   ❌ UUID validation failed")

def test_system_tools():
    """Test system information tools"""
    print_section("Testing System Tools")

    # Test get_system_stats
    print("1. get_system_stats:")
    result = get_system_stats()
    if "Knowledge Base Statistics" in result and "Documents" in result:
        print("   ✅ System stats returned successfully")
        # Extract and show key numbers
        if "Total:" in result:
            lines = result.split('\n')
            for line in lines:
                if 'Total:' in line or 'Concepts:' in line or 'Relationships:' in line:
                    print(f"   {line.strip()}")
    else:
        print("   ❌ System stats failed")
        print(f"   Error: {result[:200]}")

    # Test get_active_settings
    print("\n2. get_active_settings:")
    result = get_active_settings()
    if "Active Settings" in result or "No preferences" in result:
        print("   ✅ Active settings retrieved")
    else:
        print("   ❌ Active settings failed")

    # Test get_system_prompts
    print("\n3. get_system_prompts:")
    result = get_system_prompts()
    if "System Prompts" in result or "No system prompts" in result:
        print("   ✅ System prompts retrieved")
    else:
        print("   ❌ System prompts failed")

def test_document_tools():
    """Test document management tools"""
    print_section("Testing Document Tools")

    print("1. list_documents:")
    result = list_documents()
    if "Documents" in result:
        print("   ✅ Document list retrieved")
        # Count documents mentioned
        doc_count = result.count("- ID:")
        print(f"   Found {doc_count} documents")
    elif "No completed documents" in result:
        print("   ⚠️  No documents found (this is OK if you haven't uploaded any)")
    else:
        print("   ❌ Document list failed")
        print(f"   Error: {result[:200]}")

def test_collection_tools():
    """Test collection management tools"""
    print_section("Testing Collection Tools")

    print("1. list_collections:")
    result = list_collections()
    if "Collections" in result or "No collections found" in result:
        print("   ✅ Collection list retrieved")
        if "No collections" not in result:
            coll_count = result.count("## ")
            print(f"   Found {coll_count} collections")
    else:
        print("   ❌ Collection list failed")

def test_knowledge_graph_tools():
    """Test knowledge graph tools"""
    print_section("Testing Knowledge Graph Tools")

    print("1. list_concepts (first 5):")
    result = list_concepts(limit=5)
    if "Concepts" in result:
        print("   ✅ Concept list retrieved")
        if "No concepts found" in result:
            print("   ⚠️  No concepts in graph (process some documents first)")
        else:
            # Try to count concepts
            concept_count = result.count("- **")
            print(f"   Showing {concept_count} concepts")
    else:
        print("   ❌ Concept list failed")

    print("\n2. search_concepts (test query):")
    result = search_concepts("test", limit=5)
    if "Concept Search Results" in result or "No concepts found" in result:
        print("   ✅ Concept search works")
    else:
        print("   ❌ Concept search failed")

def test_memory_tools():
    """Test memory and conversation tools"""
    print_section("Testing Memory Tools")

    print("1. get_user_memories:")
    result = get_user_memories()
    if "User Memories" in result or "Memory system" in result or "No memories" in result:
        print("   ✅ User memories retrieved")
        if "Memory system is currently disabled" in result:
            print("   ℹ️  Memory system is disabled (enable in settings)")
        elif "No memories stored yet" in result:
            print("   ℹ️  No memories stored yet (normal for new installation)")
    else:
        print("   ❌ User memories failed")

def run_comprehensive_test():
    """Run all tests"""
    print("\n" + "#"*70)
    print("#" + " "*68 + "#")
    print("#" + "  MNEMOS MCP SERVER - COMPREHENSIVE TEST SUITE".center(68) + "#")
    print("#" + " "*68 + "#")
    print("#"*70)

    try:
        test_helper_functions()
        test_system_tools()
        test_document_tools()
        test_collection_tools()
        test_knowledge_graph_tools()
        test_memory_tools()

        print_section("Test Summary")
        print("✅ All basic tests completed!")
        print("\nNext Steps:")
        print("1. Review any ⚠️  warnings above")
        print("2. If tests pass, proceed to Claude Desktop testing")
        print("3. See MCP_TESTING_GUIDE.md for detailed Claude Desktop tests")
        print("\nTo test in Claude Desktop:")
        print("- Configure claude_desktop_config.json")
        print("- Restart Claude Desktop")
        print("- Ask: 'Can you see the MNEMOS tools?'")
        print("- Try: 'Show me my knowledge base statistics'")

    except Exception as e:
        print("\n" + "="*70)
        print("❌ TEST SUITE FAILED")
        print("="*70)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_comprehensive_test()
