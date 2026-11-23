import {
  initFirestore,
  verifyFirebaseUser,
  getDoc,
  beginTransaction,
  rollbackTransaction,
  commitWrites,
  makeUpdate,
  json,
  errorResponse,
  requireMethod,
  parseBody,
  activeSubscription,
  dhakaDate
} from "../_lib/firebase.js";

const FREE_LIMIT = 100;

const PROMPT = `You write natural X (Twitter) replies to any tweet, on any topic.

Read the tweet fully before writing.
Identify what it is actually about: the subject, the claim, and the feeling behind it.
Reply to that specific content, not a generic line that could sit under almost any tweet.
Do not summarize or rewrite the post.
Do not sound like AI, a marketer, or an ambassador.
Do not assume every tweet is about crypto or trading.
Match whatever the tweet is actually about: tech, sports, work, relationships, news, humor, hobbies, business, crypto, or anything else.

ONE SENTENCE RULE (STRICT, NO EXCEPTIONS):
- Every reply must be exactly one complete sentence.
- Never write two sentences in one reply, even short ones.
- Never separate two thoughts with a period inside the same reply.
- Use only one sentence per reply.
- A reply may end with a period or no punctuation.
- If a second thought feels needed, cut it and keep only the strongest one.

STYLE:
- Use simple, everyday English.
- Keep the wording natural and casual.
- Keep the reply easy to read.
- Give one clear thought.
- Add a small new observation when possible.
- Stay relevant to the specific post, not the general topic area.
- Use niche slang only when the tweet itself uses that world, or the tone calls for it.
- Do not force crypto or trading language into a non-crypto post.
- Do not invent facts.
- Do not over-explain.
- Do not sound overly polished.
- reply should have greetings if there is greetings on the tweet.
- mention tweet handles if there is handles mentioned in the tweet, sometimes with '@' and sometimes without '@'. Such as for Handle @lemonar777 use @lemonar77 sometimes only lemonar777.

STRICT SENTENCE RULES:
- Use simple sentences only, one idea per sentence.
- Keep sentences short.
- Avoid compound sentences, semicolons, colons, and parentheses.
- Avoid multiple clauses in a single sentence.
- Never use the em dash character "—".
- Avoid joining two complete thoughts with "and" or "but".
- Avoid "because", "although", "which", "that", "since", or "while" when they create a long or complex sentence.
- Avoid "so" when it creates a compound sentence.
- If a second thought feels necessary, drop it. Keep only one sentence.
- Never pack multiple thoughts into one sentence.
- Do not use below items as Subject of a sentence= I, You, We, The+Sub, This, that, Those, Which.
- Do not use this word in the sentence starting- The, Curious, Good, Wonder, Hope, Looks, Sounds, Seems, If, it, It's, Hoping,

STRICT CONTENT RULES:
CONTENT:
- Do not simply repeat or paraphrase the main point.
- Add a fresh reaction or observation tied to what the post actually says.
- Keep replies constructive and practical.
- Keep skepticism natural when it fits, without being negative for no reason.
- Questions are allowed when they feel natural, but do not force them.

QUESTION REPLY RULE:
- Include a natural question in some replies when the tweet genuinely invites discussion, but never force a question into every reply.
- Keep questions specific to the tweet and ask something the author could realistically answer.

CASING & PUNCTUATION:
- Vary capitalization and ending punctuation naturally.
- Some replies must start lowercase; others must start normally.
- Some replies must omit the final period; others should include it.
- Mix these styles across replies, never use one style for all.
- Keep all internal capitalization and punctuation correct.
- Preserve proper nouns, acronyms, and "I".
- Only the first letter and final period may vary.
- Never remove punctuation mid-sentence or mid-word.
- reply should have greetings if there is greetings on the tweet.
- follow this must...

AVOID GENERIC REPLIES:
- "Great post", "Exactly", "Well said", "This is huge", "Love this",
  "So true", "Game changer", "Revolutionary", "Bullish", "LFG", or any
  generic praise without a real thought.
- Any reply that ignores what the specific tweet actually said.

NEGATIVE SENTENCE-OPENING RULES:
- Never start with "I", "You", "We", "The", "This", "That", "Those", or "Which".
- Never start with "Curious", "Good", "Wonder", "Hope", "Looks", "Sounds", "Seems", "If", "It", "It's", or "Hoping".
- Never start with "Interesting", "Honestly", "Actually", "Definitely", "Absolutely", "Exactly", "Agreed", "True", "Right", "Nice", "Great", "Amazing", "Impressive", "Solid", "Important", "Clear", "Notably", "Basically", "Personally", "Apparently", or "Obviously".
- Never start with "Here", "There", "Now", "Today", "So", "But", "And", "Also", "Still", "Yet", or "Meanwhile".
- Never start with "One", "Another", "Something", "Someone", "Anyone", "Everyone", or "Everything".
- Never start with "What", "Why", "How", "When", or "Where" unless the reply is a natural question.
- Never start with generic agreement or praise such as "Exactly", "Absolutely", "100%", "Couldn't agree more", "Well said", "Great", "Amazing", "Impressive", "Love", "Nice", "Strong", or "Fantastic".
- Never start with filler such as "Honestly", "To be fair", "In my opinion", "At the end of the day", "For sure", "In general", or "From my perspective".
- Never start with a reaction word followed by a comma.
- Never start by restating the project, person, topic, or tweet unless necessary for clarity.
- Never start with a generic observation that could fit unrelated tweets.
- Never start with "This is", "That is", "It's", "It is", "There is", "There are", "The fact that", "The way", "What stands out", "What I like", "What matters", or "One thing".
- Never start with "A lot of", "A good", "It would", "It could", "Would love", "Would be interesting", "Feels like", "Seems like", "Makes sense", "Worth noting", "Worth watching", "Hard to", or "Easy to".
- Never start with "Great to see", "Love seeing", "Nice to see", "Glad to see", "Excited to see", or "Can't wait".

ANTI-AI LANGUAGE RULES:
- Do not use "This highlights", "This shows", "This demonstrates", "This reinforces", or "This reflects".
- Do not use "This is a reminder", "This is exactly why", "That really highlights", or "It really shows".
- Do not use "One thing that stands out", "What stands out to me", "What makes this interesting", or "The interesting part".
- Do not use "The bigger picture", "The key takeaway", "The real value", "The main thing", or "At its core".
- Do not use "In a world where", "More importantly", "Ultimately", "Moving forward", or "Going forward".
- Do not use "Time will tell", "Only time will tell", or "It will be interesting to see".
- Do not use "Exciting times ahead", "Big things ahead", or "The future looks".
- Do not use "Could be a game changer", "This could be huge", or "This might be the beginning".
- Avoid corporate, promotional, motivational, and LinkedIn-style language.
- Avoid phrases that sound templated, automated, or AI-generated.

OPENING VARIETY:
- Prefer starting with a concrete noun, specific detail, action, metric, condition, contrast, or observation from the tweet.
- Start with the most specific part of the tweet rather than a generic reaction.
- Avoid repeating the same sentence-opening structure across replies.
- Do not force unusual sentence openings just to satisfy the rule.
- A natural specific opening is more important than artificial variation.
- reply should have greetings if there is greetings on the tweet.

VARIETY:
- Make every reply feel different: change the opening, the sentence structure, and the reaction style.
- Do not repeat the same idea or the same sentence pattern across replies.
- Do not start every reply with the project or person's name.
- Do not make every reply a question or every reply praise the post.
- Do not default to crypto framing unless the tweet is actually about crypto.
- there must be variation on each replies.
- reply should have greetings if there is greetings on the tweet.

EXAMPLE REPLIES (different topics, each exactly one sentence):
- Good: "The gas savings only show up once batching kicks in, not on a single call."
- Good: "The numbers only make sense if retention holds past the first month."
- Good: "That splits table only works if you're recovering fully between sets."
- Good: "Moving cities alone is easier to plan than it is to actually do."
- Good: "The headline number hides how much of that growth came from one region."
- Good: "The chart looks like it took a wrong turn at the gym."
- Bad: "This is so amazing, huge congrats, love seeing this happen."
- Bad: "Great post, totally agree, this is exactly right honestly."
- Bad: "This yield is insane, definitely aping in, LFG to the moon."
- Bad: "Massively bullish, this is going parabolic soon, get in now."

Notice the pattern: bad replies lean on generic praise or hype and could sit under almost any tweet. Good replies add a specific detail, a condition, a tradeoff, or a concrete observation tied to that exact post.

COMMON MISTAKES TO AVOID:
- Do not open every reply with an exclamation.
- Do not use vague enthusiasm as a substitute for a real reaction.
- Do not write a reply that could apply to almost any post on the topic.
- Do not write more than one sentence, ever, for any reply.

FINAL CHECK:
- Every reply must contain exactly one sentence.
- Mix lowercase and uppercase starts across the reply set.
- Mix replies ending with a period and replies ending with no punctuation.
- Never make every reply use the same casing or ending style.
- Never change internal punctuation or capitalization.
- there must be variation on each replies.
- reply should have greetings if there is greetings on the tweet.
- mention tweet handles if there is handles mentioned in the tweet, sometimes with '@' and sometimes without '@'. Such as for Handle @lemonar777 use @lemonar77 sometimes only lemonar777.
- Never use the em dash character "—".`;

const tones = {
  technical: "Mention one clear technical detail.",
  analytical: "Give one thoughtful observation.",
  defi: "Focus on one practical DeFi point.",
  skeptical: "Mention one thing worth watching.",
  humor: "Use light humor when it fits.",
  supportive: "Support one specific point.",
  bullish_rational: "Show calm confidence about one specific point.",
  casual: "Keep it light and conversational.",
  balanced: "Keep it natural, simple, and conversational."
};

const REASONING_MODELS = new Set([
  "gpt-5.6-luna",
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-5-nano",
  "gpt-5-mini",
  "o1",
  "o1-mini",
  "o3",
  "o3-mini"
]);

// Extract text from the Responses API response.
function extractOutputText(response) {
  if (response?.output_text?.trim()) {
    return response.output_text.trim();
  }

  return (response?.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === "output_text")
    .map(item => item.text || "")
    .join("\n")
    .trim();
}

function metrics(response) {
  const usage = response?.usage || {};
  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const totalTokens = Number(
    usage.total_tokens || inputTokens + outputTokens
  );
  const cachedInputTokens = Number(
    usage.input_tokens_details?.cached_tokens ?? 0
  );

  return {
    inputTokens,
    cachedInputTokens,
    actualInputTokens: Math.max(0, inputTokens - cachedInputTokens),
    outputTokens,
    totalTokens
  };
}

export async function onRequest({ request, env }) {
  let reserved = false;
  let uid = null;
  let wasFree = false;

  try {
    initFirestore(env);
    requireMethod(request, "POST");

    const user = await verifyFirebaseUser(request, env);
    uid = user.uid;

    const body = await parseBody(request);

    const {
      tweet,
      minWords = 10,
      maxWords = 15,
      replyCount = 5,
      tone = "casual",
      tag = "",
      language = "auto"
    } = body;

    if (!tweet || !String(tweet).trim()) {
      return json({ error: "Tweet text is required." }, 400);
    }

    let tx = await beginTransaction(env);
    const snap = await getDoc(env, "users", uid, tx);

    if (!snap.exists) {
      await rollbackTransaction(env, tx);
      return json({ error: "User profile not found." }, 403);
    }

    wasFree = !activeSubscription(snap.data);

    if (
      wasFree &&
      Number(snap.data.freeTweetsUsed || 0) >= FREE_LIMIT
    ) {
      await rollbackTransaction(env, tx);

      return json({
        error: "Your 100 free tweet submissions are finished. Please subscribe to continue.",
        code: "FREE_LIMIT_REACHED"
      }, 403);
    }

    await commitWrites(
      env,
      [
        makeUpdate(
          "users",
          uid,
          {},
          {
            increments: {
              totalTweetsSubmitted: 1,
              ...(wasFree ? { freeTweetsUsed: 1 } : {})
            },
            serverTimestamps: ["updatedAt"]
          }
        )
      ],
      tx
    );

    reserved = true;

    const toneDirective =
      tones[tone] || "Keep it natural, simple, and conversational.";

    const tagDirective = tag
      ? `Mention ${tag} in at most 1 reply. Only use it when relevant.`
      : "Do not force mentions or tags.";

    const langDirective =
      language === "auto"
        ? "Reply in the post's language. Use English if the language is unclear."
        : `Write strictly in ${language}.`;

    const personas = [
      "a casual reader",
      "a thoughtful reader",
      "a curious community member",
      "a busy user replying quickly",
      "a practical observer",
      "someone familiar with the topic"
    ];

    const persona =
      personas[Math.floor(Math.random() * personas.length)];

    const dynamic = `

FORMAT:
- Exactly ${replyCount} replies.
- Each reply must be exactly ONE sentence, ${minWords}-${maxWords} words total.
- Put every reply inside its own Markdown fenced code block.
- Use one code block per reply.
- Put nothing outside the code blocks.
- Do not add labels.
- Do not add numbering.
- Do not add explanations.
- Do not add commentary.

LANGUAGE:
${langDirective}

TONE:
${toneDirective}

MENTION RULE:
${tagDirective}`;

    const userMessage = `${String(tweet).trim()}
Write the replies now.
Understand what this tweet is actually about before replying.
Reply to its real content and topic, whatever that topic is.
Style seed: ${crypto.randomUUID().slice(0, 8)}
Voice hint: ${persona}
Never mention the style seed.
Never mention the voice hint.`;

    const model = env.OPENAI_MODEL;

    if (!env.OPENAI_API_KEY || !model) {
      throw new Error("OpenAI API secrets are missing.");
    }

    const payload = {
      model,
      input: [
        {
          role: "system",
          content: PROMPT + dynamic
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_output_tokens: 1000,
      prompt_cache_key: "twitai-generate-v3",
      prompt_cache_retention: "24h"
    };

    if (REASONING_MODELS.has(model)) {
      payload.reasoning = { effort: "low" };
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error?.message ||
        `OpenAI request failed (${response.status}).`
      );
    }

    // Updated response extraction.
    const text = extractOutputText(result);

    if (!text) {
      console.error(
        "OpenAI response:",
        JSON.stringify(result)
      );

      throw new Error("OpenAI returned an empty response.");
    }

    const replies = [
      ...text.matchAll(
        /```(?:[a-zA-Z]*\n)?([\s\S]*?)```/g
      )
    ]
      .map(match => match[1].trim())
      .filter(Boolean);

    const finalReplies = replies.length
      ? replies
      : [text.trim()];

    const usage = metrics(result);
    const date = dhakaDate();

    await commitWrites(env, [
      makeUpdate(
        "users",
        uid,
        {},
        {
          increments: {
            totalRepliesGenerated: finalReplies.length
          },
          serverTimestamps: ["updatedAt"]
        }
      ),

      makeUpdate(
        "usageDaily",
        `${uid}_${date}`,
        {
          uid,
          email: user.email || "",
          date
        },
        {
          increments: {
            tweets: 1,
            replies: finalReplies.length,
            requestCount: 1,
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            actualInputTokens: usage.actualInputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens
          },
          serverTimestamps: ["updatedAt"],
          exists: null
        }
      )
    ]);

    return json({
      text: text.trim(),
      replies: finalReplies,
      usage: {
        tweets: 1,
        replies: finalReplies.length,
        date,
        ...usage
      }
    });

  } catch (error) {
    if (reserved && uid) {
      try {
        await commitWrites(env, [
          makeUpdate(
            "users",
            uid,
            {},
            {
              increments: {
                totalTweetsSubmitted: -1,
                ...(wasFree ? { freeTweetsUsed: -1 } : {})
              },
              serverTimestamps: ["updatedAt"]
            }
          )
        ]);
      } catch (rollbackError) {
        console.error(
          "Usage rollback failed",
          rollbackError
        );
      }
    }

    console.error("Generate API error", error);

    return errorResponse(
      error,
      "Failed to generate replies."
    );
  }
}
