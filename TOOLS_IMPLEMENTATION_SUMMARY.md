# OpenAI Function Calling (Tools) Support - Implementation Summary

## Overview

Successfully implemented OpenAI function calling (tools) support for the RLM library. The implementation enables LLM agents in REPL environments to access pre-computed statistics, database queries, or external APIs through a clean tool-calling interface.

## Architecture

### Data Flow
```
User REPL Code
    ↓
llm_query(prompt, tools=TOOLS, tool_handler=handler)
    ↓
[TOOL-CALLING LOOP - runs in environment]
    ↓
    LMRequest(prompt=messages, tools=TOOLS) → socket → LMHandler → OpenAIClient
    ↓
    OpenAI API returns tool_calls
    ↓
    Execute tool_handler(name, args) for each tool
    ↓
    Append tool results to messages
    ↓
    [Repeat until model returns content]
    ↓
Return final content (str)
```

## Files Modified

### 1. Core Data Structures (`rlm/core/comms_utils.py`)
- Added `tools` and `tool_choice` fields to `LMRequest` dataclass
- Updated `to_dict()` and `from_dict()` methods for serialization

### 2. OpenAI Client (`rlm/clients/openai.py`)
- Added `tools` and `tool_choice` parameters to `completion()` and `acompletion()`
- Updated return type from `str` to `str | dict`
- Returns dict with tool_calls when model requests tool execution
- Returns string for normal completions (backward compatible)

### 3. LM Handler (`rlm/core/lm_handler.py`)
- Threads tools parameters through to client
- Handles `str | dict` return types from client
- Serializes tool_calls dict to JSON for socket transmission

### 4. Environment Layer (`rlm/environments/local_repl.py`)
- Implemented tool-calling loop in `_llm_query()`
- Added helper methods:
  - `_ensure_messages_format()` - Converts string prompts to messages format
  - `_llm_query_simple()` - Backward-compatible path without tools
  - `_llm_query_batched_simple()` - Batched queries without tools
- Updated `_llm_query_batched()` to support tools
- Added `MAX_TOOL_ITERATIONS = 10` to prevent infinite loops

## Key Features

### Tool-Calling Loop
The environment layer handles the complete agentic loop:
1. Send messages with tools to model
2. Check for tool_calls in response
3. Execute tool handler for each requested tool
4. Append tool results to conversation
5. Repeat until model returns final content

### Error Handling
- Validates that `tool_handler` is provided when `tools` are specified
- Catches exceptions in tool handlers and returns error messages to model
- Prevents infinite loops with `MAX_TOOL_ITERATIONS`
- Maintains backward compatibility when tools are not used

### Backward Compatibility
- All existing code works unchanged (tools parameters are optional)
- Returns `str` for normal completions
- Simple path optimized for non-tool queries
- All 20 existing tests pass

## Testing

### New Tests (`tests/test_tools.py`)
Comprehensive test suite with 14 tests covering:
- ✅ Client returns dict for tool_calls
- ✅ Client returns str for normal content
- ✅ Single tool call execution
- ✅ Multiple rounds of tool calling
- ✅ Backward compatibility without tools
- ✅ Error: tools without handler raises ValueError
- ✅ Tool handler exceptions returned to model
- ✅ Max iterations prevents infinite loops
- ✅ Batched queries with tools
- ✅ Batched queries without tools (backward compatible)
- ✅ Helper methods (message format conversion)
- ✅ Multiple tool calls in single response

### Backward Compatibility
All 20 existing `test_local_repl.py` tests pass without modifications.

## Usage Example

```python
from rlm import RLM

# Define tools
TOOLS = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

# Define tool handler
def weather_handler(tool_name, args):
    if tool_name == "get_weather":
        return f"Weather in {args['city']}: Sunny, 72°F"
    return "Unknown tool"

# Use in REPL environment
with RLM(backend="openai") as rlm:
    rlm.execute_code(f"""
def tool_handler(name, args):
    if name == "get_weather":
        return "Weather in " + args["city"] + ": Sunny, 72°F"
    return "Unknown tool"

result = llm_query(
    "What's the weather in San Francisco?",
    tools={TOOLS},
    tool_handler=tool_handler
)
print(result)
""")
```

## Verification

All tests passing:
```bash
python3 -m pytest tests/test_tools.py -v              # 14/14 passed
python3 -m pytest tests/test_local_repl.py -v        # 20/20 passed
```

## Design Principles

1. **Environment layer owns the loop**: Tool-calling logic lives in the environment, keeping the client layer thin
2. **Backward compatibility first**: Existing code works unchanged
3. **Clean separation of concerns**: Each layer has clear responsibilities
4. **Type safety**: Proper return type annotations (`str | dict`)
5. **Error resilience**: Graceful handling of edge cases and errors

## Edge Cases Handled

✅ Model returns neither content nor tool_calls → Return empty string
✅ Infinite tool loop → Max iterations limit (10)
✅ Tools provided but no handler → Raise ValueError
✅ Tool handler raises exception → Return error to model as tool result
✅ Tool arguments invalid JSON → Return parse error to model
✅ Multiple tool calls in single response → Process all sequentially
✅ Batched queries with different tool needs → Independent loops per prompt

## Performance Considerations

- Simple path (no tools) uses optimized backward-compatible code
- Tool-calling adds minimal overhead (only when tools are used)
- Batched queries with tools run independent loops (may be slower than simple batched)
- Socket communication remains efficient with JSON serialization
