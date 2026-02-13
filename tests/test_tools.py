"""
Tests for OpenAI function calling (tools) support in RLM.

Tests cover:
- Single tool call execution
- Multiple rounds of tool calling
- Backward compatibility without tools
- Error handling (missing handler, handler exceptions, max iterations)
- Batched queries with tools
- Client return type detection
"""

import json
from unittest.mock import Mock, patch

import pytest

from rlm.clients.openai import OpenAIClient
from rlm.core.comms_utils import LMResponse
from rlm.core.types import ModelUsageSummary, RLMChatCompletion, UsageSummary
from rlm.environments.local_repl import MAX_TOOL_ITERATIONS, LocalREPL

# =============================================================================
# Helper Functions
# =============================================================================


def make_usage_summary():
    """Create a usage summary for testing."""
    return UsageSummary(
        model_usage_summaries={
            "gpt-4": ModelUsageSummary(
                total_calls=1,
                total_input_tokens=10,
                total_output_tokens=20,
            )
        }
    )


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI response object."""

    def _make_response(content=None, tool_calls=None):
        response = Mock()
        response.choices = [Mock()]
        response.choices[0].message = Mock()
        response.choices[0].message.content = content
        response.choices[0].message.tool_calls = tool_calls
        response.usage = Mock()
        response.usage.prompt_tokens = 10
        response.usage.completion_tokens = 20
        response.usage.total_tokens = 30
        return response

    return _make_response


@pytest.fixture
def sample_tools():
    """Sample tool definitions for testing."""
    return [
        {
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
        }
    ]


@pytest.fixture
def sample_tool_handler():
    """Sample tool handler that returns weather data."""

    def handler(tool_name, args):
        if tool_name == "get_weather":
            return f"Weather in {args['city']}: Sunny, 72°F"
        return "Unknown tool"

    return handler


# =============================================================================
# OpenAI Client Tests
# =============================================================================


def test_client_returns_dict_for_tool_calls(mock_openai_response):
    """Test that OpenAI client returns dict when tool_calls are present."""
    # Create mock tool call
    tool_call = Mock()
    tool_call.id = "call_123"
    tool_call.function = Mock()
    tool_call.function.name = "get_weather"
    tool_call.function.arguments = json.dumps({"city": "San Francisco"})

    # Mock response with tool calls
    mock_response = mock_openai_response(content=None, tool_calls=[tool_call])

    with patch("openai.OpenAI") as mock_openai_class:
        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        client = OpenAIClient(api_key="test-key", model_name="gpt-4")
        result = client.completion("Test prompt")

        # Should return dict with tool_calls
        assert isinstance(result, dict)
        assert "tool_calls" in result
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["id"] == "call_123"
        assert result["tool_calls"][0]["name"] == "get_weather"
        assert result["tool_calls"][0]["arguments"] == {"city": "San Francisco"}


def test_client_returns_str_for_content(mock_openai_response):
    """Test that OpenAI client returns str when only content is present."""
    mock_response = mock_openai_response(content="Hello, world!", tool_calls=None)

    with patch("openai.OpenAI") as mock_openai_class:
        mock_client = Mock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        client = OpenAIClient(api_key="test-key", model_name="gpt-4")
        result = client.completion("Test prompt")

        # Should return string
        assert isinstance(result, str)
        assert result == "Hello, world!"


# =============================================================================
# LocalREPL Tool Calling Tests
# =============================================================================


def test_llm_query_with_tools_single_call(sample_tools, sample_tool_handler):
    """Test llm_query with tools that requires a single tool call."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    # Mock the socket communication
    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # First call: model returns tool call
        tool_call_response = {
            "tool_calls": [
                {
                    "id": "call_123",
                    "name": "get_weather",
                    "arguments": {"city": "San Francisco"},
                }
            ],
            "content": None,
        }
        first_response = LMResponse.success_response(
            RLMChatCompletion(
                root_model="gpt-4",
                prompt=[{"role": "user", "content": "What's the weather in SF?"}],
                response=json.dumps(tool_call_response),
                usage_summary=make_usage_summary(),
                execution_time=0.1,
            )
        )

        # Second call: model returns final content
        second_response = LMResponse.success_response(
            RLMChatCompletion(
                root_model="gpt-4",
                prompt=[],
                response="The weather in San Francisco is Sunny, 72°F",
                usage_summary=make_usage_summary(),
                execution_time=0.1,
            )
        )

        mock_send.side_effect = [first_response, second_response]

        result = env._llm_query(
            "What's the weather in SF?",
            tools=sample_tools,
            tool_handler=sample_tool_handler,
        )

        assert result == "The weather in San Francisco is Sunny, 72°F"
        assert mock_send.call_count == 2


def test_llm_query_with_tools_multiple_rounds(sample_tools):
    """Test llm_query with tools that requires multiple tool call rounds."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    call_count = 0

    def custom_handler(tool_name, args):
        nonlocal call_count
        call_count += 1
        return f"Result {call_count} for {tool_name}"

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # First call: tool call
        tool_call_1 = {
            "tool_calls": [{"id": "call_1", "name": "get_weather", "arguments": {"city": "SF"}}],
            "content": None,
        }
        # Second call: another tool call
        tool_call_2 = {
            "tool_calls": [{"id": "call_2", "name": "get_weather", "arguments": {"city": "LA"}}],
            "content": None,
        }
        # Third call: final response
        final_response = "Weather comparison complete"

        responses = [
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=json.dumps(tool_call_1),
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=json.dumps(tool_call_2),
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=final_response,
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
        ]

        mock_send.side_effect = responses

        result = env._llm_query(
            "Compare weather in SF and LA",
            tools=sample_tools,
            tool_handler=custom_handler,
        )

        assert result == final_response
        assert call_count == 2
        assert mock_send.call_count == 3


def test_llm_query_without_tools_backward_compatible():
    """Test that llm_query without tools works as before (backward compatibility)."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        response = LMResponse.success_response(
            RLMChatCompletion(
                root_model="gpt-4",
                prompt="Test",
                response="Simple response",
                usage_summary=make_usage_summary(),
                execution_time=0.1,
            )
        )
        mock_send.return_value = response

        result = env._llm_query("Test prompt")

        assert result == "Simple response"
        assert mock_send.call_count == 1


def test_llm_query_tools_without_handler_raises(sample_tools):
    """Test that providing tools without a handler raises ValueError."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    with pytest.raises(ValueError, match="tool_handler is required"):
        env._llm_query("Test prompt", tools=sample_tools)


def test_llm_query_tool_handler_exception(sample_tools):
    """Test that handler exceptions are returned to model as error message."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    def failing_handler(tool_name, args):
        raise RuntimeError("Handler failed!")

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # First call: tool call
        tool_call_response = {
            "tool_calls": [{"id": "call_1", "name": "get_weather", "arguments": {"city": "SF"}}],
            "content": None,
        }
        # Second call: model recovers from error
        final_response = "I couldn't get the weather data"

        responses = [
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=json.dumps(tool_call_response),
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=final_response,
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
        ]

        mock_send.side_effect = responses

        result = env._llm_query(
            "What's the weather?",
            tools=sample_tools,
            tool_handler=failing_handler,
        )

        assert result == final_response


def test_llm_query_max_iterations(sample_tools):
    """Test that tool calling loop terminates at MAX_TOOL_ITERATIONS."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    def dummy_handler(tool_name, args):
        return "Result"

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # Always return tool calls (infinite loop scenario)
        tool_call_response = {
            "tool_calls": [{"id": "call_x", "name": "get_weather", "arguments": {"city": "SF"}}],
            "content": None,
        }
        mock_send.return_value = LMResponse.success_response(
            RLMChatCompletion(
                root_model="gpt-4",
                prompt=[],
                response=json.dumps(tool_call_response),
                usage_summary=make_usage_summary(),
                execution_time=0.1,
            )
        )

        result = env._llm_query(
            "Infinite loop test",
            tools=sample_tools,
            tool_handler=dummy_handler,
        )

        # Should return error after MAX_TOOL_ITERATIONS
        assert "__LLM_ERROR__|tool_loop_error" in result
        assert str(MAX_TOOL_ITERATIONS) in result
        assert mock_send.call_count == MAX_TOOL_ITERATIONS


def test_llm_query_batched_with_tools(sample_tools, sample_tool_handler):
    """Test llm_query_batched with tools processes each prompt independently."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # Each prompt gets: tool call -> final response
        responses = []
        cities = ["SF", "LA", "NYC"]

        for city in cities:
            # Tool call
            tool_call = {
                "tool_calls": [
                    {"id": f"call_{city}", "name": "get_weather", "arguments": {"city": city}}
                ],
                "content": None,
            }
            responses.append(
                LMResponse.success_response(
                    RLMChatCompletion(
                        root_model="gpt-4",
                        prompt=[],
                        response=json.dumps(tool_call),
                        usage_summary=make_usage_summary(),
                        execution_time=0.1,
                    )
                )
            )
            # Final response
            responses.append(
                LMResponse.success_response(
                    RLMChatCompletion(
                        root_model="gpt-4",
                        prompt=[],
                        response=f"Weather in {city} is sunny",
                        usage_summary=make_usage_summary(),
                        execution_time=0.1,
                    )
                )
            )

        mock_send.side_effect = responses

        prompts = [f"Weather in {city}?" for city in cities]
        results = env._llm_query_batched(
            prompts,
            tools=sample_tools,
            tool_handler=sample_tool_handler,
        )

        assert len(results) == 3
        for i, city in enumerate(cities):
            assert city in results[i]
        # 2 calls per prompt (tool call + final response)
        assert mock_send.call_count == 6


def test_llm_query_batched_without_tools_backward_compatible():
    """Test that llm_query_batched without tools uses the simple batched path."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # Batched response (single call)
        responses = [
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=f"Prompt {i}",
                    response=f"Response {i}",
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            )
            for i in range(3)
        ]

        # Batched response is wrapped in a single socket call
        batched_response = LMResponse(chat_completions=[r.chat_completion for r in responses])
        mock_send.return_value = batched_response

        prompts = ["Prompt 0", "Prompt 1", "Prompt 2"]
        results = env._llm_query_batched(prompts)

        assert len(results) == 3
        for i in range(3):
            assert results[i] == f"Response {i}"
        # Only 1 batched call
        assert mock_send.call_count == 1


# =============================================================================
# Integration Tests
# =============================================================================


def test_ensure_messages_format_string():
    """Test _ensure_messages_format converts string to messages list."""
    env = LocalREPL()
    result = env._ensure_messages_format("Hello")
    assert result == [{"role": "user", "content": "Hello"}]


def test_ensure_messages_format_list():
    """Test _ensure_messages_format preserves message list."""
    env = LocalREPL()
    messages = [{"role": "user", "content": "Hello"}]
    result = env._ensure_messages_format(messages)
    assert result == messages


def test_ensure_messages_format_invalid():
    """Test _ensure_messages_format raises on invalid input."""
    env = LocalREPL()
    with pytest.raises(ValueError, match="Invalid prompt type"):
        env._ensure_messages_format(123)


def test_tool_calls_with_multiple_tools_in_single_response(sample_tool_handler):
    """Test handling multiple tool calls in a single model response."""
    env = LocalREPL(lm_handler_address=("127.0.0.1", 12345))

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather",
                "parameters": {"type": "object", "properties": {"city": {"type": "string"}}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_time",
                "description": "Get time",
                "parameters": {"type": "object", "properties": {"timezone": {"type": "string"}}},
            },
        },
    ]

    def multi_handler(tool_name, args):
        if tool_name == "get_weather":
            return f"Weather in {args['city']}: Sunny"
        elif tool_name == "get_time":
            return f"Time in {args['timezone']}: 12:00 PM"
        return "Unknown"

    with patch("rlm.core.comms_utils.send_lm_request") as mock_send:
        # Model returns multiple tool calls at once
        multi_tool_call = {
            "tool_calls": [
                {"id": "call_1", "name": "get_weather", "arguments": {"city": "SF"}},
                {"id": "call_2", "name": "get_time", "arguments": {"timezone": "PST"}},
            ],
            "content": None,
        }
        final_response = "It's 12:00 PM and sunny in SF"

        responses = [
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=json.dumps(multi_tool_call),
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
            LMResponse.success_response(
                RLMChatCompletion(
                    root_model="gpt-4",
                    prompt=[],
                    response=final_response,
                    usage_summary=make_usage_summary(),
                    execution_time=0.1,
                )
            ),
        ]

        mock_send.side_effect = responses

        result = env._llm_query(
            "What's the time and weather in SF?",
            tools=tools,
            tool_handler=multi_handler,
        )

        assert result == final_response
        assert mock_send.call_count == 2
