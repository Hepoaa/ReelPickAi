
import { AISearchData, ChatMessage } from '../types';

// User-provided API credentials and settings
const OPENROUTER_API_KEY = "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";
const REFERER_URL = "https://cinesuggest-ai.com"; 
const SITE_TITLE = "CineSuggest AI";

const TEXT_MODEL = "mistralai/mistral-7b-instruct:free";

const callOpenRouter = async (model: string, messages: any[], isJson = false) => {
  const body: any = {
    model: model,
    messages: messages,
  };

  if (isJson) {
      body.response_format = { "type": "json_object" };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": REFERER_URL,
      "X-Title": SITE_TITLE,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('OpenRouter API Error:', errorBody);
    throw new Error(`OpenRouter API request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error("Invalid response structure from OpenRouter API");
  }
  return data.choices[0].message.content;
};


const FLEXIBLE_SEARCH_INSTRUCTION = `You are an AI search query pre-processor for a movie/TV show database. Your mission is to translate a user's query into an optimal search string for a flexible, metadata-based search engine. The search must be exhaustive and ignore people (actors, directors).

**The Search Engine's Logic (Your Target):**
1.  **Multi-Field Search:** It searches across all metadata: title, genre, thematic tags, visual tags, and synopsis.
2.  **"OR" Logic:** It treats every word in your output string as an "OR" condition. (e.g., "robot future rain" finds movies with 'robot' OR 'future' OR 'rain').
3.  **Typo Tolerance:** It has a built-in fuzzy match for minor spelling errors.

**Your Task & Rules:**

1.  **Analyze and Clean:** Read the user's query. Remove conversational filler and common stop words (e.g., 'peliculas de', 'a movie about', 'y', 'con').
2.  **Correct Typos:** Fix obvious spelling mistakes in core terms (e.g., 'magi' -> 'magia', 'distpia' -> 'distopia').
3.  **Extract Core Concepts:** Isolate the essential keywords that represent the title, genre, themes, or plot points.
4.  **Build the "OR" Query:** Combine these core keywords into a single, space-separated string. This is the final search query. Do not add any operators like "OR".
5.  **NO HUMAN ENTITIES:** Strictly ignore and remove any names of actors, directors, or characters from the final query.
6.  **OUTPUT FORMAT:** You MUST respond with ONLY a valid JSON object. No other text or explanation. The JSON must have a single key: "search_query".
    *   Format: \`{ "search_query": "your_optimized_search_string" }\`

**EXAMPLES:**

*   User Query: "peliculas de magi y amistad"
    *   Your JSON Output: \`{ "search_query": "magia amistad" }\`

*   User Query: "robot futuro lluvia"
    *   Your JSON Output: \`{ "search_query": "robot futuro lluvia" }\`

*   User Query: "a show about a distpia with androids, directed by Ridley Scott"
    *   Your JSON Output: \`{ "search_query": "distopia androids" }\` (Note: 'Ridley Scott' is ignored)

*   User Query: "Terminatorr"
    *   Your JSON Output: \`{ "search_query": "Terminator" }\`
`;

export const getSearchTermsFromAI = async (query: string): Promise<AISearchData> => {
  try {
    const messages = [
        { "role": "system", "content": FLEXIBLE_SEARCH_INSTRUCTION },
        { "role": "user", "content": `User Query: "${query}"` }
    ];

    const jsonString = await callOpenRouter(TEXT_MODEL, messages, true);
    if (!jsonString) {
        throw new Error("AI returned an empty response.");
    }
    
    const cleanedJsonString = jsonString.replace(/^```json\n|```$/g, '').trim();
    return JSON.parse(cleanedJsonString) as AISearchData;
  } catch (error) {
    console.error("Error calling AI API for text search:", error);
    throw new Error("Failed to get search terms from AI.");
  }
};

const CHAT_SYSTEM_INSTRUCTION = `You are CineSuggest AI, a friendly and knowledgeable chatbot specializing in movies and TV shows. Your goal is to have a natural conversation with the user, helping them discover new things to watch, answer trivia, or just chat about film. Be conversational, engaging, and helpful. Don't just provide lists; explain why you're suggesting something. Keep your responses concise and easy to read.`;

export const getChatResponseFromAI = async (history: ChatMessage[]): Promise<string> => {
    const messages = history
        .filter(msg => msg.role !== 'error')
        .map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content
        }));

    const fullMessageHistory = [
        { "role": "system", "content": CHAT_SYSTEM_INSTRUCTION },
        ...messages
    ];
    
    return callOpenRouter(TEXT_MODEL, fullMessageHistory);
};
