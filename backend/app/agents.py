import os
from urllib.parse import quote_plus
from typing import Optional
from tinyfish import TinyFish

TINYFISH_API_KEY = os.getenv("TINYFISH_API_KEY")
client = TinyFish(api_key=TINYFISH_API_KEY) if TINYFISH_API_KEY else None

def run_tinyfish_agent(user_input: str) -> Optional[str]:
    """
    Handles both specific problem URLs/IDs and general algorithm names.
    Uses the tinyfish package to extract problem/algorithm data.
    Returns extracted data or None if extraction fails.
    """
    is_url = user_input.startswith("http://") or user_input.startswith("https://")

    if is_url:
        target = f"the programming problem at this URL: {user_input}"
        target_url = user_input
    else:
        target = f"the programming problem OR algorithm named '{user_input}'"
        # TinyFish browser automation requires a URL; use broad but intent-focused search.
        search_query = f"{user_input} competitive programming problem editorial solution"
        target_url = f"https://www.google.com/search?q={quote_plus(search_query)}"

    goal = f"""
    1. Locate information about {target}.
    2. If it is a specific problem, extract the problem description, constraints, and the official editorial/solution logic.
    3. If it is a general algorithm, extract the core mechanics, use cases, and standard pseudo-code.
    4. If the text is not in English, translate it.
    5. Return a structured summary of the logic and constraints.
    """

    if not client:
        # Mock response for rapid UI development during hackathon
        return f"[MOCK DATA] Extracted info for: {user_input}\n\nKeyword: Monotonic Stack/Deque\nUse Case: Optimizing range-based queries\nTime Complexity: O(n)\nCore Idea: Maintain elements in decreasing order to process each element efficiently."
    
    try:
        result = client.agent.run(
            goal=goal,
            url=target_url,
        )
        return getattr(result, "result", str(result))
    except Exception as e:
        print(f"TinyFish error: {e}")
        return None